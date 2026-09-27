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
        "overrun": "{zone}: {entity} excedió su tiempo con HA parado. Apagada a las {time}.",
        "sensor_unavailable": "{zone}: el sensor {entity} está {state} desde las {time}.",
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
        "overrun": "{zone}: {entity} exceeded its time while HA was down. Turned off at {time}.",
        "sensor_unavailable": "{zone}: sensor {entity} is {state} since {time}.",
    },
}


async def async_push(
    hass: HomeAssistant, targets: list[str], kind: str, priority: str, **fields: str
) -> None:
    """Envía el push a cada `notify.mobile_app_*`. Sin destinos no hace nada (03 §7.1)."""
    if not targets:
        return
    texts = MESSAGES["es" if hass.config.language.startswith("es") else "en"]
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
