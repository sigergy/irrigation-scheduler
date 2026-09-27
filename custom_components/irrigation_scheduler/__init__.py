"""Irrigation Scheduler: zonas de riego con panel propio."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .manager import IrrigationConfigEntry, IrrigationManager
from .services import async_register_services
from .store import IrrigationStore
from .valves import async_set_valve
from .websocket import async_register_websocket

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

PLATFORMS = [Platform.BUTTON, Platform.SELECT, Platform.SENSOR, Platform.SWITCH]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    # WebSocket y servicios se registran una vez, aunque la entry se recargue
    async_register_websocket(hass)
    async_register_services(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: IrrigationConfigEntry) -> bool:
    manager = IrrigationManager(hass, entry.entry_id, IrrigationStore(hass))
    await manager.async_setup()
    entry.runtime_data = manager
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: IrrigationConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        entry.runtime_data.async_shutdown()
    return unloaded


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Al borrar la integración se apagan todas las válvulas abiertas y se borran los dos Store.

    Si se desinstala sin apagar las válvulas, quedarían regando indefinidamente sin supervisión.
    """
    store = IrrigationStore(hass)
    _config, runtime = await store.async_load()

    # Apagar todas las válvulas que estén abiertas
    for open_valve in runtime.open_valves.values():
        await async_set_valve(hass, open_valve.entity_id, turn_on=False)

    # Borrar persistencia
    await store.async_remove()
