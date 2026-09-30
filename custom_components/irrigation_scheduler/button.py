"""Botones: regar zona ahora (por zona) y parar todo (global)."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entities.sync import on_zones
from .entity import InstallationEntity, ZoneEntity
from .errors import IrrigationConfigEntry
from .manager import IrrigationManager


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data

    @callback
    def add_zone(zone_id: str) -> None:
        async_add_entities([ZoneRunButton(manager, zone_id)])

    on_zones(hass, entry, manager, add_zone)
    async_add_entities([StopAllButton(manager)])


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
