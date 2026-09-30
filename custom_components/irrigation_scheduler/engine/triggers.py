"""Oyentes de HA: switches, sensores de zona y suministro, y horas de inicio (03 §2, §5.3).

Solo registran oyentes y reenvían al manager; no toman el lock. Los cambios de runtime
siguen en los métodos del manager, que toman el lock allí.
"""

from __future__ import annotations

from datetime import datetime
from functools import partial
from typing import TYPE_CHECKING

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
)

from ..const import DOMAIN, ORIGIN_EXTERNAL, RAIN_EVAL_LEAD_MIN, SIGNAL_STATE
from ..domain.model import Valve, Zone
from .manual import manual_ends, supply_on

if TYPE_CHECKING:
    from .manager import IrrigationManager


class Triggers:
    """Guarda los unsubs de zona y de horas; sus callbacks invocan al manager."""

    def __init__(self, hass: HomeAssistant, manager: IrrigationManager) -> None:
        self.hass = hass
        self._manager = manager
        self._zone_unsubs: dict[str, list[CALLBACK_TYPE]] = {}
        # disparadores por hora de inicio: T−10 (decisión) y T (riego) (§8.11, §8.16)
        self._time_unsubs: list[CALLBACK_TYPE] = []
        # origen de cada switch encendida, para el push de apagado (valve_switched); solo en memoria
        self._switch_origin: dict[str, str] = {}

    def zone_ids(self) -> list[str]:
        """Zonas con vigilancia registrada."""
        return list(self._zone_unsubs)

    def track_zone(self, zone: Zone) -> None:
        """(Re)registra la vigilancia de sensores y válvulas de la zona."""
        manager = self._manager
        self.untrack_zone(zone.zone_id)
        unsubs: list[CALLBACK_TYPE] = []
        sensor_ids = [entity_id for entity_id in zone.sensors.values() if entity_id]
        if sensor_ids:
            unsubs.append(
                async_track_state_change_event(
                    self.hass, sensor_ids, partial(manager._async_sensor_changed, zone.zone_id)
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
        for manual_zone, valve, since in manager.manual_on():
            if manual_zone.zone_id == zone.zone_id:
                self.track_manual(zone.zone_id, valve, since)

    def untrack_zone(self, zone_id: str) -> None:
        for unsub in self._zone_unsubs.pop(zone_id, []):
            unsub()

    def track_manual(self, zone_id: str, valve: Valve, since: datetime) -> None:
        """Programa el apagado a su hora; se cancela con la vigilancia de la zona (untrack_zone)."""
        self._zone_unsubs.setdefault(zone_id, []).append(
            async_track_point_in_utc_time(
                self.hass,
                partial(self._manager._async_manual_due, valve.entity_id),
                manual_ends(valve, since),
            )
        )

    def track_times(self) -> None:
        """Un disparador por hora de inicio distinta, a T−10 y a T (§8.11, §8.16)."""
        manager = self._manager
        self.untrack_times()
        starts = sorted({start for zone in manager.config.zones.values() for start in zone.start_times})
        for start in starts:
            hour, minute = (int(part) for part in start.split(":"))
            eval_hour, eval_minute = divmod((hour * 60 + minute - RAIN_EVAL_LEAD_MIN) % (24 * 60), 60)
            self._time_unsubs.append(
                async_track_time_change(
                    self.hass, partial(manager._async_block_fired, start), hour=hour, minute=minute, second=0
                )
            )
            self._time_unsubs.append(
                async_track_time_change(
                    self.hass,
                    partial(manager._async_rain_eval_fired, start),
                    hour=eval_hour,
                    minute=eval_minute,
                    second=0,
                )
            )

    def untrack_times(self) -> None:
        for unsub in self._time_unsubs:
            unsub()
        self._time_unsubs.clear()

    @callback
    def _async_valve_state_changed(self, event: Event[EventStateChangedData]) -> None:
        manager = self._manager
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
            self._switch_origin[entity_id] = manager.valve_origin(entity_id)
            manager._spawn(
                manager._incidents.push_switched(entity_id, "valve_on", self._switch_origin[entity_id]),
                f"{DOMAIN}_valve_on",
            )
            try:
                zone, valve = manager._find_valve(entity_id)
            except ServiceValidationError:
                return
            # encendida fuera de la integración: se apaga al cumplir sus minutos (03 §5.3.2)
            if self._switch_origin[entity_id] == ORIGIN_EXTERNAL:
                self.track_manual(zone.zone_id, valve, new_state.last_changed)
            # abre sin agua: se cierra nada más confirmarse. Si ya se está pausando por el
            # sensor (apertura cancelada o cerrándose), no se repite la alerta.
            # Solo lectura de ValveSlots: sin lock, como antes
            slots = manager._slots
            if (
                not slots.is_cancelled(entity_id)
                and not slots.is_closing(entity_id)
                and supply_on(self.hass, valve)
            ):
                manager._spawn(manager._async_no_water(entity_id), f"{DOMAIN}_no_water")
            return
        # sin origen guardado (HA arrancó con la válvula abierta): el push va sin él
        origin = self._switch_origin.pop(entity_id, None)
        seconds = (new_state.last_changed - old_state.last_changed).total_seconds()
        manager._spawn(
            manager._incidents.push_switched(entity_id, "valve_off", origin, seconds),
            f"{DOMAIN}_valve_off",
        )

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
        self._manager._spawn(self._manager._async_no_water(entity_id), f"{DOMAIN}_no_water")
