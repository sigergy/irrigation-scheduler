"""Sensores: estado y próximo riego por zona; válvulas activas y lluvia globales."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import UnitOfPrecipitationDepth
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import SIGNAL_CONFIG, SIGNAL_ZONE_ADDED, STATUSES
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

    # claves de los sensores de lluvia que ya existen
    rain_known: set[str] = set()

    @callback
    def sync_rain() -> None:
        # solo las fuentes configuradas; las quitadas las borra el manager (§8.28)
        settings = manager.config.settings
        wanted = {
            key
            for key, source in (("rain_past", settings.rain_sensor), ("rain_forecast", settings.weather_entity))
            if source
        }
        rain_known.intersection_update(wanted)
        new = sorted(wanted - rain_known)
        rain_known.update(new)
        if new:
            async_add_entities([RAIN_SENSORS[key](manager) for key in new])

    sync_rain()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync_rain))
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


class RainSensor(InstallationEntity, SensorEntity):
    """mm en la instalación; HA los muestra en la unidad del sistema (§8.12)."""

    # conversión a la unidad del sistema: components/sensor/__init__.py:416-441
    # con la regla de util/unit_system.py:369 (mm a in en US customary)
    _attr_device_class = SensorDeviceClass.PRECIPITATION
    _attr_native_unit_of_measurement = UnitOfPrecipitationDepth.MILLIMETERS
    _attr_suggested_display_precision = 1


class RainPastSensor(RainSensor):
    """Lluvia caída en las últimas rain_past_hours hasta el último cálculo (§8.18)."""

    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "rain_past")

    @property
    def available(self) -> bool:
        # fuente caída: unavailable hasta el siguiente cálculo correcto (§8.9)
        return self._manager.rain.past_mm is not None

    @property
    def native_value(self) -> float | None:
        return self._manager.rain.past_mm

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"hours": self._manager.config.settings.rain_past_hours}


class RainForecastSensor(RainSensor):
    """Lluvia prevista en las próximas rain_forecast_hours desde el último cálculo (§8.18)."""

    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "rain_forecast")

    @property
    def available(self) -> bool:
        return self._manager.rain.forecast_mm is not None

    @property
    def native_value(self) -> float | None:
        return self._manager.rain.forecast_mm

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"hours": self._manager.config.settings.rain_forecast_hours}


RAIN_SENSORS: dict[str, type[RainSensor]] = {
    "rain_past": RainPastSensor,
    "rain_forecast": RainForecastSensor,
}
