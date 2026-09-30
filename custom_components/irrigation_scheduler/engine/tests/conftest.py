"""Fixtures de los tests de caracterización del manager."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.irrigation_scheduler.adapters.store import IrrigationStore
from custom_components.irrigation_scheduler.manager import IrrigationManager

# rutas que se parchean; al mover módulos solo cambia esto
VALVES_MODULE = "custom_components.irrigation_scheduler.adapters.valves"
RAIN_SOURCE_TARGET = "custom_components.irrigation_scheduler.engine.rain_control"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    return


@pytest.fixture(autouse=True)
def fast_valves(monkeypatch: pytest.MonkeyPatch) -> None:
    # sin la espera real de verificación (2 s por intento)
    monkeypatch.setattr(f"{VALVES_MODULE}.VERIFY_DELAY_S", 0)


class FakeSwitches:
    """Servicios switch.turn_on/turn_off que cambian el estado, con fallos y retención."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.fail_on: set[str] = set()
        self.fail_off: set[str] = set()
        # si está puesto, turn_on espera a que se libere: apertura en curso
        self.gate: asyncio.Event | None = None
        self.calls: list[tuple[str, str]] = []

    def add(self, entity_id: str, state: str = STATE_OFF) -> None:
        self.hass.states.async_set(entity_id, state)

    async def handle(self, call: ServiceCall) -> None:
        entity_id = call.data[ATTR_ENTITY_ID]
        turn_on = call.service == "turn_on"
        self.calls.append((call.service, entity_id))
        if turn_on and self.gate is not None:
            await self.gate.wait()
        if entity_id in (self.fail_on if turn_on else self.fail_off):
            return
        self.hass.states.async_set(entity_id, STATE_ON if turn_on else STATE_OFF)


@pytest.fixture
def switches(hass: HomeAssistant) -> FakeSwitches:
    fake = FakeSwitches(hass)
    hass.services.async_register("switch", "turn_on", fake.handle)
    hass.services.async_register("switch", "turn_off", fake.handle)
    return fake


async def start_manager(hass: HomeAssistant) -> IrrigationManager:
    manager = IrrigationManager(hass, "test_entry", IrrigationStore(hass))
    await manager.async_setup()
    await hass.async_block_till_done(wait_background_tasks=True)
    return manager


@pytest.fixture
async def manager(hass: HomeAssistant, switches: FakeSwitches) -> AsyncIterator[IrrigationManager]:
    started = await start_manager(hass)
    yield started
    started.async_shutdown()
    await hass.async_block_till_done(wait_background_tasks=True)


def zone_data(
    valves: list[str], *, start: str = "06:00", duration: int = 10, max_simultaneous: int = 1,
    rain_skip: bool = False, supply: dict[str, str] | None = None,
) -> dict[str, Any]:
    supply = supply or {}
    return {
        "name": "Huerto",
        "enabled": True,
        "mode": "manual",
        "days": [0, 1, 2, 3, 4, 5, 6],
        "start_times": [start],
        "max_simultaneous": max_simultaneous,
        "rain_skip": rain_skip,
        "valves": [
            {
                "entity_id": entity_id,
                "name": entity_id.split(".", 1)[1],
                "duration_min": duration,
                "start_times": [start],
                "enabled": True,
                "supply_sensor": supply.get(entity_id),
            }
            for entity_id in valves
        ],
    }


async def add_zone(manager: IrrigationManager, switches: FakeSwitches, valves: list[str], **kwargs: Any) -> str:
    for entity_id in valves:
        switches.add(entity_id)
    zone, issues = await manager.async_save_zone(zone_data(valves, **kwargs))
    assert not issues, issues
    assert zone is not None
    await manager.hass.async_block_till_done(wait_background_tasks=True)
    return zone.zone_id


def at_local(hour: int, minute: int, second: int = 0) -> datetime:
    """Hoy a esa hora local, en UTC."""
    today = dt_util.now().date()
    local = datetime(today.year, today.month, today.day, hour, minute, second, tzinfo=dt_util.get_default_time_zone())
    return dt_util.as_utc(local)


async def fire_at(hass: HomeAssistant, freezer: Any, when: datetime) -> None:
    freezer.move_to(when)
    async_fire_time_changed(hass, when)
    await hass.async_block_till_done(wait_background_tasks=True)
