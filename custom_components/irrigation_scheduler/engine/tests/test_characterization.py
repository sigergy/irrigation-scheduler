"""Caracterización del manager: fija el comportamiento actual antes del refactor."""

from __future__ import annotations

import asyncio

import pytest
from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_capture_events

from custom_components.irrigation_scheduler.api.snapshot import build_snapshot
from custom_components.irrigation_scheduler.const import (
    CONFIG_STORE_KEY,
    EVENT_BLOCK_SKIPPED,
    EVENT_NO_WATER,
    EVENT_VALVE_OVERRUN,
    ORIGIN_EXTERNAL,
    ORIGIN_SCHEDULED,
    RUNTIME_STORE_KEY,
    STATUS_IDLE,
    STATUS_RUNNING,
    ZONE_DELETE_VALVES_ON,
)
from custom_components.irrigation_scheduler.errors import ZoneDeleteError

from .conftest import RAIN_SOURCE_TARGET, add_zone, at_local, fire_at, start_manager, zone_data


async def test_scheduled_block_opens_and_closes(hass: HomeAssistant, manager, switches, freezer) -> None:
    freezer.move_to(at_local(5, 0))
    zone_id = await add_zone(manager, switches, ["switch.v1"], start="06:00", duration=10)

    await fire_at(hass, freezer, at_local(6, 0))
    assert hass.states.get("switch.v1").state == STATE_ON
    assert manager.runtime.open_valves["switch.v1"].origin == ORIGIN_SCHEDULED
    assert manager.zone_status(zone_id) == STATUS_RUNNING

    await fire_at(hass, freezer, at_local(6, 10, 1))
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.open_valves == {}
    assert manager.zone_status(zone_id) == STATUS_IDLE


async def test_pause_while_opening(hass: HomeAssistant, manager, switches) -> None:
    await add_zone(manager, switches, ["switch.v1"])
    switches.gate = asyncio.Event()
    await manager.async_run_valve("switch.v1")
    await hass.async_block_till_done()
    # abriéndose: aún ocupa hueco
    assert [item["entity_id"] for item in build_snapshot(manager)["opening"]] == ["switch.v1"]

    await manager.async_pause_valve("switch.v1")
    # pausada: sale del snapshot aunque la llamada siga en curso
    assert build_snapshot(manager)["opening"] == []

    switches.gate.set()
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.open_valves == {}
    assert manager.runtime.pending == []


async def test_no_water_closes_running_valve(hass: HomeAssistant, manager, switches) -> None:
    hass.states.async_set("binary_sensor.agua", STATE_OFF)
    await add_zone(manager, switches, ["switch.v1"], supply={"switch.v1": "binary_sensor.agua"})
    events = async_capture_events(hass, EVENT_NO_WATER)
    await manager.async_run_valve("switch.v1")
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get("switch.v1").state == STATE_ON

    hass.states.async_set("binary_sensor.agua", STATE_ON)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert [event.data["closed"] for event in events] == [True]
    assert [item["entity_id"] for item in build_snapshot(manager)["no_water"]] == ["switch.v1"]


async def test_restart_with_overrun_valve(hass: HomeAssistant, switches, hass_storage, freezer) -> None:
    freezer.move_to(at_local(8, 0))
    config = zone_data(["switch.v1"])
    config["zone_id"] = "z1"
    hass_storage[CONFIG_STORE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": CONFIG_STORE_KEY,
        "data": {"settings": {}, "zones": [config]},
    }
    hass_storage[RUNTIME_STORE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": RUNTIME_STORE_KEY,
        "data": {
            "open_valves": [
                {
                    "entity_id": "switch.v1",
                    "zone_id": "z1",
                    "origin": "manual",
                    "started_at": at_local(6, 0).isoformat(),
                    "ends_at": at_local(6, 10).isoformat(),
                }
            ],
            "pending": [],
            "next_seq": 1,
            "last_alive": at_local(7, 59).isoformat(),
        },
    }
    switches.add("switch.v1", STATE_ON)
    events = async_capture_events(hass, EVENT_VALVE_OVERRUN)

    manager = await start_manager(hass)
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.open_valves == {}
    assert [event.data["entity_id"] for event in events] == ["switch.v1"]
    manager.async_shutdown()


async def test_manual_valve_turns_off_on_time(hass: HomeAssistant, manager, switches, freezer) -> None:
    freezer.move_to(at_local(9, 0))
    await add_zone(manager, switches, ["switch.v1"], duration=10)
    # encendida fuera de la integración
    hass.states.async_set("switch.v1", STATE_ON)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert manager.valve_origin("switch.v1") == ORIGIN_EXTERNAL

    await fire_at(hass, freezer, at_local(9, 10, 1))
    assert hass.states.get("switch.v1").state == STATE_OFF


async def test_rain_skip_blocks_the_block(hass: HomeAssistant, manager, switches, freezer, monkeypatch) -> None:
    async def past_rain(_hass, _entity_id, _hours):
        return 20.0, None

    async def forecast(_hass, _entity_id):
        return None, None

    monkeypatch.setattr(f"{RAIN_SOURCE_TARGET}.async_past_rain", past_rain)
    monkeypatch.setattr(f"{RAIN_SOURCE_TARGET}.async_forecast", forecast)
    freezer.move_to(at_local(5, 0))
    settings, issues = await manager.async_save_settings({"rain_sensor": "sensor.lluvia"})
    assert settings is not None, issues
    await add_zone(manager, switches, ["switch.v1"], start="06:00", rain_skip=True)
    events = async_capture_events(hass, EVENT_BLOCK_SKIPPED)

    # T-10: la decisión se toma y se emite el evento
    await fire_at(hass, freezer, at_local(5, 50))
    assert len(events) == 1

    await fire_at(hass, freezer, at_local(6, 0))
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.pending == []
    assert manager.runtime.open_valves == {}


async def test_delete_zone_keeps_zone_when_turn_off_fails(hass: HomeAssistant, manager, switches) -> None:
    zone_id = await add_zone(manager, switches, ["switch.v1"])
    await manager.async_run_valve("switch.v1")
    await hass.async_block_till_done(wait_background_tasks=True)
    switches.fail_off.add("switch.v1")

    with pytest.raises(ZoneDeleteError) as err:
        await manager.async_delete_zone(zone_id)
    assert err.value.reason == ZONE_DELETE_VALVES_ON
    assert zone_id in manager.config.zones
    # el hueco se libera igualmente
    assert manager.runtime.open_valves == {}
