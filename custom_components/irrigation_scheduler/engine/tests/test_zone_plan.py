"""manager.zone_plan: un solo cálculo del plan de zona, delegado en status.zone_plan_for."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from custom_components.irrigation_scheduler.engine import status

from ...conftest import add_zone, at_local


async def test_zone_plan_unknown_zone(hass: HomeAssistant, manager) -> None:
    assert manager.zone_plan("missing") == (None, None)


async def test_zone_plan_matches_status(hass: HomeAssistant, manager, switches, freezer) -> None:
    freezer.move_to(at_local(5, 0))
    zone_id = await add_zone(manager, switches, ["switch.v1"], start="06:00")

    plan = manager.zone_plan(zone_id)
    assert plan == status.zone_plan_for(manager.config, manager.runtime, manager.rain, manager._needs_rain, zone_id)
    # sin lluvia configurada no hay P, pero sí próximo riego
    assert plan[0] is None
    assert plan[1] is not None
