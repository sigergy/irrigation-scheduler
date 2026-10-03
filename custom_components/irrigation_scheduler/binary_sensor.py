"""binary_sensor por zona: «se omitirá el próximo riego» (05-rain-skip.md §8.21)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SIGNAL_CONFIG
from .domain.rain import MM_PER_UNIT
from .engine.manager import IrrigationManager
from .engine.rain_control import ZoneOutlook
from .entities.base import ZoneEntity
from .entities.sync import KnownSet
from .errors import IrrigationConfigEntry


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data
    # zonas que ya tienen entidad
    known: KnownSet[str] = KnownSet()

    @callback
    def sync() -> None:
        # existe si hay al menos una fuente (§8.28); las que sobran las borra el manager
        wanted = set(manager.config.zones) if manager.rain_configured() else set()
        new = known.sync([zone_id for zone_id in manager.config.zones if zone_id in wanted])
        if new:
            async_add_entities([ZoneRainSkipSensor(manager, zone_id) for zone_id in new])

    sync()
    # también cubre el alta de zona: async_save_zone envía SIGNAL_CONFIG
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync))


class ZoneRainSkipSensor(ZoneEntity, BinarySensorEntity):
    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "rain_skip_next")

    def _update_attrs(self) -> None:
        # un solo plan de zona por escritura
        outlook, _next_run = self._manager.zone_plan(self._zone_id)
        self._attr_is_on = outlook is not None and outlook.verdict.skip
        self._attr_extra_state_attributes = self._outlook_attrs(outlook)

    def _outlook_attrs(self, outlook: ZoneOutlook | None) -> dict[str, Any]:
        if outlook is None:
            return {}
        unit = self._manager.rain_unit()
        rain_mm = outlook.verdict.rain_mm
        rain = None
        if rain_mm is not None:
            rain = round(rain_mm / MM_PER_UNIT["in"], 2) if unit == "in" else round(rain_mm, 1)
        return {
            "start_time": outlook.when.isoformat(),
            "reason": outlook.verdict.reason,
            "rain": rain,
            "rain_unit": unit,
            "predicted": outlook.predicted,
        }
