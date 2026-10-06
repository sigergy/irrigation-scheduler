"""Espera a la switch de cada válvula interrumpida antes de decidir si se retoma.

Spec: docs/features/06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md §4.2
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from functools import partial

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_point_in_utc_time, async_track_state_change_event


@dataclass
class _Watch:
    """Lo que sigue vivo mientras se espera a una switch."""

    timer: CALLBACK_TYPE | None = None
    unsub_state: CALLBACK_TYPE | None = None


def _ready(state: State | None) -> bool:
    """La switch responde: ni unavailable ni unknown (Zigbee tarda tras un reinicio)."""
    return state is not None and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)


class ResumeWatch:
    """Una espera por switch. No toma el lock del manager ni toca ValveSlots.

    Avisa una sola vez con `on_ready(entity_id, expired)`: False si la switch está lista, True si
    vence el plazo sin ella.
    """

    def __init__(self, hass: HomeAssistant, on_ready: Callable[[str, bool], None]) -> None:
        self.hass = hass
        self._on_ready = on_ready
        self._watches: dict[str, _Watch] = {}

    @callback
    def start(self, entity_id: str, deadline: datetime) -> None:
        """Empieza a esperar hasta `deadline` (UTC). Con una espera ya en marcha sigue la que hay."""
        if entity_id in self._watches:
            return
        if _ready(self.hass.states.get(entity_id)):
            # ya responde: no hay nada que esperar
            self._on_ready(entity_id, False)
            return
        watch = _Watch()
        self._watches[entity_id] = watch
        watch.unsub_state = async_track_state_change_event(self.hass, [entity_id], self._state_changed)
        watch.timer = async_track_point_in_utc_time(self.hass, partial(self._expired, entity_id), deadline)

    @callback
    def cancel(self, entity_id: str) -> None:
        """Para sin avisar: interrupción descartada o ya decidida."""
        self._drop(entity_id)

    @callback
    def cancel_all(self) -> None:
        """Para todas sin avisar: descarga de la entry o parada de HA (§4.8)."""
        for entity_id in list(self._watches):
            self._drop(entity_id)

    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        if entity_id in self._watches and _ready(event.data["new_state"]):
            self._drop(entity_id)
            self._on_ready(entity_id, False)

    @callback
    def _expired(self, entity_id: str, _now: datetime) -> None:
        watch = self._watches.get(entity_id)
        if watch is None:
            return
        # ya ha saltado: no hay que desregistrarlo
        watch.timer = None
        self._drop(entity_id)
        self._on_ready(entity_id, True)

    @callback
    def _drop(self, entity_id: str) -> None:
        watch = self._watches.pop(entity_id, None)
        if watch is None:
            return
        if watch.timer is not None:
            watch.timer()
        if watch.unsub_state is not None:
            watch.unsub_state()
