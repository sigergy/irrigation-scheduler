"""Caracterización del manager: fija el comportamiento actual antes del refactor."""

from __future__ import annotations

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant

from custom_components.irrigation_scheduler.const import ORIGIN_SCHEDULED, STATUS_IDLE, STATUS_RUNNING

from .conftest import add_zone, at_local, fire_at


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
