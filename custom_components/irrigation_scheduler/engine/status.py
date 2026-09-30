"""Vistas de estado para entidades y WebSocket: funciones puras sobre runtime y config.

Solo leen; no toman el lock ni mutan nada. El manager las expone con métodos delegados.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from ..const import ORIGIN_EXTERNAL, ORIGIN_IDLE, OVERRUN_MARGIN, STATUS_IDLE, STATUS_QUEUED, STATUS_RUNNING
from ..domain.model import Config, Valve, Zone
from ..domain.rain import RainState
from ..domain.runtime import RuntimeState
from .manual import manual_ends
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


def overdue_valves(runtime: RuntimeState, now: datetime) -> list[tuple[str, str]]:
    """Propias pasadas de tiempo (03 §5.3.1): (zone_id, entity_id), en orden de open_valves.

    Solo el cálculo; el latido marca cada una como cerrándose con el lock.
    """
    return [
        (valve.zone_id, entity_id)
        for entity_id, valve in list(runtime.open_valves.items())
        if now > valve.ends_at + OVERRUN_MARGIN
    ]


def manual_overdue(
    manual: list[tuple[Zone, Valve, datetime]], now: datetime
) -> list[tuple[str, str, int]]:
    """Encendidas a mano más de su duration_min (03 §5.3.2): (zone_id, entity_id, minutos)."""
    return [
        (zone.zone_id, valve.entity_id, valve.duration_min)
        for zone, valve, since in manual
        if now > manual_ends(valve, since) + OVERRUN_MARGIN
    ]
