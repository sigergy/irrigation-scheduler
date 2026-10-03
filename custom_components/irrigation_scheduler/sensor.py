"""Sensores: estado y próximo riego por zona; válvulas activas y lluvia globales."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import UnitOfPrecipitationDepth
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import ORIGINS, SIGNAL_CONFIG, STATUSES
from .engine.manager import IrrigationManager
from .entities.base import InstallationEntity, ValveEntity, ZoneEntity, configured_valves
from .entities.sync import KnownSet, on_zones
from .errors import IrrigationConfigEntry


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data

    @callback
    def add_zone(zone_id: str) -> None:
        async_add_entities([ZoneStatusSensor(manager, zone_id), ZoneNextRunSensor(manager, zone_id)])

    on_zones(hass, entry, manager, add_zone)
    async_add_entities([ActiveValvesSensor(manager)])

    # (zone_id, entity_id) de las válvulas que ya tienen sensor «Modo riego»
    valves_known: KnownSet[tuple[str, str]] = KnownSet()

    @callback
    def sync_valves() -> None:
        new = valves_known.sync(sorted(configured_valves(manager)))
        if new:
            async_add_entities([ValveModeSensor(manager, zone_id, entity_id) for zone_id, entity_id in new])

    # claves de los sensores de lluvia que ya existen
    rain_known: KnownSet[str] = KnownSet()

    @callback
    def sync_rain() -> None:
        # solo las fuentes configuradas; las quitadas las borra el manager (§8.28)
        settings = manager.config.settings
        wanted = {
            key
            for key, source in (
                ("rain_past", settings.rain_sensor),
                ("rain_forecast", settings.weather_entity),
                ("rain_estimated", settings.weather_entity),
            )
            if source
        }
        new = rain_known.sync(sorted(wanted))
        if new:
            async_add_entities([RAIN_SENSORS[key](manager) for key in new])

    sync_rain()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync_rain))
    sync_valves()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync_valves))


class ZoneStatusSensor(ZoneEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = STATUSES

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "status")

    @property
    def native_value(self) -> str:
        return self._manager.zone_status(self._zone_id)


class ValveModeSensor(ValveEntity, SensorEntity):
    """Origen del riego de la válvula; el recorder lo guarda para la tarjeta de histórico."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = ORIGINS

    def __init__(self, manager: IrrigationManager, zone_id: str, entity_id: str) -> None:
        super().__init__(manager, zone_id, entity_id, "valve_mode", "sensor.modo_riego")

    @property
    def native_value(self) -> str:
        return self._manager.valve_origin(self._valve_id)


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


class RainEstimatedSensor(RainSensor):
    """Lluvia estimada con previsiones vencidas en las últimas rain_forecast_hours.

    Es una estimación, no una medida (rain-estimated-design.md §5.6).
    """

    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "rain_estimated")

    @property
    def available(self) -> bool:
        return self._manager.rain.estimated_mm is not None

    @property
    def native_value(self) -> float | None:
        return self._manager.rain.estimated_mm

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"hours": self._manager.config.settings.rain_forecast_hours}


RAIN_SENSORS: dict[str, type[RainSensor]] = {
    "rain_past": RainPastSensor,
    "rain_forecast": RainForecastSensor,
    "rain_estimated": RainEstimatedSensor,
}
