"""Push a la app móvil de HA (03-valves-execution.md §7)."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

from .alerts import ALERT_TYPES
from .const import PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_NORMAL

_LOGGER = logging.getLogger(__name__)

# Datos por prioridad. Crítica: 03 §7.2. Alta: decisión del plan (time-sensitive + high).
PUSH_DATA: dict[str, dict[str, Any]] = {
    PRIORITY_CRITICAL: {"push": {"interruption-level": "critical"}, "priority": "high", "ttl": 0},
    PRIORITY_HIGH: {"push": {"interruption-level": "time-sensitive"}, "priority": "high"},
    PRIORITY_NORMAL: {},
}

MESSAGES: dict[str, dict[str, str]] = {
    "es": {
        # cabecera por severidad del tipo (alerts.py)
        "title_error": "Error",
        "title_warning": "Alerta",
        "title_info": "Info",
        # requieren acción: «qué pasa. qué hacer.»
        "turn_on_failed": "{zone} · {entity}: no enciende ({time}). Se salta su riego. Revisa la válvula.",
        "turn_off_failed": (
            "{zone} · {entity}: no se apaga ({time}). Puede seguir regando. Ciérrala a mano ya."
        ),
        "no_water": "{zone} · {entity}: sin agua ({time}). Revisa el suministro.",
        "no_water_closed": "{zone} · {entity}: sin agua ({time}). Válvula cerrada. Revisa el suministro.",
        "sensor_unavailable": "{zone} · {entity}: sensor sin datos desde las {time}. Revisa el sensor.",
        "rain_source_unavailable": "Sin datos de lluvia: {sources}. {outcome} Revisa la fuente.",
        # solo información
        "overrun_restart": "{zone} · {entity}: más de {minutes} min encendida mientras HA estaba caído.",
        "overrun_running": "{zone} · {entity}: abierta más de lo previsto. Apagada a las {time}.",
        "manual_overrun": "{zone} · {entity}: más de {minutes} min encendida a mano. Apagada a las {time}.",
        "rain_skipped": "Riego saltado por lluvia: {zones}. No se repite el aviso hasta el próximo riego.",
        "valve_on": "{zone} · {entity}: encendida a las {time}{origin}.",
        "valve_off": "{zone} · {entity}: apagada a las {time}, {duration} regando{origin}.",
        # trozos
        "rain_zone": "{zone} {start} ({amount} {reason})",
        "rain_past": "caídos",
        "rain_forecast": "previstos",
        "rain_sensor": "pluviómetro",
        "weather_entity": "pronóstico",
        "rain_and": " y ",
        "rain_water": "Se riega igual.",
        "rain_other": "Se usa la otra fuente.",
        "origin_scheduled": "programado",
        "origin_manual": "manual",
        "origin_external": "externo",
    },
    "en": {
        "title_error": "Error",
        "title_warning": "Warning",
        "title_info": "Info",
        "turn_on_failed": "{zone} · {entity}: won't turn on ({time}). Its run is skipped. Check the valve.",
        "turn_off_failed": (
            "{zone} · {entity}: won't turn off ({time}). It may still be watering. "
            "Close it by hand now."
        ),
        "no_water": "{zone} · {entity}: no water ({time}). Check the supply.",
        "no_water_closed": "{zone} · {entity}: no water ({time}). Valve closed. Check the supply.",
        "sensor_unavailable": "{zone} · {entity}: sensor without data since {time}. Check the sensor.",
        "rain_source_unavailable": "No rain data: {sources}. {outcome} Check the source.",
        "overrun_restart": "{zone} · {entity}: on for over {minutes} min while HA was down.",
        "overrun_running": "{zone} · {entity}: open longer than planned. Turned off at {time}.",
        "manual_overrun": "{zone} · {entity}: on by hand for over {minutes} min. Turned off at {time}.",
        "rain_skipped": "Irrigation skipped due to rain: {zones}. No repeat notice until the next run.",
        "valve_on": "{zone} · {entity}: turned on at {time}{origin}.",
        "valve_off": "{zone} · {entity}: turned off at {time}, {duration} watering{origin}.",
        "rain_zone": "{zone} {start} ({amount} {reason})",
        "rain_past": "fallen",
        "rain_forecast": "forecast",
        "rain_sensor": "rain gauge",
        "weather_entity": "forecast",
        "rain_and": " and ",
        "rain_water": "Watering anyway.",
        "rain_other": "Using the other source.",
        "origin_scheduled": "scheduled",
        "origin_manual": "manual",
        "origin_external": "external",
    },
}


def _texts(hass: HomeAssistant) -> dict[str, str]:
    return MESSAGES["es" if hass.config.language.startswith("es") else "en"]


def message_text(hass: HomeAssistant, key: str) -> str:
    """Trozo de texto en el idioma de HA, para componer mensajes por lote (05-rain-skip.md §8.20)."""
    return _texts(hass)[key]


def duration_text(seconds: float) -> str:
    """Tiempo abierta de una válvula para el push: `45 s`, `3 min`, `1 h 5 min` o `1 h`."""
    if seconds < 60:
        return f"{round(seconds)} s"
    minutes = round(seconds / 60)
    if minutes < 60:
        return f"{minutes} min"
    hours, rest = divmod(minutes, 60)
    return f"{hours} h {rest} min" if rest else f"{hours} h"


async def async_push(
    hass: HomeAssistant,
    targets: list[str],
    alert_id: str,
    priority: str,
    *,
    kind: str | None = None,
    **fields: str,
) -> None:
    """Envía el push a cada `notify.mobile_app_*`. Sin destinos no hace nada (03 §7.1).

    `kind`: texto de MESSAGES si no es el del tipo (valve_switched → valve_on / valve_off).
    """
    if not targets:
        return
    texts = _texts(hass)
    payload: dict[str, Any] = {
        "title": texts[f"title_{ALERT_TYPES[alert_id].severity}"],
        "message": texts[kind or alert_id].format(time=dt_util.now().strftime("%H:%M"), **fields),
    }
    if PUSH_DATA[priority]:
        payload["data"] = PUSH_DATA[priority]
    for target in targets:
        domain, service = target.split(".", 1)
        try:
            await hass.services.async_call(domain, service, payload, blocking=True)
        except HomeAssistantError as err:
            _LOGGER.error("No se pudo notificar a %s: %s", target, err)
