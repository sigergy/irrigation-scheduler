"""Servicios de control manual (01-backend.md §2.3)."""

from __future__ import annotations

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .api.lookup import require_manager
from .const import DOMAIN

RUN_ZONE_SCHEMA = vol.Schema({vol.Required("zone_id"): cv.string})
RUN_VALVE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Optional("minutes"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)
STOP_SCHEMA = vol.Schema({vol.Optional("zone_id"): cv.string})
PAUSE_VALVE_SCHEMA = vol.Schema({vol.Required("entity_id"): cv.entity_id})
SET_VALVE_ENABLED_SCHEMA = vol.Schema(
    {vol.Required("entity_id"): cv.entity_id, vol.Required("enabled"): cv.boolean}
)
SET_ZONE_ENABLED_SCHEMA = vol.Schema(
    {vol.Required("zone_id"): cv.string, vol.Required("enabled"): cv.boolean}
)


def async_register_services(hass: HomeAssistant) -> None:
    async def run_zone(call: ServiceCall) -> None:
        await require_manager(hass).async_run_zone(call.data["zone_id"])

    async def run_valve(call: ServiceCall) -> None:
        await require_manager(hass).async_run_valve(call.data["entity_id"], call.data.get("minutes"))

    async def stop(call: ServiceCall) -> None:
        await require_manager(hass).async_stop(call.data.get("zone_id"))

    async def pause_valve(call: ServiceCall) -> None:
        await require_manager(hass).async_pause_valve(call.data["entity_id"])

    async def set_valve_enabled(call: ServiceCall) -> None:
        await require_manager(hass).async_set_valve_enabled(call.data["entity_id"], call.data["enabled"])

    async def set_zone_enabled(call: ServiceCall) -> None:
        await require_manager(hass).async_set_zone_enabled(call.data["zone_id"], call.data["enabled"])

    hass.services.async_register(DOMAIN, "run_zone", run_zone, RUN_ZONE_SCHEMA)
    hass.services.async_register(DOMAIN, "run_valve", run_valve, RUN_VALVE_SCHEMA)
    hass.services.async_register(DOMAIN, "stop", stop, STOP_SCHEMA)
    hass.services.async_register(DOMAIN, "pause_valve", pause_valve, PAUSE_VALVE_SCHEMA)
    hass.services.async_register(
        DOMAIN, "set_valve_enabled", set_valve_enabled, SET_VALVE_ENABLED_SCHEMA
    )
    hass.services.async_register(DOMAIN, "set_zone_enabled", set_zone_enabled, SET_ZONE_ENABLED_SCHEMA)
