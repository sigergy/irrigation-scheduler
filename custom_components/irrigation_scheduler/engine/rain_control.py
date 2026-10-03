"""Lluvia: estado único, seguimiento de fuentes y decisiones por lote (05-rain-skip.md §8)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from ..adapters.rain_source import async_forecast, async_past_rain
from ..const import RAIN_DEBOUNCE_S, RAIN_EPISODE_MAX, RAIN_EVAL_LEAD_MIN, RAIN_REFRESH_INTERVAL
from ..domain.model import Settings, Zone
from ..domain.rain import ForecastSlot, RainState, Verdict, forecast_rain_mm, predict, round_mm
from ..domain.runtime import BlockRef, RainDecision, RuntimeState
from ..domain.schedule import upcoming_blocks

_LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class ZoneOutlook:
    """Próximo bloque P de una zona y su predicción o decisión fijada (05-rain-skip.md §8.21)."""

    when: datetime
    verdict: Verdict
    predicted: bool


class RainControl:
    """Estado de lluvia y su recálculo. Su `_rain_lock` no es el lock del manager."""

    def __init__(self, hass: HomeAssistant, settings: Callable[[], Settings]) -> None:
        self.hass = hass
        # getter: el manager sustituye config (y sus ajustes) al cargar y al guardar
        self._settings = settings
        # estado de lluvia único (05-rain-skip.md §8.9); lo publican las entidades de lluvia
        self.state = RainState()
        self._rain_lock = asyncio.Lock()
        self._unsubs: list[CALLBACK_TYPE] = []
        self._debounce: CALLBACK_TYPE | None = None
        self._on_change: Callable[[], Awaitable[object]] | None = None

    def configured(self) -> bool:
        settings = self._settings()
        return bool(settings.rain_sensor or settings.weather_entity)

    def track(self, on_change: Callable[[], Awaitable[object]]) -> None:
        """(Re)registra el recálculo horario y el seguimiento del pluviómetro (§8.9, §8.27)."""
        self.untrack()
        if not self.configured():
            return
        self._on_change = on_change
        self._unsubs.append(async_track_time_interval(self.hass, self._async_tick, RAIN_REFRESH_INTERVAL))
        if sensor := self._settings().rain_sensor:
            self._unsubs.append(
                async_track_state_change_event(self.hass, [sensor], self._async_sensor_changed)
            )

    def untrack(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._debounce is not None:
            self._debounce()
            self._debounce = None

    @callback
    def _async_sensor_changed(self, _event: Event[EventStateChangedData]) -> None:
        # una ráfaga de cambios da un solo recálculo (§8.27)
        if self._debounce is not None:
            self._debounce()
        self._debounce = async_call_later(self.hass, RAIN_DEBOUNCE_S, self._async_debounced)

    async def _async_debounced(self, _now: datetime) -> None:
        self._debounce = None
        if self._on_change is not None:
            await self._on_change()

    async def _async_tick(self, _now: datetime) -> None:
        if self._on_change is not None:
            await self._on_change()

    async def refresh(self) -> RainState:
        """Recalcula el estado de lluvia (§8.9): una consulta por fuente, compartida por las zonas.

        No dispara alertas: rain_source_unavailable solo sale al evaluar un lote (§8.2).
        """
        async with self._rain_lock:
            settings = self._settings()
            (past_mm, past_error), (slots, forecast_error) = await asyncio.gather(
                async_past_rain(self.hass, settings.rain_sensor, settings.rain_past_hours),
                async_forecast(self.hass, settings.weather_entity),
            )
            forecast_mm = None
            if slots is not None:
                forecast_mm, covered = forecast_rain_mm(slots, dt_util.utcnow(), settings.rain_forecast_hours)
                if not covered:
                    # se suma lo disponible; no es fallo de la fuente (§4.2, §8.7)
                    _LOGGER.warning(
                        "El pronóstico de %s cubre menos de %s h",
                        settings.weather_entity,
                        settings.rain_forecast_hours,
                    )
            self.state = RainState(
                past_configured=settings.rain_sensor is not None,
                forecast_configured=settings.weather_entity is not None,
                past_mm=past_mm,
                forecast_mm=forecast_mm,
                forecast=tuple(slots) if slots is not None else None,
                past_error=past_error,
                forecast_error=forecast_error,
            )
        return self.state

    def set_estimate(self, estimated_mm: float | None, log: tuple[ForecastSlot, ...]) -> RainState:
        """Añade la lluvia estimada al estado (rain-estimated-design.md §5.5)."""
        self.state = replace(self.state, estimated_mm=estimated_mm, forecast_log=log)
        return self.state


def apply_verdict(
    runtime: RuntimeState,
    zones: dict[str, Zone],
    refs: list[BlockRef],
    verdict: Verdict,
    needs_rain: Callable[[Zone], bool],
    now: datetime,
) -> tuple[bool, list[BlockRef], list[tuple[Zone, str]]]:
    """Fija la decisión de cada bloque del lote y abre o cierra episodios (§8.14, §8.16, §8.19).

    Muta el runtime: quien llama debe tener el lock del manager.
    Devuelve (algún bloque evaluado, bloques omitidos, zonas que abren episodio).
    """
    evaluated = False
    skipped: list[BlockRef] = []
    opened: list[tuple[Zone, str]] = []
    for zone_id, start, day in refs:
        zone = zones.get(zone_id)
        # la zona puede haber cambiado durante el recálculo
        if zone is None or not needs_rain(zone):
            continue
        evaluated = True
        runtime.rain_decisions[(zone_id, start, day)] = RainDecision(
            zone_id, start, day, verdict.skip, verdict.reason, round_mm(verdict.rain_mm)
        )
        episode = runtime.rain_episodes.get(zone_id)
        if episode is not None and now - episode > RAIN_EPISODE_MAX:
            # caducado: se cierra antes de decidir (§8.14)
            del runtime.rain_episodes[zone_id]
            episode = None
        if verdict.skip:
            skipped.append((zone_id, start, day))
            if episode is None:
                runtime.rain_episodes[zone_id] = now
                opened.append((zone, start))
        elif not verdict.sources_failed:
            # riega porque la lluvia no llega al umbral: cierra (§8.19)
            runtime.rain_episodes.pop(zone_id, None)
    return evaluated, skipped, opened


def _skip_decided(runtime: RuntimeState, zone_id: str, when: datetime) -> bool:
    decision = runtime.rain_decisions.get((zone_id, when.strftime("%H:%M"), when.date()))
    return decision is not None and decision.skip


def _outlook(
    zone: Zone,
    runtime: RuntimeState,
    rain: RainState,
    settings: Settings,
    needs_rain: bool,
    when: datetime,
    now: datetime,
) -> ZoneOutlook | None:
    if not needs_rain:
        return None
    decision = runtime.rain_decisions.get((zone.zone_id, when.strftime("%H:%M"), when.date()))
    if decision is not None:
        return ZoneOutlook(when, Verdict(decision.skip, decision.reason, decision.rain_mm), predicted=False)
    # la ventana que usará P: desde su T−10; si ya pasó, desde ahora (se evaluará a su hora)
    evaluate_at = max(when - timedelta(minutes=RAIN_EVAL_LEAD_MIN), now)
    verdict = predict(rain, settings, evaluate_at)
    return None if verdict is None else ZoneOutlook(when, verdict, predicted=True)


def zone_plan(
    zone: Zone,
    runtime: RuntimeState,
    rain: RainState,
    settings: Settings,
    needs_rain: bool,
    now: datetime,
) -> tuple[ZoneOutlook | None, datetime | None]:
    """(P con su predicción o decisión, próximo riego a mostrar) (§8.21)."""
    # P: el primer bloque sin decisión fijada «omitir»
    blocks = (when for when in upcoming_blocks(zone, now) if not _skip_decided(runtime, zone.zone_id, when))
    first = next(blocks, None)
    if first is None:
        return None, None
    outlook = _outlook(zone, runtime, rain, settings, needs_rain, first, now)
    if outlook is not None and outlook.verdict.skip:
        # el bloque siguiente a P se muestra tal cual, sin predecir
        return outlook, next(blocks, None)
    return outlook, first
