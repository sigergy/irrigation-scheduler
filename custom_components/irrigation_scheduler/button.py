"""Botones: regar zona ahora (por zona) y parar todo (global)."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SIGNAL_ZONE_ADDED
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
        async_add_entities([ZoneRunButton(manager, zone_id)])

    for zone_id in manager.config.zones:
        add_zone(zone_id)
    async_add_entities([StopAllButton(manager)])
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_ZONE_ADDED, add_zone))


class ZoneRunButton(ZoneEntity, ButtonEntity):
    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "run")

    async def async_press(self) -> None:
        await self._manager.async_run_zone(self._zone_id)


class StopAllButton(InstallationEntity, ButtonEntity):
    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "stop_all")

    async def async_press(self) -> None:
        await self._manager.async_stop()
