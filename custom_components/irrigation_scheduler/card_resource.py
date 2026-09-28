"""Alta de la tarjeta como recurso de Lovelace.

add_extra_js_url importa el bundle en paralelo con app.js de HA y puede terminar antes de que
HA sustituya window.customElements: la tarjeta queda en un registro que Lovelace no consulta.
Un recurso de Lovelace se carga con el frontend ya arrancado, como el panel y las tarjetas de HACS.
Solo existe en modo storage; en modo YAML se sigue usando add_extra_js_url.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_STORAGE
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant

from .const import FRONTEND_URL

_LOGGER = logging.getLogger(__name__)

RESOURCE_TYPE = "module"


def _is_card_resource(item: dict[str, Any]) -> bool:
    # se compara sin ?v=: cada build cambia el hash
    return str(item.get("url", "")).split("?")[0] == FRONTEND_URL


async def _async_storage_resources(hass: HomeAssistant) -> ResourceStorageCollection | None:
    """Colección de recursos cargada; None en modo YAML o sin Lovelace."""
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or lovelace.resource_mode != MODE_STORAGE:
        return None
    resources = lovelace.resources
    if not isinstance(resources, ResourceStorageCollection):
        return None
    # misma guarda que ResourceStorageCollection._async_ensure_loaded
    if not resources.loaded:
        await resources.async_load()
        resources.loaded = True
    return resources


async def async_ensure_card_resource(hass: HomeAssistant, url: str) -> bool:
    """Deja un único recurso de la tarjeta con la URL actual.

    False si no se pudo (modo YAML o fallo de la API interna de Lovelace): el llamante
    recurre a add_extra_js_url.
    """
    try:
        resources = await _async_storage_resources(hass)
        if resources is None:
            return False
        existing = [item for item in resources.async_items() if _is_card_resource(item)]
        if not existing:
            await resources.async_create_item({"res_type": RESOURCE_TYPE, "url": url})
            return True
        first, *duplicates = existing
        if first.get("url") != url or first.get("type") != RESOURCE_TYPE:
            await resources.async_update_item(first["id"], {"res_type": RESOURCE_TYPE, "url": url})
        for item in duplicates:
            await resources.async_delete_item(item["id"])
    except Exception:
        # API interna de HA: si cambia, la tarjeta sigue cargando por add_extra_js_url
        _LOGGER.exception("No se pudo registrar la tarjeta como recurso de Lovelace")
        return False
    return True


async def async_remove_card_resource(hass: HomeAssistant) -> None:
    """Quita el recurso al borrar la integración: si quedara, tras reiniciar se pediría un fichero que no se sirve."""
    try:
        resources = await _async_storage_resources(hass)
        if resources is None:
            return
        for item in [item for item in resources.async_items() if _is_card_resource(item)]:
            await resources.async_delete_item(item["id"])
    except Exception:
        _LOGGER.exception("No se pudo quitar el recurso de Lovelace de la tarjeta")
