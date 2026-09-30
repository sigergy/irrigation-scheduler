"""Errores y tipos compartidos por plataformas, API y motor."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError

if TYPE_CHECKING:
    from .engine.manager import IrrigationManager


class ZoneDeleteError(HomeAssistantError):
    """El borrado de zona no sigue. `reason`: código WS; `valves`: nombres afectados."""

    def __init__(self, reason: str, valves: list[str]) -> None:
        super().__init__(reason)
        self.reason = reason
        self.valves = valves


# alias perezoso (PEP 695): no importa el manager en tiempo de ejecución
type IrrigationConfigEntry = ConfigEntry[IrrigationManager]
