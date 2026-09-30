"""Vistas de estado para entidades y WebSocket: funciones puras sobre runtime y config.

Solo leen; no toman el lock ni mutan nada. El manager las expone con métodos delegados.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from ..const import ORIGIN_EXTERNAL, ORIGIN_IDLE, STATUS_IDLE, STATUS_QUEUED, STATUS_RUNNING
from ..domain.model import Config, Zone
from ..domain.rain import RainState
from ..domain.runtime import RuntimeState
from .rain_control import ZoneOutlook, zone_plan
from .slots import ValveSlots


def zone_status(runtime: RuntimeState, slots: ValveSlots, zone_id: str) -> str:
    # una apertura ya pausada no cuenta: aún ocupa hueco, pero la zona sale del «Regando»
    opening = slots.visible_opening().values()
    if any(valve.zone_id == zone_id for valve in runtime.open_valves.values()) or (zone_id in opening):
        return STATUS_RUNNING
    if any(job.zone_id == zone_id for job in runtime.pending):
        return STATUS_QUEUED
    return STATUS_IDLE


def zone_plan_for(
    config: Config,
    runtime: RuntimeState,
    rain: RainState,
    needs_rain: Callable[[Zone], bool],
    zone_id: str,
) -> tuple[ZoneOutlook | None, datetime | None]:
    """(P con su predicción o decisión, próximo riego a mostrar) (§8.21)."""
    if (zone := config.zones.get(zone_id)) is None:
        return None, None
    return zone_plan(zone, runtime, rain, config.settings, needs_rain(zone), dt_util.now())


def active_valves(runtime: RuntimeState) -> int:
    return len(runtime.open_valves)


def valve_origin(hass: HomeAssistant, runtime: RuntimeState, slots: ValveSlots, entity_id: str) -> str:
    """Origen del riego de una switch configurada; estado del sensor «Modo riego».

    Abierta o abriéndose por la integración: el origen de su trabajo. Encendida fuera de
    la gestión propia (a mano o tras un turn_off fallido): external. Si no, idle.
    """
    if valve := runtime.open_valves.get(entity_id):
        return valve.origin
    if origin := slots.origin(entity_id):
        return origin
    state = hass.states.get(entity_id)
    return ORIGIN_EXTERNAL if state is not None and state.state == STATE_ON else ORIGIN_IDLE
