"""Entidades del plan de zona: _update_attrs rellena los _attr_* desde manager.zone_plan."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from custom_components.irrigation_scheduler.binary_sensor import ZoneRainSkipSensor
from custom_components.irrigation_scheduler.domain.rain import REASON_PAST
from custom_components.irrigation_scheduler.sensor import ZoneNextRunSensor

from ...conftest import RAIN_SOURCE_TARGET, add_zone, at_local


async def test_zone_with_rain_outlook(hass: HomeAssistant, manager, switches, freezer, monkeypatch) -> None:
    async def past_rain(_hass, _entity_id, _hours):
        return 20.0, None

    async def forecast(_hass, _entity_id):
        return None, None

    monkeypatch.setattr(f"{RAIN_SOURCE_TARGET}.async_past_rain", past_rain)
    monkeypatch.setattr(f"{RAIN_SOURCE_TARGET}.async_forecast", forecast)
    freezer.move_to(at_local(5, 0))
    settings, issues = await manager.async_save_settings({"rain_sensor": "sensor.lluvia"})
    assert settings is not None, issues
    zone_id = await add_zone(manager, switches, ["switch.v1"], start="06:00", rain_skip=True)

    outlook, next_run = manager.zone_plan(zone_id)
    assert outlook is not None
    rain_skip = ZoneRainSkipSensor(manager, zone_id)
    rain_skip._update_attrs()
    assert rain_skip.is_on is outlook.verdict.skip is True
    assert rain_skip.extra_state_attributes == {
        "start_time": outlook.when.isoformat(),
        "reason": REASON_PAST,
        "rain": 20.0,
        "rain_unit": "mm",
        "predicted": True,
    }

    next_run_sensor = ZoneNextRunSensor(manager, zone_id)
    next_run_sensor._update_attrs()
    assert next_run_sensor.native_value == next_run


async def test_zone_without_outlook(hass: HomeAssistant, manager, switches, freezer) -> None:
    freezer.move_to(at_local(5, 0))
    zone_id = await add_zone(manager, switches, ["switch.v1"], start="06:00")

    outlook, next_run = manager.zone_plan(zone_id)
    assert outlook is None
    assert next_run is not None
    rain_skip = ZoneRainSkipSensor(manager, zone_id)
    rain_skip._update_attrs()
    assert rain_skip.is_on is False
    assert rain_skip.extra_state_attributes == {}

    next_run_sensor = ZoneNextRunSensor(manager, zone_id)
    next_run_sensor._update_attrs()
    assert next_run_sensor.native_value == next_run
