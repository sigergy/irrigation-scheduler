"""Formatos de unique_id. No cambiar: el registro de HA los usa como clave."""

from __future__ import annotations

from ..const import INSTALLATION_ID


def zone_uid(zone_id: str, key: str) -> str:
    return f"{zone_id}_{key}"


def installation_uid(key: str) -> str:
    return f"{INSTALLATION_ID}_{key}"


def valve_uid(zone_id: str, key: str, entity_id: str) -> str:
    # prefijo zone_id: borrar la zona la borra también (adapters/registry.remove_zone_entities)
    return f"{zone_id}_{key}_{entity_id}"
