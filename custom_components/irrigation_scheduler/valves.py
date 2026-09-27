"""Encendido y apagado de válvulas con verificación y reintentos (03 §6)."""

from __future__ import annotations

import asyncio
import logging

from homeassistant.const import ATTR_ENTITY_ID, SERVICE_TURN_OFF, SERVICE_TURN_ON, STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import SWITCH_RETRIES, VERIFY_DELAY_S

_LOGGER = logging.getLogger(__name__)


async def async_set_valve(hass: HomeAssistant, entity_id: str, turn_on: bool) -> bool:
    """Devuelve True si la switch llega al estado pedido. 1 intento + SWITCH_RETRIES."""
    service = SERVICE_TURN_ON if turn_on else SERVICE_TURN_OFF
    target = STATE_ON if turn_on else STATE_OFF
    for attempt in range(1 + SWITCH_RETRIES):
        try:
            await hass.services.async_call(
                "switch", service, {ATTR_ENTITY_ID: entity_id}, blocking=True
            )
        except HomeAssistantError as err:
            _LOGGER.warning("%s %s, intento %s: %s", service, entity_id, attempt + 1, err)
        # se verifica leyendo el estado resultante; unavailable cuenta como fallo
        await asyncio.sleep(VERIFY_DELAY_S)
        state = hass.states.get(entity_id)
        if state is not None and state.state == target:
            return True
    _LOGGER.error("%s %s sin respuesta tras %s reintentos", service, entity_id, SWITCH_RETRIES)
    return False
