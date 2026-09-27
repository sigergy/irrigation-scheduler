"""Servicios run_zone, run_valve y stop (01-backend.md §2.3)."""

from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .manager import IrrigationManager

RUN_ZONE_SCHEMA = vol.Schema({vol.Required("zone_id"): cv.string})
RUN_VALVE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Optional("minutes"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)
STOP_SCHEMA = vol.Schema({vol.Optional("zone_id"): cv.string})


def _manager(hass: HomeAssistant) -> IrrigationManager:
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")


def async_register_services(hass: HomeAssistant) -> None:
    async def run_zone(call: ServiceCall) -> None:
        await _manager(hass).async_run_zone(call.data["zone_id"])

    async def run_valve(call: ServiceCall) -> None:
        await _manager(hass).async_run_valve(call.data["entity_id"], call.data.get("minutes"))

    async def stop(call: ServiceCall) -> None:
        await _manager(hass).async_stop(call.data.get("zone_id"))

    hass.services.async_register(DOMAIN, "run_zone", run_zone, RUN_ZONE_SCHEMA)
    hass.services.async_register(DOMAIN, "run_valve", run_valve, RUN_VALVE_SCHEMA)
    hass.services.async_register(DOMAIN, "stop", stop, STOP_SCHEMA)
