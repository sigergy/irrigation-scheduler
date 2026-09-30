"""Alta incremental de entidades cuando cambia la configuración."""

from __future__ import annotations

from collections.abc import Callable, Hashable, Iterable
from typing import TYPE_CHECKING

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from ..const import SIGNAL_ZONE_ADDED

if TYPE_CHECKING:
    from ..errors import IrrigationConfigEntry
    from ..manager import IrrigationManager


class KnownSet[T: Hashable]:
    """Recuerda qué ya tiene entidad. Las quitadas las borra el manager; aquí solo se olvidan."""

    def __init__(self) -> None:
        self._known: set[T] = set()

    def sync(self, current: Iterable[T]) -> list[T]:
        """Devuelve, en el orden de `current`, las que aún no tienen entidad."""
        items = list(current)
        self._known.intersection_update(items)
        new = [item for item in items if item not in self._known]
        self._known.update(new)
        return new


def on_zones(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    manager: IrrigationManager,
    add_zone: Callable[[str], None],
) -> None:
    """Llama a `add_zone` con cada zona existente y con cada alta posterior."""
    for zone_id in manager.config.zones:
        add_zone(zone_id)
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_ZONE_ADDED, callback(add_zone)))
