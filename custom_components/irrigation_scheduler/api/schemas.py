"""Schemas voluptuous de WebSocket y servicios."""

from __future__ import annotations

import voluptuous as vol
from homeassistant.helpers import config_validation as cv

from ..const import MODES, SENSOR_KINDS
from ..domain.alerts import ALERT_TYPES, PRIORITIES

VALVE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): str,
        vol.Required("name"): str,
        vol.Required("duration_min"): int,
        vol.Required("start_times"): [str],
        vol.Optional("enabled", default=True): bool,
        vol.Optional("supply_sensor", default=None): vol.Any(None, str),
    }
)

ZONE_SCHEMA = vol.Schema(
    {
        vol.Optional("zone_id"): vol.Any(None, str),
        vol.Required("name"): str,
        vol.Optional("icon", default=None): vol.Any(None, cv.icon),
        vol.Required("enabled"): bool,
        vol.Required("mode"): vol.In(MODES),
        vol.Required("days"): [vol.All(int, vol.Range(min=0, max=6))],
        vol.Required("start_times"): [str],
        vol.Required("max_simultaneous"): int,
        vol.Required("rain_skip"): bool,
        vol.Optional("sensors"): {vol.Optional(kind): vol.Any(None, str) for kind in SENSOR_KINDS},
        vol.Optional("calc_method"): vol.Any(None, str),
        vol.Required("valves"): [VALVE_SCHEMA],
    }
)

ALERT_SCHEMA = vol.Schema(
    {
        vol.Required("push"): bool,
        vol.Required("targets"): vol.Any(None, [str]),
        vol.Required("priority"): vol.Any(None, vol.In(PRIORITIES)),
        vol.Required("show_in_history"): bool,
        # opcionales: un panel viejo en caché no las envía
        vol.Optional("voice"): bool,
        vol.Optional("voice_targets"): vol.Any(None, [str]),
    }
)

SETTINGS_SCHEMA = vol.Schema(
    {
        vol.Optional("global_max_valves"): vol.Any(None, int),
        vol.Optional("notify_targets"): [str],
        vol.Optional("speaker_targets"): [str],
        vol.Optional("tts_entity"): vol.Any(None, str),
        vol.Optional("tts_volume"): vol.Any(None, int, float),
        vol.Optional("rain_sensor"): vol.Any(None, str),
        vol.Optional("rain_past_hours"): int,
        vol.Optional("rain_past_threshold_mm"): vol.Any(int, float),
        vol.Optional("weather_entity"): vol.Any(None, str),
        vol.Optional("rain_forecast_hours"): int,
        vol.Optional("rain_forecast_threshold_mm"): vol.Any(int, float),
        # horario silencioso "HH:MM"; el formato lo valida V16
        vol.Optional("quiet_start"): vol.Any(None, str),
        vol.Optional("quiet_end"): vol.Any(None, str),
        vol.Optional("alerts"): {vol.In(list(ALERT_TYPES)): ALERT_SCHEMA},
    }
)

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
