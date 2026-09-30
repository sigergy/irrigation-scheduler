"""Persistencia: configuración y runtime en dos Store versionados (01 §2.1)."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from ..const import (
    CONFIG_STORE_KEY,
    CONFIG_STORE_VERSION,
    RUNTIME_SAVE_DELAY_S,
    RUNTIME_STORE_KEY,
    RUNTIME_STORE_VERSION,
)
from ..domain.model import Config
from ..domain.runtime import RuntimeState

_LOGGER = logging.getLogger(__name__)


class IrrigationStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._config: Store[dict[str, Any]] = Store(hass, CONFIG_STORE_VERSION, CONFIG_STORE_KEY)
        self._runtime: Store[dict[str, Any]] = Store(
            hass, RUNTIME_STORE_VERSION, RUNTIME_STORE_KEY
        )

    async def async_load(self) -> tuple[Config, RuntimeState]:
        config_data = await self._config.async_load() or {}
        runtime_data = await self._runtime.async_load() or {}
        return Config.from_dict(config_data), RuntimeState.from_dict(runtime_data)

    async def async_save_config(self, config: Config) -> None:
        await self._config.async_save(config.to_dict())

    async def async_save_runtime(self, state: RuntimeState) -> None:
        # se escribe en cada cambio (03 §5.1)
        await self._runtime.async_save(state.to_dict())

    @callback
    def schedule_save_runtime(self, state: RuntimeState) -> None:
        """Escritura diferida: agrupa cambios seguidos y guarda el último estado.

        HA evalúa `to_dict` al escribir y vacía lo pendiente al parar
        (EVENT_HOMEASSISTANT_FINAL_WRITE).
        """
        _LOGGER.debug("runtime: escritura programada")
        self._runtime.async_delay_save(state.to_dict, RUNTIME_SAVE_DELAY_S)

    async def async_flush_runtime(self, state: RuntimeState) -> None:
        """Escribe ya; Store.async_save cancela la diferida pendiente."""
        await self._runtime.async_save(state.to_dict())

    async def async_remove(self) -> None:
        await self._config.async_remove()
        await self._runtime.async_remove()
