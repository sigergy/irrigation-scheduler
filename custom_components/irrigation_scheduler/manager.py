"""Orquestador: disparos, colas, válvulas, latido y arranque (03-valves-execution.md)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from functools import partial
from typing import Any
from uuid import uuid4

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    EVENT_SENSOR_UNAVAILABLE,
    EVENT_VALVE_ERROR,
    EVENT_VALVE_OVERRUN,
    HEARTBEAT_INTERVAL,
    MODE_AUTO,
    MODES,
    PRIORITY_CRITICAL,
    PRIORITY_HIGH,
    PRIORITY_NORMAL,
    SIGNAL_CONFIG,
    SIGNAL_STATE,
    SIGNAL_ZONE_ADDED,
    STATUS_IDLE,
    STATUS_QUEUED,
    STATUS_RUNNING,
)
from .model import Config, Settings, Valve, Zone
from .notify import async_push
from .runtime import Job, OpenValve, RuntimeState
from .schedule import block_runs, missed_blocks, next_run, valves_for_block
from .store import IrrigationStore
from .validation import Issue, validate_settings, validate_zone
from .valves import async_set_valve

_LOGGER = logging.getLogger(__name__)

ZONE_OPTIONS = ("enabled", "rain_skip", "mode")


class IrrigationManager:
    def __init__(self, hass: HomeAssistant, entry_id: str, store: IrrigationStore) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self._store = store
        self.config = Config()
        self.runtime = RuntimeState()
        # serializa colas y válvulas: ningún cambio de runtime fuera del lock
        self._lock = asyncio.Lock()
        self._started = False
        self._unsubs: list[CALLBACK_TYPE] = []
        self._zone_unsubs: dict[str, list[CALLBACK_TYPE]] = {}
        self._close_unsubs: dict[str, CALLBACK_TYPE] = {}
        # el lock protege solo el estado en memoria (runtime, config); las llamadas a la
        # switch y los push van fuera, en tareas en paralelo; las válvulas en tránsito
        # (abriendo o cerrando) siguen ocupando su hueco de zona y global
        self._opening: dict[str, str] = {}
        self._closing: set[str] = set()
        self._cancelled: set[str] = set()
        self._tasks: set[asyncio.Task] = set()
        self._stopping = False

    # ---------- ciclo de vida ----------

    def _spawn(self, coro: Any, name: str) -> None:
        """Lanza una tarea en segundo plano fuera del lock y la sigue hasta que termine."""
        task = self.hass.async_create_background_task(coro, name)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def async_setup(self) -> None:
        self.config, self.runtime = await self._store.async_load()
        # las switch deben existir antes de recuperar (03 §5.2)
        self._unsubs.append(async_at_started(self.hass, self._async_on_started))

    async def _async_on_started(self, _hass: HomeAssistant) -> None:
        await self._async_recover()
        self._started = True
        for zone in self.config.zones.values():
            self._track_zone(zone)
        self._unsubs.append(
            async_track_time_interval(self.hass, self._async_heartbeat, HEARTBEAT_INTERVAL)
        )

    @callback
    def async_shutdown(self) -> None:
        """Cancela temporizadores. Las válvulas abiertas siguen en el runtime persistido."""
        self._stopping = True
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        for zone_id in list(self._zone_unsubs):
            self._untrack_zone(zone_id)
        for unsub in self._close_unsubs.values():
            unsub()
        self._close_unsubs.clear()

    async def _async_recover(self) -> None:
        """Arranque de HA (03 §5.2)."""
        now = dt_util.utcnow()
        async with self._lock:
            for valve in list(self.runtime.open_valves.values()):
                if now >= valve.ends_at:
                    # 1. excedida: apagar, evento y push alto
                    self.runtime.open_valves.pop(valve.entity_id)
                    ok = await async_set_valve(self.hass, valve.entity_id, turn_on=False)
                    self.hass.bus.async_fire(
                        EVENT_VALVE_OVERRUN,
                        {"zone_id": valve.zone_id, "entity_id": valve.entity_id},
                    )
                    await self._async_push("overrun", valve.zone_id, valve.entity_id, PRIORITY_HIGH)
                    if not ok:
                        await self._async_valve_error(valve.zone_id, valve.entity_id, False)
                else:
                    # 2. en curso: se programa su apagado
                    self._schedule_close(valve)
            # 4. inicios perdidos, detrás de las colas pendientes (3.)
            if self.runtime.last_alive is not None:
                for _when, zone_id, index in missed_blocks(
                    self.config.zones.values(), self.runtime.last_alive, dt_util.now()
                ):
                    self._enqueue_block(self.config.zones[zone_id], index)
            self.runtime.last_alive = now
            await self._async_persist()
            await self._async_dispatch_locked()

    async def _async_heartbeat(self, _now: datetime) -> None:
        async with self._lock:
            self.runtime.last_alive = dt_util.utcnow()
            await self._store.async_save_runtime(self.runtime)

    # ---------- disparos y sensores ----------

    def _track_zone(self, zone: Zone) -> None:
        """(Re)registra los disparos de la zona y la vigilancia de sus sensores."""
        self._untrack_zone(zone.zone_id)
        unsubs: list[CALLBACK_TYPE] = []
        for index, start in enumerate(zone.start_times):
            hour, minute = (int(part) for part in start.split(":"))
            unsubs.append(
                async_track_time_change(
                    self.hass,
                    partial(self._async_block_fired, zone.zone_id, index),
                    hour=hour,
                    minute=minute,
                    second=0,
                )
            )
        sensor_ids = [entity_id for entity_id in zone.sensors.values() if entity_id]
        if sensor_ids:
            unsubs.append(
                async_track_state_change_event(
                    self.hass, sensor_ids, partial(self._async_sensor_changed, zone.zone_id)
                )
            )
        self._zone_unsubs[zone.zone_id] = unsubs

    def _untrack_zone(self, zone_id: str) -> None:
        for unsub in self._zone_unsubs.pop(zone_id, []):
            unsub()

    async def _async_block_fired(self, zone_id: str, index: int, now: datetime) -> None:
        zone = self.config.zones.get(zone_id)
        if zone is None or index >= len(zone.start_times):
            return
        if not block_runs(zone, dt_util.as_local(now).date()):
            return
        async with self._lock:
            # el latido se adelanta para no repetir este bloque si HA cae ahora
            self.runtime.last_alive = dt_util.utcnow()
            self._enqueue_block(zone, index)
            await self._async_persist()
            await self._async_dispatch_locked()

    async def _async_sensor_changed(self, zone_id: str, event: Event[EventStateChangedData]) -> None:
        """Push normal al pasar un sensor de zona a unavailable/unknown (03 §7.2)."""
        bad = (STATE_UNAVAILABLE, STATE_UNKNOWN)
        new_state = event.data["new_state"]
        old_state = event.data["old_state"]
        if new_state is None or new_state.state not in bad:
            return
        if old_state is not None and old_state.state in bad:
            return
        self.hass.bus.async_fire(
            EVENT_SENSOR_UNAVAILABLE,
            {"zone_id": zone_id, "entity_id": new_state.entity_id, "state": new_state.state},
        )
        await self._async_push(
            "sensor_unavailable", zone_id, new_state.entity_id, PRIORITY_NORMAL, state=new_state.state
        )

    # ---------- colas y válvulas ----------

    def _enqueue_block(self, zone: Zone, index: int) -> None:
        for valve in valves_for_block(zone, index):
            self.runtime.enqueue(zone.zone_id, valve.entity_id, valve.duration_min * 60)

    async def _async_dispatch_locked(self) -> None:
        """Arranca trabajos con hueco en zona y global (03 §3). Requiere el lock.

        No hace I/O de switch: solo reserva el hueco (`_opening`) y lanza la apertura
        real en una tarea aparte, fuera del lock. Una sola pasada: cada apertura, al
        terminar, vuelve a llamar aquí para encadenar la siguiente.
        """
        limits = {zone_id: zone.max_simultaneous for zone_id, zone in self.config.zones.items()}
        jobs = self.runtime.startable_jobs(
            limits, self.config.settings.global_max_valves, reserved=self._opening
        )
        if not jobs:
            return
        for job in jobs:
            self.runtime.pending.remove(job)
            self._opening[job.entity_id] = job.zone_id
            self._spawn(self._async_open_job(job), f"irrigation_open_{job.entity_id}")
        await self._async_persist()

    async def _async_open_job(self, job: Job) -> None:
        """Enciende una válvula fuera del lock; el hueco ya está reservado en `_opening`.

        Si se canceló mientras abría (stop/borrado de zona), se reutiliza el flujo de
        cierre para no soltar el hueco antes de tiempo: la válvula sigue ocupando su
        sitio hasta que `_async_finish_close` la apaga y libera.
        """
        ok = await async_set_valve(self.hass, job.entity_id, turn_on=True)
        cancelled = False
        closing = False
        async with self._lock:
            self._opening.pop(job.entity_id, None)
            cancelled = job.entity_id in self._cancelled
            self._cancelled.discard(job.entity_id)
            if ok:
                self._mark_open(job)
                if cancelled:
                    closing = self._begin_close_locked(job.entity_id)
            await self._async_persist()
            if not self._stopping and not (ok and cancelled):
                await self._async_dispatch_locked()
        if ok and cancelled and closing:
            await self._async_finish_close(job.entity_id)
        elif not ok:
            await self._async_valve_error(job.zone_id, job.entity_id, True)

    def _mark_open(self, job: Job) -> None:
        """Requiere el lock. Registra la válvula abierta y, si procede, programa su cierre."""
        started = dt_util.utcnow()
        valve = OpenValve(
            job.entity_id, job.zone_id, started, started + timedelta(seconds=job.duration_s)
        )
        self.runtime.open_valves[job.entity_id] = valve
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
        if entity_id not in self.runtime.open_valves or entity_id in self._closing:
            return False
        if unsub := self._close_unsubs.pop(entity_id, None):
            unsub()
        self._closing.add(entity_id)
        return True

    async def _async_finish_close(self, entity_id: str) -> None:
        """Apaga la switch fuera del lock y libera el hueco al terminar."""
        ok = await async_set_valve(self.hass, entity_id, turn_on=False)
        valve = None
        async with self._lock:
            self._closing.discard(entity_id)
            valve = self.runtime.open_valves.pop(entity_id, None)
            await self._async_persist()
            if not self._stopping:
                await self._async_dispatch_locked()
        if not ok and valve is not None:
            # se libera el hueco igualmente; el push crítico avisa (decisión del plan)
            await self._async_valve_error(valve.zone_id, entity_id, False)

    async def _async_valve_error(self, zone_id: str, entity_id: str, turning_on: bool) -> None:
        """La switch no responde tras los reintentos (03 §6)."""
        priority = PRIORITY_HIGH if turning_on else PRIORITY_CRITICAL
        self.hass.bus.async_fire(
            EVENT_VALVE_ERROR,
            {
                "zone_id": zone_id,
                "entity_id": entity_id,
                "action": "turn_on" if turning_on else "turn_off",
                "priority": priority,
            },
        )
        kind = "turn_on_failed" if turning_on else "turn_off_failed"
        await self._async_push(kind, zone_id, entity_id, priority)

    async def _async_push(
        self, kind: str, zone_id: str, entity_id: str, priority: str, **extra: str
    ) -> None:
        zone = self.config.zones.get(zone_id)
        state = self.hass.states.get(entity_id)
        await async_push(
            self.hass,
            self.config.settings.notify_targets,
            kind,
            priority,
            zone=zone.name if zone else zone_id,
            entity=state.name if state else entity_id,
            **extra,
        )

    async def _async_persist(self) -> None:
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
        for zone in self.config.zones.values():
            for valve in zone.valves:
                if valve.entity_id == entity_id:
                    return zone, valve
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="unknown_valve",
            translation_placeholders={"entity_id": entity_id},
        )

    async def async_save_zone(self, data: dict[str, Any]) -> tuple[Zone | None, list[Issue]]:
        """Alta (sin zone_id) o edición de una zona. Valida V1–V9."""
        is_new = not data.get("zone_id")
        if is_new:
            data = {**data, "zone_id": uuid4().hex}
        else:
            self._get_zone(data["zone_id"])
        zone = Zone.from_dict(data)
        if issues := validate_zone(zone, self.config):
            return None, issues
        zone.start_times.sort()
        async with self._lock:
            self.config.zones[zone.zone_id] = zone
            await self._store.async_save_config(self.config)
            # trabajos de válvulas que ya no están en la zona
            kept = {valve.entity_id for valve in zone.valves}
            self.runtime.pending = [
                job
                for job in self.runtime.pending
                if job.zone_id != zone.zone_id or job.entity_id in kept
            ]
            await self._async_persist()
            # la simultaneidad puede haber subido
            await self._async_dispatch_locked()
        if self._started:
            self._track_zone(zone)
        if is_new:
            async_dispatcher_send(self.hass, SIGNAL_ZONE_ADDED, zone.zone_id)
        else:
            self._rename_device(zone)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        return zone, []

    async def async_delete_zone(self, zone_id: str) -> None:
        self._get_zone(zone_id)
        async with self._lock:
            self.runtime.pending = [job for job in self.runtime.pending if job.zone_id != zone_id]
            closing = [
                entity_id
                for entity_id, valve in list(self.runtime.open_valves.items())
                if valve.zone_id == zone_id and self._begin_close_locked(entity_id)
            ]
            for entity_id, opening_zone in list(self._opening.items()):
                if opening_zone == zone_id:
                    self._cancelled.add(entity_id)
            del self.config.zones[zone_id]
            await self._store.async_save_config(self.config)
            await self._async_persist()
            if not closing:
                await self._async_dispatch_locked()
        if closing:
            await asyncio.gather(*(self._async_finish_close(e) for e in closing))
        self._untrack_zone(zone_id)
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
            await self._store.async_save_config(self.config)
            # el límite global puede haber subido
            await self._async_dispatch_locked()
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
        return settings, []

    async def async_set_zone_option(self, zone_id: str, key: str, value: Any) -> None:
        """Cambios desde entidades: enabled, rain_skip y mode."""
        if key not in ZONE_OPTIONS:
            raise ValueError(key)
        zone = self._get_zone(zone_id)
        if key == "mode":
            if value not in MODES:
                raise ValueError(value)
            if value == MODE_AUTO and zone.calc_method is None:
                raise ServiceValidationError(
                    translation_domain=DOMAIN, translation_key="auto_unavailable"
                )
        setattr(zone, key, value)
        await self._store.async_save_config(self.config)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)

    def _rename_device(self, zone: Zone) -> None:
        registry = dr.async_get(self.hass)
        if device := registry.async_get_device(identifiers={(DOMAIN, zone.zone_id)}):
            registry.async_update_device(device.id, name=zone.name)

    def _remove_zone_entities(self, zone_id: str) -> None:
        entities = er.async_get(self.hass)
        for entry in er.async_entries_for_config_entry(entities, self.entry_id):
            if entry.unique_id.startswith(f"{zone_id}_"):
                entities.async_remove(entry.entity_id)
        devices = dr.async_get(self.hass)
        if device := devices.async_get_device(identifiers={(DOMAIN, zone_id)}):
            devices.async_remove_device(device.id)

    # ---------- controles manuales (03 §4) ----------

    async def async_run_zone(self, zone_id: str) -> None:
        """Todas las válvulas de la zona, sin frecuencia; respeta zona y global."""
        zone = self._get_zone(zone_id)
        async with self._lock:
            for valve in zone.valves:
                self.runtime.enqueue(zone_id, valve.entity_id, valve.duration_min * 60)
            await self._async_persist()
            await self._async_dispatch_locked()

    async def async_run_valve(self, entity_id: str, minutes: int | None = None) -> None:
        """Una válvula durante X min (por defecto su duration_min); solo respeta el global."""
        zone, valve = self._find_valve(entity_id)
        duration_s = (minutes or valve.duration_min) * 60
        async with self._lock:
            self.runtime.enqueue(zone.zone_id, entity_id, duration_s, zone_limit=False)
            await self._async_persist()
            await self._async_dispatch_locked()

    async def async_stop(self, zone_id: str | None = None) -> None:
        """Sin zona: parar todo. Con zona: apaga sus válvulas y vacía su cola."""
        if zone_id is not None:
            self._get_zone(zone_id)
        async with self._lock:
            self.runtime.pending = [
                job
                for job in self.runtime.pending
                if zone_id is not None and job.zone_id != zone_id
            ]
            closing = [
                entity_id
                for entity_id, valve in list(self.runtime.open_valves.items())
                if (zone_id is None or valve.zone_id == zone_id) and self._begin_close_locked(entity_id)
            ]
            for entity_id, opening_zone in list(self._opening.items()):
                if zone_id is None or opening_zone == zone_id:
                    self._cancelled.add(entity_id)
            await self._async_persist()
            if not closing:
                # el hueco global liberado puede dar paso a otras zonas
                await self._async_dispatch_locked()
        if closing:
            await asyncio.gather(*(self._async_finish_close(e) for e in closing))

    # ---------- estado para entidades y WebSocket ----------

    def zone_status(self, zone_id: str) -> str:
        if any(valve.zone_id == zone_id for valve in self.runtime.open_valves.values()) or (
            zone_id in self._opening.values()
        ):
            return STATUS_RUNNING
        if any(job.zone_id == zone_id for job in self.runtime.pending):
            return STATUS_QUEUED
        return STATUS_IDLE

    def zone_next_run(self, zone_id: str) -> datetime | None:
        zone = self.config.zones.get(zone_id)
        return next_run(zone, dt_util.now()) if zone else None

    def active_valves(self) -> int:
        return len(self.runtime.open_valves)

    def snapshot(self) -> dict[str, Any]:
        zones = []
        for zone in self.config.zones.values():
            upcoming = self.zone_next_run(zone.zone_id)
            zones.append(
                {
                    **zone.to_dict(),
                    "status": self.zone_status(zone.zone_id),
                    "next_run": upcoming.isoformat() if upcoming else None,
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
        }


type IrrigationConfigEntry = ConfigEntry[IrrigationManager]
