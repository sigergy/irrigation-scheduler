"""binary_sensor por zona: «se omitirá el próximo riego» (05-rain-skip.md §8.21)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SIGNAL_CONFIG
from .entities.sync import KnownSet
from .entity import ZoneEntity
from .errors import IrrigationConfigEntry
from .manager import IrrigationManager
from .rain import MM_PER_UNIT


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

    @property
    def is_on(self) -> bool:
        outlook = self._manager.zone_rain_outlook(self._zone_id)
        return outlook is not None and outlook.verdict.skip

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        outlook = self._manager.zone_rain_outlook(self._zone_id)
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
