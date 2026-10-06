"""Orquestador: disparos, colas, válvulas, latido y arranque (03-valves-execution.md)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from functools import partial
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_time,
    async_track_point_in_utc_time,
    async_track_time_interval,
)
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from ..adapters import registry
from ..adapters.store import IrrigationStore
from ..adapters.valves import async_set_valve
from ..const import (
    DECISION_PURGE_MARGIN,
    DOMAIN,
    EVENT_BLOCK_SKIPPED,
    EVENT_NO_WATER,
    EVENT_SENSOR_UNAVAILABLE,
    EVENT_VALVE_OVERRUN,
    HEARTBEAT_INTERVAL,
    ORIGIN_MANUAL,
    ORIGIN_SCHEDULED,
    RAIN_EVAL_LEAD_MIN,
    RAIN_STARTUP_MAX,
    RAIN_STARTUP_RETRY_S,
    SHUTDOWN_CLOSE_TIMEOUT_S,
    SHUTDOWN_LOCK_TIMEOUT_S,
    SIGNAL_CONFIG,
    SIGNAL_STATE,
    SIGNAL_ZONE_ADDED,
    ZONE_DELETE_BUSY,
    ZONE_DELETE_VALVES_ON,
)
from ..domain.model import Config, Settings, Valve, Zone
from ..domain.rain import RainState, decide, estimated_rain_mm, log_slots, merge_forecast, round_mm
from ..domain.runtime import BlockRef, Job, OpenValve, RuntimeState
from ..domain.schedule import (
    block_day,
    blocks_at,
    in_quiet_hours,
    missed_blocks,
    quiet_active,
    quiet_end_after,
    valves_for_block,
)
from ..domain.validation import Issue
from ..errors import ZoneDeleteError
from . import status
from .close_retry import CloseRetry
from .config_edit import ZONE_OPTIONS, check_zone_option, prepare_settings, prepare_zone, require_zone
from .incidents import Incidents
from .manual import manual_ends, manual_on
from .rain_control import RainControl, ZoneOutlook, apply_verdict_locked
from .slots import ValveSlots
from .triggers import Triggers

_LOGGER = logging.getLogger(__name__)


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
        # oyentes de switches, sensores y horas de inicio; reenvían al manager
        self._triggers = Triggers(hass, self)
        self._close_unsubs: dict[str, CALLBACK_TYPE] = {}
        # temporizador único del fin del horario silencioso (runtime.held_until)
        self._quiet_unsub: CALLBACK_TYPE | None = None
        # evita dos liberaciones a la vez (temporizador, ajustes, arranque)
        self._quiet_ending = False
        # el lock protege solo el estado en memoria (runtime, config); las llamadas a la
        # switch y los push van fuera, en tareas en paralelo; las válvulas en tránsito
        # (abriendo o cerrando) siguen ocupando su hueco de zona y global (ValveSlots)
        self._tasks: set[asyncio.Task] = set()
        self._stopping = False
        # lluvia: estado único, fuentes y su seguimiento (05-rain-skip.md §8.9)
        self._rain = RainControl(hass, lambda: self.config.settings)
        # incidencias: event, bus y push; lee config y unidad por getter
        self._incidents = Incidents(hass, lambda: self.config, self.rain_unit)
        # reintentos de cierre en segundo plano tras un apagado fallido (01-close-retry)
        self._close_retry = CloseRetry(hass, self._incidents)

    @property
    def rain(self) -> RainState:
        """Estado de lluvia único; lo publican las entidades de lluvia."""
        return self._rain.state

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
        if self._stopping:
            # HA empezó a parar durante la recuperación: no se registra nada (02-shutdown-close §5.3)
            return
        self._started = True
        for zone in self.config.zones.values():
            self._triggers.track_zone(zone)
        self._triggers.track_times()
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
        # guardar zona o ajustes ya no vuelve a registrar oyentes ni disparos
        self._started = False
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._untrack_rain()
        for zone_id in self._triggers.zone_ids():
            self._triggers.untrack_zone(zone_id)
        self._triggers.untrack_times()
        for unsub in self._close_unsubs.values():
            unsub()
        self._close_unsubs.clear()
        self._close_retry.cancel_all()
        self._cancel_quiet_end()

    async def async_close_on_stop(self) -> None:
        """Parada ordenada de HA, stage 1 (02-shutdown-close §5): cierra las switch de riego.

        Un intento por switch, en paralelo y con tope de tiempo. Sin avisos: solo log. La cola no
        se toca. Las gestionadas que cierran con tiempo por delante quedan interrumpidas
        (03-remaining-time §4.3); las que fallan siguen en el runtime y las trata el arranque
        (valves-execution §5.2).
        """
        # foto sin await en medio: no espera al lock, que el arranque puede tener cogido
        targets = sorted(
            {
                valve.entity_id
                for zone in self.config.zones.values()
                for valve in zone.valves
                if (state := self.hass.states.get(valve.entity_id)) is not None and state.state != STATE_OFF
            }
            | self._slots.busy()
            | self._close_retry.active()
        )
        # puerta cerrada: sin temporizadores, disparos, oyentes de switch (sin push de encendido o
        # apagado), latido, lluvia, reintentos de cierre ni despacho
        self.async_shutdown()
        if not targets:
            return
        tasks = {
            entity_id: self.hass.async_create_task(
                async_set_valve(self.hass, entity_id, turn_on=False, retries=0),
                f"irrigation_stop_close_{entity_id}",
            )
            for entity_id in targets
        }
        await asyncio.wait(tasks.values(), timeout=SHUTDOWN_CLOSE_TIMEOUT_S)
        closed: list[str] = []
        for entity_id, task in tasks.items():
            if not task.done() or task.cancelled():
                # sin terminar en el tope: se cancela y cuenta como fallo
                task.cancel()
                _LOGGER.warning(
                    "%s no se ha podido cerrar al parar HA: sin respuesta en %s s",
                    entity_id,
                    SHUTDOWN_CLOSE_TIMEOUT_S,
                )
            elif (err := task.exception()) is not None:
                _LOGGER.warning("%s no se ha podido cerrar al parar HA: %s", entity_id, err)
            elif task.result():
                closed.append(entity_id)
                _LOGGER.info("%s cerrada al parar HA", entity_id)
            else:
                _LOGGER.warning("%s no se ha podido cerrar al parar HA", entity_id)
        if not closed:
            # nada que reflejar en el runtime: no se gasta la espera del lock
            return
        try:
            async with asyncio.timeout(SHUTDOWN_LOCK_TIMEOUT_S), self._lock:
                now = dt_util.utcnow()
                for entity_id in closed:
                    # regando: queda interrumpida con lo que le faltaba (03-remaining-time §4.3); a mano,
                    # externa o ya terminando, solo se libera. Las fallidas siguen en open_valves
                    if self._slots.interrupt(entity_id, now) is None:
                        self._slots.closed(entity_id)
                # escritura diferida: con HA aún en marcha se escribe ya; si no, la vuelca stage 3
                await self._async_persist_locked()
        except TimeoutError:
            _LOGGER.warning("Sin lock al parar HA: el runtime no refleja los cierres")

    async def _async_recover(self) -> tuple[list[BlockRef], list[BlockRef]]:
        """Arranque de HA (03 §5.2)."""
        now = dt_util.utcnow()
        async with self._lock:
            # riegos cortados por la parada ordenada: sin la spec 04 no se retoman (03-remaining-time §3)
            for valve in self._slots.drop_interrupted():
                _LOGGER.info(
                    "%s: riego interrumpido por reinicio de HA, faltaban %s min; no se retoma",
                    valve.entity_id,
                    valve.remaining_min,
                )
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
                        await self._async_close_failed(valve.zone_id, valve.entity_id)
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
            # cola retenida por el horario silencioso (quiet-hours §B.4)
            if (held := self.runtime.held_until) is not None:
                if held <= now:
                    # su fin pasó con HA parado: se libera ya, en segundo plano
                    self._spawn(self._async_quiet_end(), "irrigation_quiet_end")
                else:
                    self._schedule_quiet_end()
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
                (zone_id, entity_id)
                for zone_id, entity_id in status.overdue_valves(self.runtime, now)
                if self._begin_close_locked(entity_id)
            ]
            # 2. encendidas a mano más de su duration_min
            manual = status.manual_overdue(self.manual_on(), now)
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
        return self._rain.configured()

    def _track_rain(self) -> None:
        """(Re)registra el recálculo horario y el seguimiento del pluviómetro (§8.9, §8.27)."""
        self._rain.track(self.async_refresh_rain)

    def _untrack_rain(self) -> None:
        self._rain.untrack()

    async def async_refresh_rain(self) -> RainState:
        """Recalcula el estado de lluvia (§8.9) y avisa a las entidades.

        No dispara alertas: rain_source_unavailable solo sale al evaluar un lote (§8.2).
        """
        state = await self._rain.refresh()
        if state.forecast_configured:
            state = await self._async_estimate_rain(state)
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        return state

    async def _async_estimate_rain(self, state: RainState) -> RainState:
        """Fusiona la previsión en el registro y estima la lluvia pasada (rain-estimated-design.md §5).

        Sin previsión válida no hay estimación: el registro se conserva para la próxima consulta.
        """
        now = dt_util.utcnow()
        async with self._lock:
            if state.forecast is not None:
                self.runtime.forecast_log = merge_forecast(self.runtime.forecast_log, state.forecast, now)
                self._store.schedule_save_runtime(self.runtime)
            log = log_slots(self.runtime.forecast_log)
        estimated = None
        if state.forecast is not None:
            estimated = estimated_rain_mm(log, now, self.config.settings.rain_forecast_hours)
        return self._rain.set_estimate(estimated, log)

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
        verdict = decide(settings, state.past_mm, state.forecast_mm, state.estimated_mm)
        now = dt_util.utcnow()
        async with self._lock:
            evaluated, skipped, opened = apply_verdict_locked(
                self.runtime, self.config.zones, refs, verdict, self._needs_rain, now
            )
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
                    "estimated_mm": round_mm(state.estimated_mm),
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
        # parada de HA o descarga de la entry: no se abre nada más (02-shutdown-close §5.3)
        if self._stopping:
            return
        if await self._quiet_hold_locked():
            return
        limits = {zone_id: zone.max_simultaneous for zone_id, zone in self.config.zones.items()}
        jobs = self._slots.startable(limits, self.config.settings.global_max_valves)
        if not jobs:
            return
        for job in jobs:
            # reserva y lanza uno a uno, en el mismo orden que antes
            self._slots.reserve(job)
            self._spawn(self._async_open_job(job), f"irrigation_open_{job.entity_id}")
        await self._async_persist_locked()

    # ---------- horario silencioso (quiet-hours §B.4) ----------

    async def _quiet_hold_locked(self) -> bool:
        """Requiere el lock. Puerta del despacho: True = no arranca nada de la cola.

        Dentro de la franja, con cola y sin retener, fija `held_until` al fin de la franja y
        programa el temporizador. Con `held_until` fijado la puerta sigue cerrada hasta que
        `_async_quiet_end` decide la lluvia y lo borra. Las válvulas abiertas no se tocan.
        """
        if self.runtime.held_until is not None:
            return True
        local_now = dt_util.now()
        if not in_quiet_hours(self.config.settings, local_now):
            return False
        if self.runtime.pending:
            self.runtime.held_until = quiet_end_after(self.config.settings, local_now)
            self._schedule_quiet_end()
            await self._async_persist_locked()
        return True

    def _schedule_quiet_end(self) -> None:
        """(Re)programa el temporizador único a `held_until`."""
        self._cancel_quiet_end()
        held = self.runtime.held_until
        if held is None or self._stopping:
            return
        self._quiet_unsub = async_track_point_in_time(self.hass, self._async_quiet_end_due, held)

    def _cancel_quiet_end(self) -> None:
        if self._quiet_unsub is not None:
            self._quiet_unsub()
            self._quiet_unsub = None

    async def _async_quiet_end_due(self, _now: datetime) -> None:
        self._quiet_unsub = None
        await self._async_quiet_end()

    async def _async_quiet_end(self) -> None:
        """Fin de la franja (§B.4): decide la lluvia de lo programado retenido y despacha.

        Lote: zonas con trabajos programados en cola que necesitan lluvia, como bloques
        `(zone_id, fin de franja, hoy)`. Lo manual riega siempre, sin mirar la lluvia.
        """
        if self._quiet_ending:
            return
        self._quiet_ending = True
        try:
            async with self._lock:
                held = self.runtime.held_until
                if held is None:
                    return
                self._cancel_quiet_end()
                day = dt_util.now().date()
                # hora del bloque: el fin de la franja con que se retuvo la cola
                start = dt_util.as_local(held).strftime("%H:%M")
                zones = self.config.zones
                zone_ids = dict.fromkeys(
                    job.zone_id
                    for job in sorted(self.runtime.pending, key=lambda item: item.seq)
                    if job.origin == ORIGIN_SCHEDULED
                )
                refs: list[BlockRef] = [
                    (zone_id, start, day)
                    for zone_id in zone_ids
                    if zone_id in zones and self._needs_rain(zones[zone_id])
                ]
                # zonas con un bloque propio a esa hora: su decisión la consume _async_block_fired
                own = {zone.zone_id for zone in blocks_at(zones.values(), start, day)}
            if refs:
                # sin el lock: recalcula la lluvia y fija la decisión, como un bloque a su hora
                await self._async_evaluate_lot(refs)
            async with self._lock:
                decisions = self.runtime.rain_decisions
                skip: set[str] = set()
                for ref in refs:
                    decision = decisions.get(ref) if ref[0] in own else decisions.pop(ref, None)
                    if decision is not None and decision.skip:
                        skip.add(ref[0])
                if skip:
                    # solo lo programado de esas zonas; lo manual riega siempre
                    self._slots.drop_pending(
                        lambda job: job.origin != ORIGIN_SCHEDULED or job.zone_id not in skip
                    )
                self.runtime.held_until = None
                await self._async_persist_locked()
                # si se sigue dentro de una franja (ajustes movidos), la puerta vuelve a retener
                await self._async_dispatch_locked()
        finally:
            self._quiet_ending = False

    async def _async_open_job(self, job: Job) -> None:
        """Enciende una válvula fuera del lock; el hueco ya está reservado en ValveSlots.

        Si se canceló mientras abría (stop/borrado de zona), se reutiliza el flujo de
        cierre para no soltar el hueco antes de tiempo: la válvula sigue ocupando su
        sitio hasta que `_async_finish_close` la apaga y libera.
        """
        # un trabajo nuevo sobre esta switch manda: programa su propio cierre (01-close-retry §3)
        self._close_retry.cancel(job.entity_id)
        ok = await async_set_valve(
            self.hass,
            job.entity_id,
            turn_on=True,
            # al parar HA deja de reintentar, como con una pausa (02-shutdown-close §5.4)
            cancelled=lambda: self._stopping or self._slots.is_cancelled(job.entity_id),
        )
        cancelled = False
        closing = False
        async with self._lock:
            cancelled = self._slots.finish_opening(job.entity_id)
            if ok:
                # parando: queda en open_valves sin temporizador; la cierra async_close_on_stop
                self._mark_open_locked(job)
                if cancelled:
                    closing = self._begin_close_locked(job.entity_id)
            elif self._stopping and not cancelled:
                # HA para mientras abría: interrumpida con su tiempo entero (03-remaining-time §4.3)
                self._slots.interrupt_job(job, dt_util.utcnow())
            await self._async_persist_locked()
            if not (ok and cancelled):
                await self._async_dispatch_locked()
        if ok and cancelled and closing:
            await self._async_finish_close(job.entity_id)
        # pausada mientras reintentaba, o HA parando: no es un fallo
        elif not ok and not cancelled and not self._stopping:
            await self._incidents.valve_error(job.zone_id, job.entity_id, True)

    def _mark_open_locked(self, job: Job) -> None:
        """Requiere el lock. Registra la válvula abierta y programa su cierre."""
        self._schedule_close(self._slots.opened(job, dt_util.utcnow()))

    def _schedule_close(self, valve: OpenValve) -> None:
        """Programa el apagado en `ends_at`. Parando no: la cierra el job de parada o el arranque."""
        if self._stopping:
            return
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
            await self._async_dispatch_locked()
        if not ok and valve is not None:
            # se libera el hueco igualmente; el push crítico avisa (decisión del plan)
            await self._async_close_failed(valve.zone_id, entity_id)
        return ok

    async def _async_close_failed(self, zone_id: str, entity_id: str) -> None:
        """Falla la ráfaga de apagado: turn_off_failed y reintentos en segundo plano (01-close-retry).

        Con reintentos ya en marcha para esa switch no se repite el aviso.
        """
        if self._close_retry.is_active(entity_id):
            return
        await self._incidents.valve_error(zone_id, entity_id, False)
        if not self._stopping:
            self._close_retry.start(zone_id, entity_id)

    def manual_on(self) -> list[tuple[Zone, Valve, datetime]]:
        """Switch configuradas encendidas a mano: en `on` y fuera de la gestión propia (03 §5.3).

        Las que tienen reintentos de cierre en marcha tampoco cuentan (01-close-retry §5).
        """
        busy = self._slots.busy() | self._close_retry.active()
        return manual_on(self.hass, self.config.zones.values(), busy)

    async def _async_manual_due(self, entity_id: str, due: datetime) -> None:
        """Apaga la switch encendida a mano al cumplir su duration_min (03 §5.3.2)."""
        async with self._lock:
            found = next(
                (item for item in self.manual_on() if item[1].entity_id == entity_id), None
            )
            # ya apagada o gestionada por la integración
            if found is None:
                return
            zone, valve, since = found
            # temporizador de un encendido anterior: el actual tiene el suyo. Se compara con la
            # hora programada, no con utcnow, para no descartar un disparo milisegundos antes
            if due < manual_ends(valve, since):
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
            await self._async_close_failed(zone_id, entity_id)
        return ok

    async def _async_persist_locked(self) -> None:
        """Requiere el lock. Avisa al panel ya y deja la escritura en disco para después.

        Sigue siendo async para no tocar sus llamadas. El latido escribe directo.
        """
        self._slots.prune_batches(self.config.zones)
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        self._store.schedule_save_runtime(self.runtime)

    async def async_flush(self) -> None:
        """Escribe ya el runtime pendiente (descarga de la entry)."""
        await self._store.async_flush_runtime(self.runtime)

    # ---------- configuración ----------

    def _get_zone(self, zone_id: str) -> Zone:
        return require_zone(self.config, zone_id)

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
        zone, issues, is_new = prepare_zone(self.config, data)
        if zone is None:
            return None, issues
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
            self._triggers.track_zone(zone)
            self._triggers.track_times()
        registry.remove_valve_entities(self.hass, zone.zone_id, removed)
        if is_new:
            async_dispatcher_send(self.hass, SIGNAL_ZONE_ADDED, zone.zone_id)
        else:
            registry.rename_device(self.hass, zone)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        return zone, []

    async def async_delete_zone(self, zone_id: str) -> None:
        """Detiene la zona y la borra solo si todo apagó (docs/features/alerts/spec.md §2)."""
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
        self._triggers.untrack_zone(zone_id)
        if self._started:
            self._triggers.track_times()
        registry.remove_zone_entities(self.hass, self.entry_id, zone_id)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)

    async def async_save_settings(
        self, data: dict[str, Any]
    ) -> tuple[Settings | None, list[Issue]]:
        settings, issues = prepare_settings(self.config, data)
        if settings is None:
            return None, issues
        release = False
        async with self._lock:
            self.config.settings = settings
            # cola retenida: se recalcula con la franja nueva (quiet-hours §B.4)
            if self.runtime.held_until is not None:
                local_now = dt_util.now()
                if quiet_active(settings) and in_quiet_hours(settings, local_now):
                    self.runtime.held_until = quiet_end_after(settings, local_now)
                    self._schedule_quiet_end()
                    await self._async_persist_locked()
                else:
                    # franja desactivada o movida fuera de ahora: se libera ya
                    release = True
            if not self.rain_configured():
                # sin fuentes: cierran los episodios y los bloques ya decididos riegan (§8.14, §8.22)
                self.runtime.rain_episodes.clear()
                self.runtime.rain_decisions.clear()
                await self._async_persist_locked()
            await self._store.async_save_config(self.config)
            # el límite global puede haber subido
            await self._async_dispatch_locked()
        registry.remove_rain_entities(self.hass, self.config, self.rain_configured())
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        if release:
            self._spawn(self._async_quiet_end(), "irrigation_quiet_end")
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
        check_zone_option(zone, key, value)
        async with self._lock:
            setattr(zone, key, value)
            self.runtime.drop_decisions(zone_id)
            if key == "rain_skip" and not value:
                self.runtime.rain_episodes.pop(zone_id, None)
            await self._store.async_save_config(self.config)
            await self._async_persist_locked()
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)

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
                for zone, valve, _since in self.manual_on()
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
        return status.zone_status(self.runtime, self._slots, zone_id)

    def zone_plan(self, zone_id: str) -> tuple[ZoneOutlook | None, datetime | None]:
        # (P con su predicción o decisión, próximo riego); (None, None) si la zona no existe
        return status.zone_plan_for(self.config, self.runtime, self.rain, self._needs_rain, zone_id)

    def rain_unit(self) -> str:
        # unidad de precipitación del sistema de HA (util/unit_system.py:90)
        return self.hass.config.units.accumulated_precipitation_unit

    def active_valves(self) -> int:
        return status.active_valves(self.runtime)

    def valve_origin(self, entity_id: str) -> str:
        """Origen del riego de una switch configurada; estado del sensor «Modo riego»."""
        return status.valve_origin(self.hass, self.runtime, self._slots, entity_id)

    def opening_durations(self) -> dict[str, tuple[str, int]]:
        """Aperturas en curso: zona y duración de su trabajo (vista de ValveSlots)."""
        return self._slots.durations()

    def visible_opening(self) -> dict[str, str]:
        """Aperturas en curso sin las ya pausadas: entity_id → zone_id (vista de ValveSlots)."""
        return self._slots.visible_opening()

    def closing_valves(self) -> set[str]:
        """Switch con el apagado en curso (vista de ValveSlots)."""
        return self._slots.closing()
