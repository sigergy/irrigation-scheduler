"""Irrigation Scheduler: zonas de riego con panel propio."""

from __future__ import annotations

import hashlib
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .card_resource import async_ensure_card_resource, async_remove_card_resource
from .const import DOMAIN, FRONTEND_FILE, FRONTEND_URL, PANEL_ELEMENT, PANEL_ICON, PANEL_URL_PATH
from .manager import IrrigationConfigEntry, IrrigationManager
from .services import async_register_services
from .store import IrrigationStore
from .valves import async_set_valve
from .websocket import async_register_websocket

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

PLATFORMS = [
    Platform.BINARY_SENSOR,
    Platform.BUTTON,
    Platform.EVENT,
    Platform.SELECT,
    Platform.SENSOR,
    Platform.SWITCH,
]


def _bundle_hash() -> str:
    return hashlib.sha256((Path(__file__).parent / FRONTEND_FILE).read_bytes()).hexdigest()[:12]


async def _async_module_url(hass: HomeAssistant) -> str:
    # ?v= con el hash del bundle: cada build invalida la caché del navegador,
    # aunque no cambie la versión de manifest.json
    return f"{FRONTEND_URL}?v={await hass.async_add_executor_job(_bundle_hash)}"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    # WebSocket y servicios se registran una vez, aunque la entry se recargue
    async_register_websocket(hass)
    async_register_services(hass)
    # static path y recurso de la tarjeta, también una vez: un static path no se puede quitar
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(Path(__file__).parent / FRONTEND_FILE), False)]
    )
    module_url = await _async_module_url(hass)
    # recurso de Lovelace en modo storage; add_extra_js_url solo como respaldo (modo YAML o fallo)
    if not await async_ensure_card_resource(hass, module_url):
        frontend.add_extra_js_url(hass, module_url)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: IrrigationConfigEntry) -> bool:
    manager = IrrigationManager(hass, entry.entry_id, IrrigationStore(hass))
    await manager.async_setup()
    entry.runtime_data = manager
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title="Riego" if hass.config.language.startswith("es") else "Irrigation",
        sidebar_icon=PANEL_ICON,
        module_url=await _async_module_url(hass),
        require_admin=False,
        config={},
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: IrrigationConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
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

    # Quitar el recurso de Lovelace de la tarjeta
    await async_remove_card_resource(hass)
