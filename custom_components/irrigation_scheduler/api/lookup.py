"""Acceso al manager de la entry cargada."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from ..const import DOMAIN

if TYPE_CHECKING:
    from ..engine.manager import IrrigationManager


def loaded_manager(hass: HomeAssistant) -> IrrigationManager | None:
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    return None


def require_manager(hass: HomeAssistant) -> IrrigationManager:
    if manager := loaded_manager(hass):
        return manager
    raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")
