"""Voz en altavoces y pantallas por tts.speak (docs/alerts/cast-notifies/spec.md §4)."""

from __future__ import annotations

import asyncio
import logging
import time

from homeassistant.const import STATE_BUFFERING, STATE_PLAYING, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)

# límite por llamada de servicio, como el push
SERVICE_TIMEOUT_S = 30
# tts.speak vuelve al empezar a sonar: se espera a que acabe para no cortar el siguiente aviso
PLAYBACK_WAIT_S = 60
# margen para que el altavoz pase a «playing» tras la llamada
PLAYBACK_START_S = 2
PLAYBACK_POLL_S = 1


def speech_text(title: str, message: str) -> str:
    """Frase hablada: título delante y « · » cambiado por coma (spec §4.1)."""
    return f"{title}. {message.replace(' · ', ', ')}"


async def async_say(
    hass: HomeAssistant, speaker: str, tts_entity: str, volume: float | None, text: str
) -> None:
    """Fija el volumen si se pide y lanza tts.speak. Propaga los errores (los usa «Probar»)."""
    async with asyncio.timeout(SERVICE_TIMEOUT_S):
        if volume is not None:
            await hass.services.async_call(
                "media_player",
                "volume_set",
                {"entity_id": speaker, "volume_level": volume},
                blocking=True,
            )
        await hass.services.async_call(
            "tts",
            "speak",
            {"entity_id": tts_entity, "media_player_entity_id": speaker, "message": text},
            blocking=True,
        )


async def async_speak_one(
    hass: HomeAssistant, speaker: str, tts_entity: str, volume: float | None, text: str
) -> None:
    """Dice el aviso en un altavoz y espera a que termine. Nunca propaga errores."""
    state = hass.states.get(speaker)
    if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        _LOGGER.warning("Altavoz %s no disponible: no se dice el aviso", speaker)
        return
    try:
        await async_say(hass, speaker, tts_entity, volume, text)
    except HomeAssistantError as err:
        _LOGGER.error("No se pudo hablar en %s: %s", speaker, err)
        return
    except TimeoutError:
        _LOGGER.error("No se pudo hablar en %s: sin respuesta en %s s", speaker, SERVICE_TIMEOUT_S)
        return
    await _async_wait_playback(hass, speaker)


async def _async_wait_playback(hass: HomeAssistant, speaker: str) -> None:
    deadline = time.monotonic() + PLAYBACK_WAIT_S
    await asyncio.sleep(PLAYBACK_START_S)
    while time.monotonic() < deadline:
        state = hass.states.get(speaker)
        if state is None or state.state not in (STATE_PLAYING, STATE_BUFFERING):
            return
        await asyncio.sleep(PLAYBACK_POLL_S)
