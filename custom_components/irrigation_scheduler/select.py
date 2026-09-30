"""Select de modo por zona (manual | auto)."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import MODES
from .entities.base import ZoneEntity
from .entities.sync import on_zones
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
        async_add_entities([ZoneModeSelect(manager, zone_id)])

    on_zones(hass, entry, manager, add_zone)


class ZoneModeSelect(ZoneEntity, SelectEntity):
    _attr_options = MODES
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "mode")

    @property
    def current_option(self) -> str | None:
        return self.zone.mode if self.zone else None

    async def async_select_option(self, option: str) -> None:
        # auto sin método de cálculo lanza ServiceValidationError (V8)
        await self._manager.async_set_zone_option(self._zone_id, "mode", option)
