"""Reintentos de cierre en segundo plano tras fallar la ráfaga de apagado.

Spec: docs/features/06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from ..adapters.valves import async_set_valve
from ..const import CLOSE_RETRY_OFFSETS_S
from .incidents import Incidents

_LOGGER = logging.getLogger(__name__)


@dataclass
class _Retry:
    """Fallback de una switch: reintentos contados y lo que sigue vivo."""

    zone_id: str
    # hora del bucle al empezar: la secuencia cuenta desde aquí (spec §2)
    started: float
    done: int = 0
    timer: CALLBACK_TYPE | None = None
    unsub_state: CALLBACK_TYPE | None = None
    # intento en curso; como mucho uno por switch
    task: asyncio.Task[None] | None = None


class CloseRetry:
    """Un fallback por switch. No toma el lock del manager ni toca ValveSlots."""

    def __init__(self, hass: HomeAssistant, incidents: Incidents) -> None:
        self.hass = hass
        self._incidents = incidents
        self._retries: dict[str, _Retry] = {}

    def active(self) -> set[str]:
        """Switch con reintentos en marcha: quedan fuera de «encendida a mano» (spec §5)."""
        return set(self._retries)

    def is_active(self, entity_id: str) -> bool:
        return entity_id in self._retries

    @callback
    def start(self, zone_id: str, entity_id: str) -> None:
        """Arranca el fallback. Con uno ya en marcha sigue el que hay (spec §3)."""
        if entity_id in self._retries:
            return
        retry = _Retry(zone_id, self.hass.loop.time())
        self._retries[entity_id] = retry
        retry.unsub_state = async_track_state_change_event(self.hass, [entity_id], self._state_changed)
        _LOGGER.warning("%s: reintentos de cierre en segundo plano", entity_id)
        self._schedule_next(entity_id, retry)

    @callback
    def cancel(self, entity_id: str) -> None:
        """Para sin aviso: la integración vuelve a abrir la válvula."""
        self._drop(entity_id)

    @callback
    def cancel_all(self) -> None:
        """Para todos sin aviso: descarga de la entry o parada de HA (spec §3)."""
        for entity_id in list(self._retries):
            self._drop(entity_id)

    @callback
    def _schedule_next(self, entity_id: str, retry: _Retry) -> None:
        due = retry.started + CLOSE_RETRY_OFFSETS_S[retry.done]
        delay = max(0.0, due - self.hass.loop.time())
        retry.timer = async_call_later(self.hass, delay, partial(self._timer_fired, entity_id))

    @callback
    def _timer_fired(self, entity_id: str, _now: datetime) -> None:
        retry = self._retries.get(entity_id)
        if retry is None:
            return
        retry.timer = None
        if retry.task is not None:
            # otro intento en curso: este se salta y cuenta como hecho (spec §2)
            self._count_failed(entity_id, retry)
            return
        self._attempt(entity_id, retry, counted=True)

    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        retry = self._retries.get(entity_id)
        old_state = event.data["old_state"]
        new_state = event.data["new_state"]
        if retry is None or new_state is None:
            return
        if new_state.state == STATE_OFF:
            # cerrada por un reintento, a mano o por otro motivo
            self._finish(entity_id, recovered=True)
        elif (
            new_state.state == STATE_ON
            and old_state is not None
            and old_state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            and retry.task is None
        ):
            # vuelve la switch (Zigbee tras un reinicio): intento extra, fuera de la tabla (spec §2.1)
            self._attempt(entity_id, retry, counted=False)

    @callback
    def _attempt(self, entity_id: str, retry: _Retry, *, counted: bool) -> None:
        retry.task = self.hass.async_create_background_task(
            self._async_attempt(entity_id, retry, counted), f"irrigation_close_retry_{entity_id}"
        )

    async def _async_attempt(self, entity_id: str, retry: _Retry, counted: bool) -> None:
        ok = await async_set_valve(self.hass, entity_id, turn_on=False, retries=0)
        # terminado o cancelado mientras se intentaba: ya no es este fallback
        if self._retries.get(entity_id) is not retry:
            return
        retry.task = None
        if ok:
            self._finish(entity_id, recovered=True)
        elif counted:
            self._count_failed(entity_id, retry)

    @callback
    def _count_failed(self, entity_id: str, retry: _Retry) -> None:
        retry.done += 1
        if retry.done >= len(CLOSE_RETRY_OFFSETS_S):
            self._finish(entity_id, recovered=False)
        else:
            self._schedule_next(entity_id, retry)

    @callback
    def _finish(self, entity_id: str, *, recovered: bool) -> None:
        retry = self._drop(entity_id)
        if retry is None:
            return
        if recovered:
            _LOGGER.info("%s cerrada durante los reintentos en segundo plano", entity_id)
            self._notify(self._incidents.push_close_recovered(retry.zone_id, entity_id), entity_id)
        else:
            _LOGGER.error("%s sin cerrar tras %s reintentos en segundo plano", entity_id, retry.done)
            self._notify(self._incidents.valve_close_gave_up(retry.zone_id, entity_id), entity_id)

    @callback
    def _notify(self, coro: Coroutine[Any, Any, None], entity_id: str) -> None:
        self.hass.async_create_background_task(coro, f"irrigation_close_retry_notice_{entity_id}")

    @callback
    def _drop(self, entity_id: str) -> _Retry | None:
        """Quita el fallback y lo que tenga vivo. El intento en curso se cancela si no es quien llama."""
        retry = self._retries.pop(entity_id, None)
        if retry is None:
            return None
        if retry.timer is not None:
            retry.timer()
        if retry.unsub_state is not None:
            retry.unsub_state()
        if retry.task is not None and retry.task is not asyncio.current_task():
            retry.task.cancel()
        return retry
