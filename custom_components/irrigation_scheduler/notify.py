"""Push a la app móvil de HA (03-valves-execution.md §7)."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

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
        "title": "Riego",
        "turn_on_failed": (
            "{zone}: {entity} no responde al encender tras 3 reintentos ({time}). "
            "Se descarta y la cola sigue."
        ),
        "turn_off_failed": (
            "{zone}: {entity} no responde al apagar tras 3 reintentos ({time}). "
            "Puede seguir regando: revísala ya."
        ),
        "overrun_restart": "{zone}: {entity} excedió su tiempo con HA parado. Apagada a las {time}.",
        "overrun_running": "{zone}: {entity} seguía abierta pasado su tiempo. Apagada a las {time}.",
        "manual_overrun": (
            "{zone}: {entity} estaba encendida a mano más de {minutes} min. Apagada a las {time}."
        ),
        "sensor_unavailable": "{zone}: el sensor {entity} está {state} desde las {time}.",
        "rain_skipped": (
            "Riego omitido por lluvia: {zones}. "
            "No se avisará de más omisiones en estas zonas hasta que vuelvan a regarse."
        ),
        "rain_zone": "{zone} {start} ({amount} {reason})",
        "rain_past": "caídos",
        "rain_forecast": "previstos",
        "rain_source_unavailable": "Sin datos de lluvia: {sources}. {outcome}",
        "rain_sensor": "pluviómetro no disponible",
        "weather_entity": "pronóstico no disponible",
        "rain_and": " y ",
        "rain_water": "Se riega.",
        "rain_other": "Se decide con la otra fuente.",
        "valve_on": "{zone}: {entity} encendida{origin} a las {time}.",
        "valve_off": "{zone}: {entity} apagada a las {time} tras {duration}{origin}.",
        "origin_scheduled": "programado",
        "origin_manual": "manual",
        "origin_external": "externo",
    },
    "en": {
        "title": "Irrigation",
        "turn_on_failed": (
            "{zone}: {entity} did not respond to turn on after 3 retries ({time}). "
            "Job dropped, queue continues."
        ),
        "turn_off_failed": (
            "{zone}: {entity} did not respond to turn off after 3 retries ({time}). "
            "It may still be watering: check it now."
        ),
        "overrun_restart": "{zone}: {entity} exceeded its time while HA was down. Turned off at {time}.",
        "overrun_running": "{zone}: {entity} was still open past its time. Turned off at {time}.",
        "manual_overrun": (
            "{zone}: {entity} was turned on manually for over {minutes} min. Turned off at {time}."
        ),
        "sensor_unavailable": "{zone}: sensor {entity} is {state} since {time}.",
        "rain_skipped": (
            "Irrigation skipped due to rain: {zones}. "
            "No more skips will be notified for these zones until they water again."
        ),
        "rain_zone": "{zone} {start} ({amount} {reason})",
        "rain_past": "fallen",
        "rain_forecast": "forecast",
        "rain_source_unavailable": "No rain data: {sources}. {outcome}",
        "rain_sensor": "rain gauge unavailable",
        "weather_entity": "forecast unavailable",
        "rain_and": " and ",
        "rain_water": "Watering.",
        "rain_other": "Deciding with the other source.",
        "valve_on": "{zone}: {entity} turned on{origin} at {time}.",
        "valve_off": "{zone}: {entity} turned off at {time} after {duration}{origin}.",
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
    hass: HomeAssistant, targets: list[str], kind: str, priority: str, **fields: str
) -> None:
    """Envía el push a cada `notify.mobile_app_*`. Sin destinos no hace nada (03 §7.1)."""
    if not targets:
        return
    texts = _texts(hass)
    payload: dict[str, Any] = {
        "title": texts["title"],
        "message": texts[kind].format(time=dt_util.now().strftime("%H:%M"), **fields),
    }
    if PUSH_DATA[priority]:
        payload["data"] = PUSH_DATA[priority]
    for target in targets:
        domain, service = target.split(".", 1)
        try:
            await hass.services.async_call(domain, service, payload, blocking=True)
        except HomeAssistantError as err:
            _LOGGER.error("No se pudo notificar a %s: %s", target, err)
