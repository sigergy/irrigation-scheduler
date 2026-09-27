"""Sensores: estado y próximo riego por zona; válvulas activas global."""

from __future__ import annotations

from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SIGNAL_ZONE_ADDED, STATUSES
from .entity import InstallationEntity, ZoneEntity
from .manager import IrrigationConfigEntry, IrrigationManager


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data

    @callback
    def add_zone(zone_id: str) -> None:
        async_add_entities([ZoneStatusSensor(manager, zone_id), ZoneNextRunSensor(manager, zone_id)])

    for zone_id in manager.config.zones:
        add_zone(zone_id)
    async_add_entities([ActiveValvesSensor(manager)])
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_ZONE_ADDED, add_zone))


class ZoneStatusSensor(ZoneEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = STATUSES

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "status")

    @property
    def native_value(self) -> str:
        return self._manager.zone_status(self._zone_id)


class ZoneNextRunSensor(ZoneEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "next_run")

    @property
    def native_value(self) -> datetime | None:
        return self._manager.zone_next_run(self._zone_id)


class ActiveValvesSensor(InstallationEntity, SensorEntity):
    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "active_valves")

    @property
    def native_value(self) -> int:
        return self._manager.active_valves()
