"""Avisos: push a la app móvil de HA (03-valves-execution.md §7), sin bloquear el motor.

El aviso se compone al instante y sale en segundo plano; los canales van en paralelo
(docs/quiet-hours/spec.md §A).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

from ..const import PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_NORMAL
from ..domain.alerts import ALERT_TYPES

_LOGGER = logging.getLogger(__name__)

# límite por llamada de servicio: un destino colgado no retiene su cola para siempre
PUSH_TIMEOUT_S = 30

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


@dataclass(frozen=True)
class Notice:
    """Aviso ya compuesto: lo que necesita cada canal, resuelto en el momento de emitirlo."""

    title: str
    message: str
    push_targets: list[str] = field(default_factory=list)
    push_data: dict[str, Any] = field(default_factory=dict)


def compose_notice(
    hass: HomeAssistant,
    alert_id: str,
    priority: str,
    push_targets: list[str],
    *,
    kind: str | None = None,
    **fields: str,
) -> Notice:
    """Compone el aviso con la hora de ahora, no la del envío (spec §A.2.1).

    `kind`: texto de MESSAGES si no es el del tipo (valve_switched → valve_on / valve_off).
    """
    texts = _texts(hass)
    return Notice(
        title=texts[f"title_{ALERT_TYPES[alert_id].severity}"],
        message=texts[kind or alert_id].format(time=dt_util.now().strftime("%H:%M"), **fields),
        push_targets=list(push_targets),
        push_data=PUSH_DATA[priority],
    )


class Notifier:
    """Envía avisos en segundo plano; quien llama nunca espera a la red (spec §A.2)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        # tareas en curso: se guardan para que no las recoja el GC antes de terminar
        self._tasks: set[asyncio.Task[None]] = set()
        # un lock por destino: dos avisos al mismo móvil salen en el orden en que se emitieron
        self._locks: dict[str, asyncio.Lock] = {}

    def send(self, notice: Notice) -> None:
        """Lanza el envío y vuelve. Sin destinos no hace nada (03 §7.1)."""
        if not notice.push_targets:
            return
        task = self.hass.async_create_background_task(self._async_deliver(notice), "irrigation_notify")
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _async_deliver(self, notice: Notice) -> None:
        # cada canal por su lado: el fallo de uno no frena ni cancela a los demás
        channels = [self._async_push(notice)]
        for result in await asyncio.gather(*channels, return_exceptions=True):
            if isinstance(result, Exception):
                _LOGGER.error("Fallo inesperado al enviar un aviso: %s", result)

    async def _async_push(self, notice: Notice) -> None:
        payload: dict[str, Any] = {"title": notice.title, "message": notice.message}
        if notice.push_data:
            payload["data"] = notice.push_data
        await asyncio.gather(*(self._async_push_one(target, payload) for target in notice.push_targets))

    async def _async_push_one(self, target: str, payload: dict[str, Any]) -> None:
        domain, service = target.split(".", 1)
        async with self._locks.setdefault(target, asyncio.Lock()):
            try:
                async with asyncio.timeout(PUSH_TIMEOUT_S):
                    await self.hass.services.async_call(domain, service, payload, blocking=True)
            except HomeAssistantError as err:
                _LOGGER.error("No se pudo notificar a %s: %s", target, err)
            except TimeoutError:
                _LOGGER.error("No se pudo notificar a %s: sin respuesta en %s s", target, PUSH_TIMEOUT_S)
