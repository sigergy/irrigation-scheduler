"""Persistencia: configuración y runtime en dos Store versionados (01 §2.1)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from ..const import CONFIG_STORE_KEY, CONFIG_STORE_VERSION, RUNTIME_STORE_KEY, RUNTIME_STORE_VERSION
from ..domain.model import Config
from ..domain.runtime import RuntimeState


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

    async def async_remove(self) -> None:
        await self._config.async_remove()
        await self._runtime.async_remove()
