"""Bases de entidades: una por zona (dispositivo por zona) y globales."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, INSTALLATION_ID, SIGNAL_CONFIG, SIGNAL_STATE
from .manager import IrrigationManager
from .model import Zone


class IrrigationEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, manager: IrrigationManager) -> None:
        self._manager = manager

    async def async_added_to_hass(self) -> None:
        for signal in (SIGNAL_STATE, SIGNAL_CONFIG):
            self.async_on_remove(
                async_dispatcher_connect(self.hass, signal, self.async_write_ha_state)
            )


class ZoneEntity(IrrigationEntity):
    def __init__(self, manager: IrrigationManager, zone_id: str, key: str) -> None:
        super().__init__(manager)
        self._zone_id = zone_id
        self._attr_unique_id = f"{zone_id}_{key}"
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, zone_id)},
            name=manager.config.zones[zone_id].name,
            manufacturer="Irrigation Scheduler",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def zone(self) -> Zone | None:
        return self._manager.config.zones.get(self._zone_id)

    @property
    def available(self) -> bool:
        return self.zone is not None


class InstallationEntity(IrrigationEntity):
    def __init__(self, manager: IrrigationManager, key: str) -> None:
        super().__init__(manager)
        self._attr_unique_id = f"{INSTALLATION_ID}_{key}"
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, INSTALLATION_ID)},
            name="Irrigation Scheduler",
            manufacturer="Irrigation Scheduler",
            entry_type=DeviceEntryType.SERVICE,
        )
