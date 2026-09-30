"""Switches por zona: habilitada y omitir por lluvia."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .engine.manager import IrrigationManager
from .entities.base import ZoneEntity
from .entities.sync import on_zones
from .errors import IrrigationConfigEntry


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data

    @callback
    def add_zone(zone_id: str) -> None:
        async_add_entities(
            [
                ZoneOptionSwitch(manager, zone_id, "enabled"),
                ZoneOptionSwitch(manager, zone_id, "rain_skip"),
            ]
        )

    on_zones(hass, entry, manager, add_zone)


class ZoneOptionSwitch(ZoneEntity, SwitchEntity):
    """`key` es el campo booleano de la zona: enabled o rain_skip."""

    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, manager: IrrigationManager, zone_id: str, key: str) -> None:
        super().__init__(manager, zone_id, key)
        self._key = key

    @property
    def is_on(self) -> bool | None:
        return getattr(self.zone, self._key) if self.zone else None

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._manager.async_set_zone_option(self._zone_id, self._key, True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._manager.async_set_zone_option(self._zone_id, self._key, False)
