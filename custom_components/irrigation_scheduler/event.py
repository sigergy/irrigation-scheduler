"""Entidades event: registro de incidencias por válvula, zona e instalación.

docs/alerts/spec.md §0.1; decisiones 2-5 de 2026-09-29-incidents-design.md.
"""

from __future__ import annotations

from homeassistant.components.event import EventEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device import async_entity_id_to_device
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .alerts import (
    ALERT_TYPES,
    LEVEL_INSTALLATION,
    LEVEL_VALVE,
    LEVEL_ZONE,
    Alert,
    alert_types,
)
from .const import SIGNAL_ALERT, SIGNAL_CONFIG, SIGNAL_ZONE_ADDED
from .entity import InstallationEntity, ZoneEntity
from .manager import IrrigationConfigEntry, IrrigationManager


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data
    # (zone_id, entity_id) de las válvulas que ya tienen entidad
    known: set[tuple[str, str]] = set()

    @callback
    def sync_valves() -> None:
        current = {
            (zone_id, valve.entity_id)
            for zone_id, zone in manager.config.zones.items()
            for valve in zone.valves
        }
        # las quitadas las borra el manager del registro; aquí solo se olvidan
        known.intersection_update(current)
        new = sorted(current - known)
        known.update(new)
        if new:
            async_add_entities(
                [ValveAlertsEvent(manager, zone_id, entity_id) for zone_id, entity_id in new]
            )

    @callback
    def add_zone(zone_id: str) -> None:
        # sus válvulas llegan con el SIGNAL_CONFIG que sigue al alta
        async_add_entities([ZoneAlertsEvent(manager, zone_id)])

    async_add_entities(
        [InstallationAlertsEvent(manager)]
        + [ZoneAlertsEvent(manager, zone_id) for zone_id in manager.config.zones]
    )
    sync_valves()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_ZONE_ADDED, add_zone))
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync_valves))


class AlertsEvent(EventEntity):
    """Base: dispara el tipo recibido por SIGNAL_ALERT si es de su nivel y le toca.

    Va antes que ZoneEntity o InstallationEntity en la herencia: su `_signals` manda.
    """

    _level: str
    # solo la configuración cambia su disponibilidad
    _signals = (SIGNAL_CONFIG,)

    def _matches(self, alert: Alert) -> bool:
        raise NotImplementedError

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_ALERT, self._async_handle_alert)
        )

    @callback
    def _async_handle_alert(self, alert: Alert) -> None:
        if ALERT_TYPES[alert.alert_id].level != self._level or not self._matches(alert):
            return
        self._trigger_event(alert.alert_id, alert.data)
        self.async_write_ha_state()


class ValveAlertsEvent(AlertsEvent, ZoneEntity):
    _level = LEVEL_VALVE

    def __init__(self, manager: IrrigationManager, zone_id: str, entity_id: str) -> None:
        super().__init__(manager, zone_id, "valve_alerts")
        self._valve_id = entity_id
        # prefijo zone_id: borrar la zona la borra también (manager._remove_zone_entities)
        self._attr_unique_id = f"{zone_id}_valve_alerts_{entity_id}"
        self._attr_event_types = alert_types(LEVEL_VALVE)
        zone = manager.config.zones[zone_id]
        name = next((v.name for v in zone.valves if v.entity_id == entity_id), entity_id)
        self._attr_translation_placeholders = {"valve": name}
        # en el dispositivo de la switch; si no tiene, en el de la zona (decisión 4).
        # Con device_info None la plataforma usa device_entry (entity_platform.py)
        if device := async_entity_id_to_device(manager.hass, entity_id):
            self._attr_device_info = None
            self.device_entry = device

    @property
    def available(self) -> bool:
        zone = self.zone
        return zone is not None and any(v.entity_id == self._valve_id for v in zone.valves)

    def _matches(self, alert: Alert) -> bool:
        return alert.zone_id == self._zone_id and alert.entity_id == self._valve_id


class ZoneAlertsEvent(AlertsEvent, ZoneEntity):
    _level = LEVEL_ZONE

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "alerts")
        self._attr_event_types = alert_types(LEVEL_ZONE)

    def _matches(self, alert: Alert) -> bool:
        return alert.zone_id == self._zone_id


class InstallationAlertsEvent(AlertsEvent, InstallationEntity):
    _level = LEVEL_INSTALLATION

    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "alerts")
        self._attr_event_types = alert_types(LEVEL_INSTALLATION)

    def _matches(self, alert: Alert) -> bool:
        return True
