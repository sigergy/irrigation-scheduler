"""Switch encendidas a mano: detección, fin previsto y sensor de suministro (03 §5.3)."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta

from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant

from ..domain.model import Valve, Zone


def manual_on(hass: HomeAssistant, zones: Iterable[Zone], busy: set[str]) -> list[tuple[Zone, Valve, datetime]]:
    """Switch configuradas encendidas a mano: en `on` y fuera de la gestión propia (03 §5.3)."""
    result: list[tuple[Zone, Valve, datetime]] = []
    for zone in zones:
        for valve in zone.valves:
            if valve.entity_id in busy:
                continue
            state = hass.states.get(valve.entity_id)
            if state is not None and state.state == STATE_ON:
                result.append((zone, valve, state.last_changed))
    return result


def manual_ends(valve: Valve, since: datetime) -> datetime:
    """Fin de una switch encendida a mano: su último paso a on + duration_min (03 §5.3.2)."""
    return since + timedelta(minutes=valve.duration_min)


def supply_on(hass: HomeAssistant, valve: Valve) -> bool:
    """El sensor de suministro de la válvula indica falta de agua."""
    if not valve.supply_sensor:
        return False
    state = hass.states.get(valve.supply_sensor)
    return state is not None and state.state == STATE_ON
