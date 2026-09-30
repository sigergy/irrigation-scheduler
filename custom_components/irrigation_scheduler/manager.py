"""Orquestador: disparos, colas, válvulas, latido y arranque (03-valves-execution.md)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import partial
from typing import Any
from uuid import uuid4

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from .adapters.rain_source import async_forecast, async_past_rain
from .adapters.store import IrrigationStore
from .adapters.valves import async_set_valve
from .const import (
    DECISION_PURGE_MARGIN,
    DOMAIN,
    EVENT_BLOCK_SKIPPED,
    EVENT_NO_WATER,
    EVENT_SENSOR_UNAVAILABLE,
    EVENT_VALVE_OVERRUN,
    HEARTBEAT_INTERVAL,
    MODE_AUTO,
    MODES,
    ORIGIN_EXTERNAL,
    ORIGIN_IDLE,
    ORIGIN_MANUAL,
    ORIGIN_SCHEDULED,
    OVERRUN_MARGIN,
    RAIN_DEBOUNCE_S,
    RAIN_EPISODE_MAX,
    RAIN_EVAL_LEAD_MIN,
    RAIN_REFRESH_INTERVAL,
    RAIN_STARTUP_MAX,
    RAIN_STARTUP_RETRY_S,
    SIGNAL_CONFIG,
    SIGNAL_STATE,
    SIGNAL_ZONE_ADDED,
    STATUS_IDLE,
    STATUS_QUEUED,
    STATUS_RUNNING,
    ZONE_DELETE_BUSY,
    ZONE_DELETE_VALVES_ON,
)
from .domain.model import Config, Settings, Valve, Zone
from .domain.rain import RainState, Verdict, decide, forecast_rain_mm, predict, round_mm
from .domain.runtime import BlockRef, Job, OpenValve, RainDecision, RuntimeState, estimate_batch_ends
from .domain.schedule import block_day, blocks_at, missed_blocks, upcoming_blocks, valves_for_block
from .domain.validation import Issue, validate_settings, validate_zone
from .engine.incidents import Incidents
from .engine.slots import ValveSlots
from .entities.unique_ids import installation_uid, valve_uid, zone_uid
from .errors import ZoneDeleteError

_LOGGER = logging.getLogger(__name__)

ZONE_OPTIONS = ("enabled", "rain_skip", "mode")


@dataclass(frozen=True)
class ZoneOutlook:
    """Próximo bloque P de una zona y su predicción o decisión fijada (05-rain-skip.md §8.21)."""

    when: datetime
    verdict: Verdict
    predicted: bool


class IrrigationManager:
    def __init__(self, hass: HomeAssistant, entry_id: str, store: IrrigationStore) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self._store = store
        self.config = Config()
        # huecos de válvula: cola, abiertas y estados en tránsito; mutar solo con el lock
        self._slots = ValveSlots(RuntimeState())
        # serializa colas y válvulas: ningún cambio de runtime fuera del lock
        self._lock = asyncio.Lock()
        self._started = False
        self._unsubs: list[CALLBACK_TYPE] = []
        self._zone_unsubs: dict[str, list[CALLBACK_TYPE]] = {}
        # disparadores por hora de inicio: T−10 (decisión) y T (riego) (§8.11, §8.16)
        self._time_unsubs: list[CALLBACK_TYPE] = []
        self._close_unsubs: dict[str, CALLBACK_TYPE] = {}
        # el lock protege solo el estado en memoria (runtime, config); las llamadas a la
        # switch y los push van fuera, en tareas en paralelo; las válvulas en tránsito
        # (abriendo o cerrando) siguen ocupando su hueco de zona y global (ValveSlots)
        # origen de cada switch encendida, para el push de apagado (valve_switched); solo en memoria
        self._switch_origin: dict[str, str] = {}
        self._tasks: set[asyncio.Task] = set()
        self._stopping = False
        # estado de lluvia único (05-rain-skip.md §8.9); lo publican las entidades de lluvia
        self.rain = RainState()
        self._rain_lock = asyncio.Lock()
        self._rain_unsubs: list[CALLBACK_TYPE] = []
        self._rain_debounce: CALLBACK_TYPE | None = None
        # incidencias: event, bus y push; lee config y unidad por getter
        self._incidents = Incidents(hass, lambda: self.config, self.rain_unit)

    @property
    def runtime(self) -> RuntimeState:
        """Estado persistido. Huecos: solo vía ValveSlots; lluvia y latido: el manager con el lock."""
        return self._slots.runtime

    # ---------- ciclo de vida ----------

    def _spawn(self, coro: Any, name: str) -> None:
        """Lanza una tarea en segundo plano fuera del lock y la sigue hasta que termine."""
        task = self.hass.async_create_background_task(coro, name)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def async_setup(self) -> None:
        self.config, runtime = await self._store.async_load()
        self._slots = ValveSlots(runtime)
        # las switch deben existir antes de recuperar (03 §5.2)
        self._unsubs.append(async_at_started(self.hass, self._async_on_started))

    async def _async_on_started(self, _hass: HomeAssistant) -> None:
        undecided, soon = await self._async_recover()
        self._started = True
        for zone in self.config.zones.values():
            self._track_zone(zone)
        self._track_times()
        self._unsubs.append(
            async_track_time_interval(self.hass, self._async_heartbeat, HEARTBEAT_INTERVAL)
        )
        self._track_rain()
        if undecided:
            # en segundo plano: no retrasa los disparos ni el latido (§8.27)
            self._spawn(self._async_recover_rain(undecided), "irrigation_rain_recover")
        if soon:
            self._spawn(self._async_evaluate_lot(soon), "irrigation_rain_soon")
        if not undecided and not soon:
            self._spawn(self.async_refresh_rain(), "irrigation_rain_refresh")

    @callback
    def async_shutdown(self) -> None:
        """Cancela temporizadores. Las válvulas abiertas siguen en el runtime persistido."""
        self._stopping = True
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._untrack_rain()
        for zone_id in list(self._zone_unsubs):
            self._untrack_zone(zone_id)
        self._untrack_times()
        for unsub in self._close_unsubs.values():
            unsub()
        self._close_unsubs.clear()

    async def _async_recover(self) -> tuple[list[BlockRef], list[BlockRef]]:
        """Arranque de HA (03 §5.2)."""
        now = dt_util.utcnow()
        async with self._lock:
            for valve in list(self.runtime.open_valves.values()):
                if now >= valve.ends_at:
                    # 1. excedida: apagar, evento y push alto
                    self._slots.closed(valve.entity_id)
                    ok = await async_set_valve(self.hass, valve.entity_id, turn_on=False)
                    await self._incidents.alert(
                        "overrun_restart",
                        valve.zone_id,
                        valve.entity_id,
                        EVENT_VALVE_OVERRUN,
                        {"zone_id": valve.zone_id, "entity_id": valve.entity_id},
                        minutes=str(round((valve.ends_at - valve.started_at).total_seconds() / 60)),
                    )
                    if not ok:
                        await self._incidents.valve_error(valve.zone_id, valve.entity_id, False)
                else:
                    # 2. en curso: se programa su apagado
                    self._schedule_close(valve)
            # 4. inicios perdidos, detrás de las colas pendientes (3.)
            local_now = dt_util.now()
            zones = self.config.zones
            undecided: list[BlockRef] = []
            if self.runtime.last_alive is not None:
                for when, zone_id, index in missed_blocks(zones.values(), self.runtime.last_alive, local_now):
                    ref = (zone_id, zones[zone_id].start_times[index], when.date())
                    if ref in self.runtime.rain_decisions or not self._needs_rain(zones[zone_id]):
                        # con decisión fijada se respeta sin evaluar (§8.25)
                        self._run_blocks_locked([ref])
                    else:
                        undecided.append(ref)
            # su T−10 pasó con HA parado: se evalúan ya, sin esperar a las fuentes (§8.24)
            soon: list[BlockRef] = []
            for when, zone_id, index in missed_blocks(
                zones.values(), local_now, local_now + timedelta(minutes=RAIN_EVAL_LEAD_MIN)
            ):
                ref = (zone_id, zones[zone_id].start_times[index], when.date())
                if ref not in self.runtime.rain_decisions and self._needs_rain(zones[zone_id]):
                    soon.append(ref)
            self.runtime.purge_decisions(local_now)
            self.runtime.last_alive = now
            await self._async_persist_locked()
            await self._async_dispatch_locked()
        return undecided, soon

    async def _async_heartbeat(self, _now: datetime) -> None:
        """Latido (03 §5.1) y vigilancia de tiempos (03 §5.3)."""
        now = dt_util.utcnow()
        async with self._lock:
            self.runtime.last_alive = now
            # decisiones de bloques ya pasados que no se consumieron (§8.23)
            self.runtime.purge_decisions(dt_util.now() - DECISION_PURGE_MARGIN)
            await self._store.async_save_runtime(self.runtime)
            # 1. propias pasadas de tiempo: el temporizador de cierre no ha actuado
            overdue = [
                (valve.zone_id, entity_id)
                for entity_id, valve in list(self.runtime.open_valves.items())
                if now > valve.ends_at + OVERRUN_MARGIN and self._begin_close_locked(entity_id)
            ]
            # 2. encendidas a mano más de su duration_min
            manual = [
                (zone.zone_id, valve.entity_id, valve.duration_min)
                for zone, valve, since in self._manual_on()
                if now > self._manual_ends(valve, since) + OVERRUN_MARGIN
            ]
            self._slots.begin_manual_close(entity_id for _zone_id, entity_id, _minutes in manual)
        if not overdue and not manual:
            return
        await asyncio.gather(
            *(self._async_finish_close(entity_id) for _zone_id, entity_id in overdue),
            *(self._async_close_manual(zone_id, entity_id) for zone_id, entity_id, _m in manual),
        )
        for zone_id, entity_id in overdue:
            await self._incidents.alert(
                "overrun_running",
                zone_id,
                entity_id,
                EVENT_VALVE_OVERRUN,
                {"zone_id": zone_id, "entity_id": entity_id},
            )
        for zone_id, entity_id, minutes in manual:
            await self._incidents.alert(
                "manual_overrun",
                zone_id,
                entity_id,
                EVENT_VALVE_OVERRUN,
                {"zone_id": zone_id, "entity_id": entity_id, "manual": True},
                minutes=str(minutes),
            )

    # ---------- disparos y sensores ----------

    def _track_zone(self, zone: Zone) -> None:
        """(Re)registra la vigilancia de sensores y válvulas de la zona."""
        self._untrack_zone(zone.zone_id)
        unsubs: list[CALLBACK_TYPE] = []
        sensor_ids = [entity_id for entity_id in zone.sensors.values() if entity_id]
        if sensor_ids:
            unsubs.append(
                async_track_state_change_event(
                    self.hass, sensor_ids, partial(self._async_sensor_changed, zone.zone_id)
                )
            )
        valve_ids = [valve.entity_id for valve in zone.valves]
        if valve_ids:
            # manual_on del snapshot depende del estado de las switch
            unsubs.append(
                async_track_state_change_event(self.hass, valve_ids, self._async_valve_state_changed)
            )
        # sensor de suministro: uno por válvula, con su switch fija en el callback (spec no_water §1.4)
        for valve in zone.valves:
            if valve.supply_sensor:
                unsubs.append(
                    async_track_state_change_event(
                        self.hass,
                        [valve.supply_sensor],
                        partial(self._async_supply_changed, valve.entity_id),
                    )
                )
        self._zone_unsubs[zone.zone_id] = unsubs
        # ya encendidas a mano: arranque de HA o zona guardada con otro duration_min (03 §5.3.2)
        for manual_zone, valve, since in self._manual_on():
            if manual_zone.zone_id == zone.zone_id:
                self._track_manual(zone.zone_id, valve, since)

    def _untrack_zone(self, zone_id: str) -> None:
        for unsub in self._zone_unsubs.pop(zone_id, []):
            unsub()

    def _track_times(self) -> None:
        """Un disparador por hora de inicio distinta, a T−10 y a T (§8.11, §8.16)."""
        self._untrack_times()
        starts = sorted({start for zone in self.config.zones.values() for start in zone.start_times})
        for start in starts:
            hour, minute = (int(part) for part in start.split(":"))
            eval_hour, eval_minute = divmod((hour * 60 + minute - RAIN_EVAL_LEAD_MIN) % (24 * 60), 60)
            self._time_unsubs.append(
                async_track_time_change(
                    self.hass, partial(self._async_block_fired, start), hour=hour, minute=minute, second=0
                )
            )
            self._time_unsubs.append(
                async_track_time_change(
                    self.hass,
                    partial(self._async_rain_eval_fired, start),
                    hour=eval_hour,
                    minute=eval_minute,
                    second=0,
                )
            )

    def _untrack_times(self) -> None:
        for unsub in self._time_unsubs:
            unsub()
        self._time_unsubs.clear()

    async def _async_block_fired(self, start: str, now: datetime) -> None:
        """Hora del bloque (03 §2): riega según la decisión fijada (§8.16).

        Sin decisión (bloque creado o cambiado con menos de 10 min, o decisión anulada, §8.22),
        las zonas que la necesitan se evalúan ahora como un lote.
        """
        day = dt_util.as_local(now).date()
        refs: list[BlockRef] = [
            (zone.zone_id, start, day) for zone in blocks_at(self.config.zones.values(), start, day)
        ]
        if not refs:
            return
        undecided = [
            ref
            for ref in refs
            if ref not in self.runtime.rain_decisions and self._needs_rain(self.config.zones[ref[0]])
        ]
        if undecided:
            await self._async_evaluate_lot(undecided)
        async with self._lock:
            # el latido se adelanta para no repetir este bloque si HA cae ahora
            self.runtime.last_alive = dt_util.utcnow()
            self._run_blocks_locked(refs)
            await self._async_persist_locked()
            await self._async_dispatch_locked()

    async def _async_rain_eval_fired(self, start: str, now: datetime) -> None:
        """T−10 (§8.16): decide el lote de esa hora y fija la decisión."""
        day = block_day(start, dt_util.as_local(now))
        refs: list[BlockRef] = [
            (zone.zone_id, start, day)
            for zone in blocks_at(self.config.zones.values(), start, day)
            if self._needs_rain(zone)
        ]
        if refs:
            await self._async_evaluate_lot(refs)

    async def _async_sensor_changed(self, zone_id: str, event: Event[EventStateChangedData]) -> None:
        """Alerta sensor_unavailable al pasar un sensor de zona a unavailable/unknown (03 §7.2)."""
        bad = (STATE_UNAVAILABLE, STATE_UNKNOWN)
        new_state = event.data["new_state"]
        old_state = event.data["old_state"]
        if new_state is None or new_state.state not in bad:
            return
        if old_state is not None and old_state.state in bad:
            return
        await self._incidents.alert(
            "sensor_unavailable",
            zone_id,
            new_state.entity_id,
            EVENT_SENSOR_UNAVAILABLE,
            {"zone_id": zone_id, "entity_id": new_state.entity_id, "state": new_state.state},
        )

    @callback
    def _async_valve_state_changed(self, event: Event[EventStateChangedData]) -> None:
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        old_state = event.data["old_state"]
        new_state = event.data["new_state"]
        # push valve_switched: solo off→on y on→off; arranque y unavailable/unknown no avisan
        if old_state is None or new_state is None:
            return
        if {old_state.state, new_state.state} != {STATE_OFF, STATE_ON}:
            return
        entity_id = new_state.entity_id
        if new_state.state == STATE_ON:
            # el origen se lee ya: la integración suelta el origen de la apertura al volver del turn_on
            self._switch_origin[entity_id] = self.valve_origin(entity_id)
            self._spawn(
                self._incidents.push_switched(entity_id, "valve_on", self._switch_origin[entity_id]),
                f"{DOMAIN}_valve_on",
            )
            try:
                zone, valve = self._find_valve(entity_id)
            except ServiceValidationError:
                return
            # encendida fuera de la integración: se apaga al cumplir sus minutos (03 §5.3.2)
            if self._switch_origin[entity_id] == ORIGIN_EXTERNAL:
                self._track_manual(zone.zone_id, valve, new_state.last_changed)
            # abre sin agua: se cierra nada más confirmarse. Si ya se está pausando por el
            # sensor (apertura cancelada o cerrándose), no se repite la alerta
            if (
                not self._slots.is_cancelled(entity_id)
                and not self._slots.is_closing(entity_id)
                and self._supply_on(valve)
            ):
                self._spawn(self._async_no_water(entity_id), f"{DOMAIN}_no_water")
            return
        # sin origen guardado (HA arrancó con la válvula abierta): el push va sin él
        origin = self._switch_origin.pop(entity_id, None)
        seconds = (new_state.last_changed - old_state.last_changed).total_seconds()
        self._spawn(
            self._incidents.push_switched(entity_id, "valve_off", origin, seconds),
            f"{DOMAIN}_valve_off",
        )

    def _supply_on(self, valve: Valve) -> bool:
        """El sensor de suministro de la válvula indica falta de agua."""
        if not valve.supply_sensor:
            return False
        state = self.hass.states.get(valve.supply_sensor)
        return state is not None and state.state == STATE_ON

    @callback
    def _async_supply_changed(self, entity_id: str, event: Event[EventStateChangedData]) -> None:
        # «Sin agua» en la fila sigue al sensor
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        old_state = event.data["old_state"]
        new_state = event.data["new_state"]
        # solo off→on: arranque y vuelta de unavailable/unknown no avisan
        if old_state is None or new_state is None:
            return
        if old_state.state != STATE_OFF or new_state.state != STATE_ON:
            return
        self._spawn(self._async_no_water(entity_id), f"{DOMAIN}_no_water")

    async def _async_no_water(self, entity_id: str) -> None:
        """Falta de agua (spec no_water §1.4): cierra la válvula si riega y avisa."""
        try:
            zone, _valve = self._find_valve(entity_id)
        except ServiceValidationError:
            # la válvula se quitó de la configuración entre el cambio de estado y la acción
            return
        state = self.hass.states.get(entity_id)
        closed = (
            entity_id in self.runtime.open_valves
            or (entity_id in self._slots.reserved() and not self._slots.is_cancelled(entity_id))
            or (state is not None and state.state == STATE_ON)
        )
        if closed:
            # mismo camino que ⏸: corta reintentos, libera el hueco y la cola sigue.
            # Si el apagado falla, salta turn_off_failed y esta alerta se envía igual
            await self.async_pause_valve(entity_id)
        await self._incidents.alert(
            "no_water",
            zone.zone_id,
            entity_id,
            EVENT_NO_WATER,
            {"zone_id": zone.zone_id, "entity_id": entity_id, "closed": closed},
            kind="no_water_closed" if closed else "no_water",
        )

    # ---------- lluvia (05-rain-skip.md §8) ----------

    def rain_configured(self) -> bool:
        settings = self.config.settings
        return bool(settings.rain_sensor or settings.weather_entity)

    def _track_rain(self) -> None:
        """(Re)registra el recálculo horario y el seguimiento del pluviómetro (§8.9, §8.27)."""
        self._untrack_rain()
        if not self.rain_configured():
            return
        self._rain_unsubs.append(
            async_track_time_interval(self.hass, self._async_rain_tick, RAIN_REFRESH_INTERVAL)
        )
        if sensor := self.config.settings.rain_sensor:
            self._rain_unsubs.append(
                async_track_state_change_event(self.hass, [sensor], self._async_rain_sensor_changed)
            )

    def _untrack_rain(self) -> None:
        for unsub in self._rain_unsubs:
            unsub()
        self._rain_unsubs.clear()
        if self._rain_debounce is not None:
            self._rain_debounce()
            self._rain_debounce = None

    @callback
    def _async_rain_sensor_changed(self, _event: Event[EventStateChangedData]) -> None:
        # una ráfaga de cambios da un solo recálculo (§8.27)
        if self._rain_debounce is not None:
            self._rain_debounce()
        self._rain_debounce = async_call_later(self.hass, RAIN_DEBOUNCE_S, self._async_rain_debounced)

    async def _async_rain_debounced(self, _now: datetime) -> None:
        self._rain_debounce = None
        await self.async_refresh_rain()

    async def _async_rain_tick(self, _now: datetime) -> None:
        await self.async_refresh_rain()

    async def async_refresh_rain(self) -> RainState:
        """Recalcula el estado de lluvia (§8.9): una consulta por fuente, compartida por las zonas.

        No dispara alertas: rain_source_unavailable solo sale al evaluar un lote (§8.2).
        """
        async with self._rain_lock:
            settings = self.config.settings
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
            self.rain = RainState(
                past_configured=settings.rain_sensor is not None,
                forecast_configured=settings.weather_entity is not None,
                past_mm=past_mm,
                forecast_mm=forecast_mm,
                forecast=tuple(slots) if slots is not None else None,
                past_error=past_error,
                forecast_error=forecast_error,
            )
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        return self.rain

    def _needs_rain(self, zone: Zone) -> bool:
        """La zona se evalúa por lluvia: «Omitir por lluvia» y alguna fuente configurada."""
        return zone.rain_skip and self.rain_configured()

    async def _async_recover_rain(self, refs: list[BlockRef]) -> None:
        """Lote de bloques perdidos sin decisión (§8.15).

        Si alguna fuente configurada falla, reintenta cada 30 s durante 5 min como máximo;
        después decide con §6. Corre en segundo plano (§8.27).
        """
        deadline = dt_util.utcnow() + RAIN_STARTUP_MAX
        state = await self.async_refresh_rain()
        while state.failures() and dt_util.utcnow() < deadline and not self._stopping:
            await asyncio.sleep(RAIN_STARTUP_RETRY_S)
            state = await self.async_refresh_rain()
        if self._stopping:
            return
        await self._async_evaluate_lot(refs, state)
        async with self._lock:
            self._run_blocks_locked(refs)
            await self._async_persist_locked()
            await self._async_dispatch_locked()

    async def _async_evaluate_lot(self, refs: list[BlockRef], state: RainState | None = None) -> None:
        """Decide un lote (§8.11) y fija cada decisión (§8.16).

        Emite rain_skipped por bloque omitido, un push con las zonas que abren episodio
        (§8.19, §8.20) y rain_source_unavailable una vez por lote (§8.2).
        `state`: estado ya calculado (arranque, §8.15); si falta, se recalcula ahora.
        """
        if state is None:
            state = await self.async_refresh_rain()
        settings = self.config.settings
        # ventana global: la misma decisión para todas las zonas del lote (§8.17)
        verdict = decide(settings, state.past_mm, state.forecast_mm)
        now = dt_util.utcnow()
        evaluated = False
        skipped: list[BlockRef] = []
        opened: list[tuple[Zone, str]] = []
        async with self._lock:
            for zone_id, start, day in refs:
                zone = self.config.zones.get(zone_id)
                # la zona puede haber cambiado durante el recálculo
                if zone is None or not self._needs_rain(zone):
                    continue
                evaluated = True
                self.runtime.rain_decisions[(zone_id, start, day)] = RainDecision(
                    zone_id, start, day, verdict.skip, verdict.reason, round_mm(verdict.rain_mm)
                )
                episode = self.runtime.rain_episodes.get(zone_id)
                if episode is not None and now - episode > RAIN_EPISODE_MAX:
                    # caducado: se cierra antes de decidir (§8.14)
                    del self.runtime.rain_episodes[zone_id]
                    episode = None
                if verdict.skip:
                    skipped.append((zone_id, start, day))
                    if episode is None:
                        self.runtime.rain_episodes[zone_id] = now
                        opened.append((zone, start))
                elif not verdict.sources_failed:
                    # riega porque la lluvia no llega al umbral: cierra (§8.19)
                    self.runtime.rain_episodes.pop(zone_id, None)
            await self._async_persist_locked()
        for zone_id, start, day in skipped:
            await self._incidents.alert(
                "rain_skipped",
                zone_id,
                None,
                EVENT_BLOCK_SKIPPED,
                {
                    "zone_id": zone_id,
                    "start_time": start,
                    "date": day.isoformat(),
                    "reason": verdict.reason,
                    "rain_mm": round_mm(verdict.rain_mm),
                    "past_mm": round_mm(state.past_mm),
                    "forecast_mm": round_mm(state.forecast_mm),
                },
                push=False,
            )
        if opened:
            await self._incidents.push_rain_skipped(opened, verdict.reason or "", verdict.rain_mm or 0.0)
        if evaluated and state.failures():
            await self._incidents.rain_source_alert(state)

    # ---------- colas y válvulas ----------

    def _enqueue_block_locked(self, zone: Zone, index: int) -> None:
        for valve in valves_for_block(zone, index):
            self._slots.enqueue(
                zone.zone_id, valve.entity_id, valve.duration_min * 60, origin=ORIGIN_SCHEDULED
            )

    def _run_blocks_locked(self, refs: list[BlockRef]) -> None:
        """Requiere el lock. Encola cada bloque salvo los omitidos y consume su decisión (§8.16, §8.25)."""
        for zone_id, start, day in refs:
            decision = self.runtime.rain_decisions.pop((zone_id, start, day), None)
            zone = self.config.zones.get(zone_id)
            if zone is None or start not in zone.start_times or (decision is not None and decision.skip):
                continue
            self._enqueue_block_locked(zone, zone.start_times.index(start))

    async def _async_dispatch_locked(self) -> None:
        """Arranca trabajos con hueco en zona y global (03 §3). Requiere el lock.

        No hace I/O de switch: solo reserva el hueco (ValveSlots) y lanza la apertura
        real en una tarea aparte, fuera del lock. Una sola pasada: cada apertura, al
        terminar, vuelve a llamar aquí para encadenar la siguiente.
        """
        limits = {zone_id: zone.max_simultaneous for zone_id, zone in self.config.zones.items()}
        jobs = self._slots.startable(limits, self.config.settings.global_max_valves)
        if not jobs:
            return
        for job in jobs:
            # reserva y lanza uno a uno, en el mismo orden que antes
            self._slots.reserve(job)
            self._spawn(self._async_open_job(job), f"irrigation_open_{job.entity_id}")
        await self._async_persist_locked()

    async def _async_open_job(self, job: Job) -> None:
        """Enciende una válvula fuera del lock; el hueco ya está reservado en ValveSlots.

        Si se canceló mientras abría (stop/borrado de zona), se reutiliza el flujo de
        cierre para no soltar el hueco antes de tiempo: la válvula sigue ocupando su
        sitio hasta que `_async_finish_close` la apaga y libera.
        """
        ok = await async_set_valve(
            self.hass, job.entity_id, turn_on=True, cancelled=lambda: self._slots.is_cancelled(job.entity_id)
        )
        cancelled = False
        closing = False
        async with self._lock:
            cancelled = self._slots.finish_opening(job.entity_id)
            if ok:
                self._mark_open_locked(job)
                if cancelled:
                    closing = self._begin_close_locked(job.entity_id)
            await self._async_persist_locked()
            if not self._stopping and not (ok and cancelled):
                await self._async_dispatch_locked()
        if ok and cancelled and closing:
            await self._async_finish_close(job.entity_id)
        # pausada mientras reintentaba: la pausa es del usuario, no es un fallo
        elif not ok and not cancelled:
            await self._incidents.valve_error(job.zone_id, job.entity_id, True)

    def _mark_open_locked(self, job: Job) -> None:
        """Requiere el lock. Registra la válvula abierta y, si procede, programa su cierre."""
        valve = self._slots.opened(job, dt_util.utcnow())
        if not self._stopping:
            self._schedule_close(valve)

    def _schedule_close(self, valve: OpenValve) -> None:
        self._close_unsubs[valve.entity_id] = async_track_point_in_utc_time(
            self.hass, partial(self._async_close_due, valve.entity_id), valve.ends_at
        )

    async def _async_close_due(self, entity_id: str, _now: datetime) -> None:
        async with self._lock:
            self._close_unsubs.pop(entity_id, None)
            started = self._begin_close_locked(entity_id)
        if started:
            await self._async_finish_close(entity_id)

    def _begin_close_locked(self, entity_id: str) -> bool:
        """Requiere el lock. Marca la válvula como cerrándose; sigue en `open_valves`."""
        if not self._slots.begin_close(entity_id):
            return False
        # antes se quitaba el temporizador y luego se marcaba; sin await en medio, es igual
        if unsub := self._close_unsubs.pop(entity_id, None):
            unsub()
        return True

    async def _async_finish_close(self, entity_id: str) -> bool:
        """Apaga la switch fuera del lock y libera el hueco al terminar."""
        ok = await async_set_valve(self.hass, entity_id, turn_on=False)
        valve = None
        async with self._lock:
            valve = self._slots.closed(entity_id)
            await self._async_persist_locked()
            if not self._stopping:
                await self._async_dispatch_locked()
        if not ok and valve is not None:
            # se libera el hueco igualmente; el push crítico avisa (decisión del plan)
            await self._incidents.valve_error(valve.zone_id, entity_id, False)
        return ok

    def _manual_on(self) -> list[tuple[Zone, Valve, datetime]]:
        """Switch configuradas encendidas a mano: en `on` y fuera de la gestión propia (03 §5.3)."""
        busy = self._slots.busy()
        result: list[tuple[Zone, Valve, datetime]] = []
        for zone in self.config.zones.values():
            for valve in zone.valves:
                if valve.entity_id in busy:
                    continue
                state = self.hass.states.get(valve.entity_id)
                if state is not None and state.state == STATE_ON:
                    result.append((zone, valve, state.last_changed))
        return result

    def _manual_ends(self, valve: Valve, since: datetime) -> datetime:
        """Fin de una switch encendida a mano: su último paso a on + duration_min (03 §5.3.2)."""
        return since + timedelta(minutes=valve.duration_min)

    def _track_manual(self, zone_id: str, valve: Valve, since: datetime) -> None:
        """Programa el apagado a su hora; se cancela con la vigilancia de la zona (_untrack_zone)."""
        self._zone_unsubs.setdefault(zone_id, []).append(
            async_track_point_in_utc_time(
                self.hass,
                partial(self._async_manual_due, valve.entity_id),
                self._manual_ends(valve, since),
            )
        )

    async def _async_manual_due(self, entity_id: str, due: datetime) -> None:
        """Apaga la switch encendida a mano al cumplir su duration_min (03 §5.3.2)."""
        async with self._lock:
            found = next(
                (item for item in self._manual_on() if item[1].entity_id == entity_id), None
            )
            # ya apagada o gestionada por la integración
            if found is None:
                return
            zone, valve, since = found
            # temporizador de un encendido anterior: el actual tiene el suyo. Se compara con la
            # hora programada, no con utcnow, para no descartar un disparo milisegundos antes
            if due < self._manual_ends(valve, since):
                return
            self._slots.begin_manual_close([entity_id])
        await self._async_close_manual(zone.zone_id, entity_id)

    async def _async_close_manual(self, zone_id: str, entity_id: str) -> bool:
        """Apaga una switch encendida a mano. Debe estar ya marcada como cerrándose; no ocupa hueco."""
        ok = await async_set_valve(self.hass, entity_id, turn_on=False)
        async with self._lock:
            self._slots.end_manual_close(entity_id)
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        if not ok:
            await self._incidents.valve_error(zone_id, entity_id, False)
        return ok

    async def _async_persist_locked(self) -> None:
        """Requiere el lock. Cierra los lotes terminados, guarda el runtime y avisa."""
        self._slots.prune_batches(self.config.zones)
        await self._store.async_save_runtime(self.runtime)
        async_dispatcher_send(self.hass, SIGNAL_STATE)

    # ---------- configuración ----------

    def _get_zone(self, zone_id: str) -> Zone:
        if (zone := self.config.zones.get(zone_id)) is None:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="unknown_zone",
                translation_placeholders={"zone_id": zone_id},
            )
        return zone

    def _find_valve(self, entity_id: str) -> tuple[Zone, Valve]:
        if (found := self._incidents.find_valve(entity_id)) is not None:
            return found
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="unknown_valve",
            translation_placeholders={"entity_id": entity_id},
        )

    async def async_save_zone(self, data: dict[str, Any]) -> tuple[Zone | None, list[Issue]]:
        """Alta (sin zone_id) o edición de una zona. Valida V1–V14."""
        is_new = not data.get("zone_id")
        if is_new:
            data = {**data, "zone_id": uuid4().hex}
        else:
            self._get_zone(data["zone_id"])
        zone = Zone.from_dict(data)
        if issues := validate_zone(zone, self.config):
            return None, issues
        zone.start_times.sort()
        for valve in zone.valves:
            valve.start_times.sort()
        async with self._lock:
            previous = self.config.zones.get(zone.zone_id)
            kept = {valve.entity_id for valve in zone.valves}
            removed = {v.entity_id for v in previous.valves} - kept if previous else set()
            self.config.zones[zone.zone_id] = zone
            # guardar la zona anula su decisión fijada: el bloque se evalúa a su hora (§8.22)
            self.runtime.drop_decisions(zone.zone_id)
            if not zone.rain_skip:
                self.runtime.rain_episodes.pop(zone.zone_id, None)
            await self._store.async_save_config(self.config)
            # trabajos de válvulas que ya no están en la zona
            self._slots.drop_pending(lambda job: job.zone_id != zone.zone_id or job.entity_id in kept)
            await self._async_persist_locked()
            # la simultaneidad puede haber subido
            await self._async_dispatch_locked()
        if self._started:
            self._track_zone(zone)
            self._track_times()
        self._remove_valve_entities(zone.zone_id, removed)
        if is_new:
            async_dispatcher_send(self.hass, SIGNAL_ZONE_ADDED, zone.zone_id)
        else:
            self._rename_device(zone)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        return zone, []

    async def async_delete_zone(self, zone_id: str) -> None:
        """Detiene la zona y la borra solo si todo apagó (docs/alerts/spec.md §2)."""
        zone = self._get_zone(zone_id)
        names = {valve.entity_id: valve.name for valve in zone.valves}
        failed = await self._async_pause(lambda job_zone, _entity: job_zone == zone_id)
        if failed:
            # la zona se queda: la entidad event de cada válvula ya tiene su turn_off_failed
            raise ZoneDeleteError(ZONE_DELETE_VALVES_ON, [names.get(e, e) for e in failed])
        async with self._lock:
            # una apertura en curso o un bloque disparado durante el apagado
            busy = [e for e, valve in self.runtime.open_valves.items() if valve.zone_id == zone_id]
            busy += [e for e, opening_zone in self._slots.reserved().items() if opening_zone == zone_id]
            if busy:
                raise ZoneDeleteError(ZONE_DELETE_BUSY, [names.get(e, e) for e in busy])
            self._slots.drop_pending(lambda job: job.zone_id != zone_id)
            self.runtime.drop_decisions(zone_id)
            self.runtime.rain_episodes.pop(zone_id, None)
            del self.config.zones[zone_id]
            await self._store.async_save_config(self.config)
            await self._async_persist_locked()
            await self._async_dispatch_locked()
        self._untrack_zone(zone_id)
        if self._started:
            self._track_times()
        self._remove_zone_entities(zone_id)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)

    async def async_save_settings(
        self, data: dict[str, Any]
    ) -> tuple[Settings | None, list[Issue]]:
        settings = Settings.from_dict({**self.config.settings.to_dict(), **data})
        if issues := validate_settings(settings):
            return None, issues
        async with self._lock:
            self.config.settings = settings
            if not self.rain_configured():
                # sin fuentes: cierran los episodios y los bloques ya decididos riegan (§8.14, §8.22)
                self.runtime.rain_episodes.clear()
                self.runtime.rain_decisions.clear()
                await self._async_persist_locked()
            await self._store.async_save_config(self.config)
            # el límite global puede haber subido
            await self._async_dispatch_locked()
        self._remove_rain_entities()
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        if self._started:
            # las fuentes pueden haber cambiado
            self._track_rain()
            self._spawn(self.async_refresh_rain(), "irrigation_rain_refresh")
        return settings, []

    async def async_set_zone_option(self, zone_id: str, key: str, value: Any) -> None:
        """Cambios desde entidades: enabled, rain_skip y mode."""
        if key not in ZONE_OPTIONS:
            raise ValueError(key)
        if key == "enabled":
            # apagar la zona por cualquier vía la pausa (02 §7)
            await self.async_set_zone_enabled(zone_id, bool(value))
            return
        zone = self._get_zone(zone_id)
        if key == "mode":
            if value not in MODES:
                raise ValueError(value)
            if value == MODE_AUTO and zone.calc_method is None:
                raise ServiceValidationError(
                    translation_domain=DOMAIN, translation_key="auto_unavailable"
                )
        async with self._lock:
            setattr(zone, key, value)
            self.runtime.drop_decisions(zone_id)
            if key == "rain_skip" and not value:
                self.runtime.rain_episodes.pop(zone_id, None)
            await self._store.async_save_config(self.config)
            await self._async_persist_locked()
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)

    def _rename_device(self, zone: Zone) -> None:
        registry = dr.async_get(self.hass)
        if device := registry.async_get_device(identifiers={(DOMAIN, zone.zone_id)}):
            registry.async_update_device(device.id, name=zone.name)

    def _remove_zone_entities(self, zone_id: str) -> None:
        entities = er.async_get(self.hass)
        for entry in er.async_entries_for_config_entry(entities, self.entry_id):
            if entry.unique_id.startswith(f"{zone_id}_"):
                self._remove_entity(entry.entity_id)
        devices = dr.async_get(self.hass)
        if device := devices.async_get_device(identifiers={(DOMAIN, zone_id)}):
            devices.async_remove_device(device.id)

    def _remove_valve_entities(self, zone_id: str, entity_ids: set[str]) -> None:
        """Quita el event y el sensor «Modo riego» de las válvulas que salen de la zona (decisión 4)."""
        entities = er.async_get(self.hass)
        for entity_id in entity_ids:
            for domain, key in (("event", "valve_alerts"), ("sensor", "valve_mode")):
                unique_id = valve_uid(zone_id, key, entity_id)
                if registry_id := entities.async_get_entity_id(domain, DOMAIN, unique_id):
                    self._remove_entity(registry_id)

    def _remove_rain_entities(self) -> None:
        """Quita las entidades de lluvia de las fuentes que ya no están configuradas (§8.28)."""
        settings = self.config.settings
        unused: list[tuple[str, str]] = []
        if settings.rain_sensor is None:
            unused.append(("sensor", installation_uid("rain_past")))
        if settings.weather_entity is None:
            unused.append(("sensor", installation_uid("rain_forecast")))
        if not self.rain_configured():
            unused += [("binary_sensor", zone_uid(zone_id, "rain_skip_next")) for zone_id in self.config.zones]
        entities = er.async_get(self.hass)
        for domain, unique_id in unused:
            if registry_id := entities.async_get_entity_id(domain, DOMAIN, unique_id):
                self._remove_entity(registry_id)

    def _remove_entity(self, registry_id: str) -> None:
        """Borra la entidad del registro."""
        er.async_get(self.hass).async_remove(registry_id)

    # ---------- controles manuales (03 §4) ----------

    async def async_run_zone(self, zone_id: str) -> None:
        """Cada válvula habilitada de la zona, con o sin bloques; respeta zona y global."""
        zone = self._get_zone(zone_id)
        if not zone.enabled:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="zone_stopped",
                translation_placeholders={"zone": zone.name},
            )
        async with self._lock:
            for valve in zone.valves:
                if valve.enabled:
                    self._slots.enqueue(
                        zone_id, valve.entity_id, valve.duration_min * 60, origin=ORIGIN_MANUAL
                    )
            await self._async_persist_locked()
            await self._async_dispatch_locked()

    async def async_run_valve(self, entity_id: str, minutes: int | None = None) -> None:
        """Una válvula durante X min (por defecto su duration_min); solo respeta el global."""
        zone, valve = self._find_valve(entity_id)
        if not valve.enabled:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="valve_stopped",
                translation_placeholders={"valve": valve.name},
            )
        duration_s = (minutes or valve.duration_min) * 60
        async with self._lock:
            self._slots.enqueue(
                zone.zone_id, entity_id, duration_s, origin=ORIGIN_MANUAL, zone_limit=False
            )
            await self._async_persist_locked()
            await self._async_dispatch_locked()

    async def _async_pause(self, match: Callable[[str, str], bool]) -> list[str]:
        """Pausar (03 §4): vacía la cola y apaga lo abierto, lo que abre y lo encendido a mano.

        `match(zone_id, entity_id)` elige las válvulas afectadas. Los bloques posteriores siguen.
        Devuelve las switch que no apagaron; su turn_off_failed ya ha saltado.
        """
        async with self._lock:
            # cola fuera, abiertas empiezan a cerrarse y aperturas en curso quedan canceladas
            closing = self._slots.cancel(match)
            # temporizadores de cierre: antes se quitaban dentro de _begin_close_locked, ahora
            # justo después, sin await en medio
            for entity_id in closing:
                if unsub := self._close_unsubs.pop(entity_id, None):
                    unsub()
            manual = [
                (zone.zone_id, valve.entity_id)
                for zone, valve, _since in self._manual_on()
                if match(zone.zone_id, valve.entity_id)
            ]
            self._slots.begin_manual_close(entity_id for _zone_id, entity_id in manual)
            await self._async_persist_locked()
            if not closing:
                # el hueco liberado puede dar paso a otros trabajos
                await self._async_dispatch_locked()
        results = await asyncio.gather(
            *(self._async_finish_close(entity_id) for entity_id in closing),
            *(self._async_close_manual(zone_id, entity_id) for zone_id, entity_id in manual),
        )
        entity_ids = [*closing, *(entity_id for _zone_id, entity_id in manual)]
        return [entity_id for entity_id, ok in zip(entity_ids, results, strict=True) if not ok]

    async def async_stop(self, zone_id: str | None = None) -> None:
        """Sin zona: pausar todo. Con zona: pausar cada válvula de la zona (03 §4)."""
        if zone_id is not None:
            self._get_zone(zone_id)
        await self._async_pause(lambda job_zone, _entity: zone_id is None or job_zone == zone_id)

    async def async_pause_valve(self, entity_id: str) -> None:
        """Anula lo ya disparado de una válvula; los bloques posteriores siguen (03 §4)."""
        self._find_valve(entity_id)
        await self._async_pause(lambda _zone, entity: entity == entity_id)

    async def async_set_valve_enabled(self, entity_id: str, enabled: bool) -> None:
        """■ detiene la válvula (pausa + enabled=false); ▶ la reactiva sin regar (03 §4)."""
        _zone, valve = self._find_valve(entity_id)
        valve.enabled = enabled
        await self._store.async_save_config(self.config)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        if not enabled:
            await self.async_pause_valve(entity_id)

    async def async_set_zone_enabled(self, zone_id: str, enabled: bool) -> None:
        """■ de zona o switch «Habilitada»: detiene y pausa la zona; no toca sus válvulas (03 §4)."""
        zone = self._get_zone(zone_id)
        async with self._lock:
            zone.enabled = enabled
            self.runtime.drop_decisions(zone_id)
            await self._store.async_save_config(self.config)
            await self._async_persist_locked()
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        if not enabled:
            await self.async_stop(zone_id)

    # ---------- estado para entidades y WebSocket ----------

    def zone_status(self, zone_id: str) -> str:
        # una apertura ya pausada no cuenta: aún ocupa hueco, pero la zona sale del «Regando»
        opening = self._slots.visible_opening().values()
        if any(valve.zone_id == zone_id for valve in self.runtime.open_valves.values()) or (
            zone_id in opening
        ):
            return STATUS_RUNNING
        if any(job.zone_id == zone_id for job in self.runtime.pending):
            return STATUS_QUEUED
        return STATUS_IDLE

    def _skip_decided(self, zone_id: str, when: datetime) -> bool:
        decision = self.runtime.rain_decisions.get((zone_id, when.strftime("%H:%M"), when.date()))
        return decision is not None and decision.skip

    def _zone_plan(self, zone_id: str) -> tuple[ZoneOutlook | None, datetime | None]:
        """(P con su predicción o decisión, próximo riego a mostrar) (§8.21)."""
        zone = self.config.zones.get(zone_id)
        if zone is None:
            return None, None
        now = dt_util.now()
        # P: el primer bloque sin decisión fijada «omitir»
        blocks = (when for when in upcoming_blocks(zone, now) if not self._skip_decided(zone_id, when))
        first = next(blocks, None)
        if first is None:
            return None, None
        outlook = self._outlook(zone, first, now)
        if outlook is not None and outlook.verdict.skip:
            # el bloque siguiente a P se muestra tal cual, sin predecir
            return outlook, next(blocks, None)
        return outlook, first

    def _outlook(self, zone: Zone, when: datetime, now: datetime) -> ZoneOutlook | None:
        if not self._needs_rain(zone):
            return None
        decision = self.runtime.rain_decisions.get((zone.zone_id, when.strftime("%H:%M"), when.date()))
        if decision is not None:
            return ZoneOutlook(when, Verdict(decision.skip, decision.reason, decision.rain_mm), predicted=False)
        # la ventana que usará P: desde su T−10; si ya pasó, desde ahora (se evaluará a su hora)
        evaluate_at = max(when - timedelta(minutes=RAIN_EVAL_LEAD_MIN), now)
        verdict = predict(self.rain, self.config.settings, evaluate_at)
        return None if verdict is None else ZoneOutlook(when, verdict, predicted=True)

    def zone_rain_outlook(self, zone_id: str) -> ZoneOutlook | None:
        return self._zone_plan(zone_id)[0]

    def zone_next_run(self, zone_id: str) -> datetime | None:
        return self._zone_plan(zone_id)[1]

    def rain_unit(self) -> str:
        # unidad de precipitación del sistema de HA (util/unit_system.py:90)
        return self.hass.config.units.accumulated_precipitation_unit

    def active_valves(self) -> int:
        return len(self.runtime.open_valves)

    def _registry_id(self, domain: str, unique_id: str) -> str | None:
        """entity_id de una entidad propia en el registro; None si aún no existe."""
        return er.async_get(self.hass).async_get_entity_id(domain, DOMAIN, unique_id)

    def _history_entities(self, zone: Zone) -> dict[str, Any]:
        """Entidades que lee la tarjeta de histórico: event de la zona; sensor y event por válvula."""
        return {
            "alerts": self._registry_id("event", zone_uid(zone.zone_id, "alerts")),
            "valves": {
                valve.entity_id: {
                    "mode": self._registry_id("sensor", valve_uid(zone.zone_id, "valve_mode", valve.entity_id)),
                    "alerts": self._registry_id("event", valve_uid(zone.zone_id, "valve_alerts", valve.entity_id)),
                }
                for valve in zone.valves
            },
        }

    def valve_origin(self, entity_id: str) -> str:
        """Origen del riego de una switch configurada; estado del sensor «Modo riego».

        Abierta o abriéndose por la integración: el origen de su trabajo. Encendida fuera de
        la gestión propia (a mano o tras un turn_off fallido): external. Si no, idle.
        """
        if valve := self.runtime.open_valves.get(entity_id):
            return valve.origin
        if origin := self._slots.origin(entity_id):
            return origin
        state = self.hass.states.get(entity_id)
        return ORIGIN_EXTERNAL if state is not None and state.state == STATE_ON else ORIGIN_IDLE

    def snapshot(self) -> dict[str, Any]:
        batch_ends = estimate_batch_ends(
            self.runtime,
            {zone_id: zone.max_simultaneous for zone_id, zone in self.config.zones.items()},
            self.config.settings.global_max_valves,
            dt_util.utcnow(),
            opening=self._slots.durations(),
        )
        zones = []
        for zone in self.config.zones.values():
            upcoming = self.zone_next_run(zone.zone_id)
            batch_start = self.runtime.batch_started.get(zone.zone_id)
            batch_end = batch_ends.get(zone.zone_id) if batch_start else None
            zones.append(
                {
                    **zone.to_dict(),
                    "status": self.zone_status(zone.zone_id),
                    "next_run": upcoming.isoformat() if upcoming else None,
                    # lote en curso: primera apertura y fin estimado con la cola
                    "batch_started_at": batch_start.isoformat() if batch_start else None,
                    "batch_ends_at": batch_end.isoformat() if batch_end else None,
                    # entity_id que pide la tarjeta de histórico al recorder
                    "entities": self._history_entities(zone),
                }
            )
        return {
            "settings": self.config.settings.to_dict(),
            "zones": zones,
            "open_valves": [valve.to_dict() for valve in self.runtime.open_valves.values()],
            "pending": [
                {
                    "seq": job.seq,
                    "zone_id": job.zone_id,
                    "entity_id": job.entity_id,
                    "duration_s": job.duration_s,
                }
                for job in sorted(self.runtime.pending, key=lambda item: item.seq)
            ],
            # encendiéndose (con sus reintentos); las ya pausadas no salen
            "opening": [
                {"entity_id": entity_id, "zone_id": zone_id}
                for entity_id, zone_id in self._slots.visible_opening().items()
            ],
            "manual_on": [
                {"entity_id": valve.entity_id, "zone_id": zone.zone_id, "since": since.isoformat()}
                for zone, valve, since in self._manual_on()
            ],
            # válvulas con su sensor de suministro en on (spec no_water §1.5)
            "no_water": [
                {"entity_id": valve.entity_id, "zone_id": zone.zone_id}
                for zone in self.config.zones.values()
                for valve in zone.valves
                if self._supply_on(valve)
            ],
            "installation_alerts": self._registry_id("event", installation_uid("alerts")),
        }
