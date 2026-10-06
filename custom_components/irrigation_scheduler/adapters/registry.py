"""Registros de dispositivos y entidades de HA: renombrar, borrar y resolver entity_id."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from ..const import DOMAIN
from ..domain.model import Config, Zone
from ..entities.unique_ids import installation_uid, valve_uid, zone_uid


def rename_device(hass: HomeAssistant, zone: Zone) -> None:
    registry = dr.async_get(hass)
    if device := registry.async_get_device(identifiers={(DOMAIN, zone.zone_id)}):
        registry.async_update_device(device.id, name=zone.name)


def remove_zone_entities(hass: HomeAssistant, entry_id: str, zone_id: str) -> None:
    entities = er.async_get(hass)
    for entry in er.async_entries_for_config_entry(entities, entry_id):
        if entry.unique_id.startswith(f"{zone_id}_"):
            _remove_entity(hass, entry.entity_id)
    devices = dr.async_get(hass)
    if device := devices.async_get_device(identifiers={(DOMAIN, zone_id)}):
        devices.async_remove_device(device.id)


def remove_valve_entities(hass: HomeAssistant, zone_id: str, entity_ids: set[str]) -> None:
    """Quita el event y los sensores «Modo riego» y «Fin riego» de las válvulas que salen de la zona (decisión 4)."""
    entities = er.async_get(hass)
    for entity_id in entity_ids:
        for domain, key in (("event", "valve_alerts"), ("sensor", "valve_mode"), ("sensor", "valve_end")):
            unique_id = valve_uid(zone_id, key, entity_id)
            if registry_id := entities.async_get_entity_id(domain, DOMAIN, unique_id):
                _remove_entity(hass, registry_id)


def remove_rain_entities(hass: HomeAssistant, config: Config, rain_configured: bool) -> None:
    """Quita las entidades de lluvia de las fuentes que ya no están configuradas (§8.28)."""
    settings = config.settings
    unused: list[tuple[str, str]] = []
    if settings.rain_sensor is None:
        unused.append(("sensor", installation_uid("rain_past")))
    if settings.weather_entity is None:
        unused.append(("sensor", installation_uid("rain_forecast")))
        unused.append(("sensor", installation_uid("rain_estimated")))
    if not rain_configured:
        unused += [("binary_sensor", zone_uid(zone_id, "rain_skip_next")) for zone_id in config.zones]
    entities = er.async_get(hass)
    for domain, unique_id in unused:
        if registry_id := entities.async_get_entity_id(domain, DOMAIN, unique_id):
            _remove_entity(hass, registry_id)


def _remove_entity(hass: HomeAssistant, registry_id: str) -> None:
    """Borra la entidad del registro."""
    er.async_get(hass).async_remove(registry_id)


def registry_id(hass: HomeAssistant, domain: str, unique_id: str) -> str | None:
    """entity_id de una entidad propia en el registro; None si aún no existe."""
    return er.async_get(hass).async_get_entity_id(domain, DOMAIN, unique_id)


def history_entities(hass: HomeAssistant, zone: Zone) -> dict[str, Any]:
    """Entidades que lee la tarjeta de histórico: event de la zona; sensor y event por válvula."""
    return {
        "alerts": registry_id(hass, "event", zone_uid(zone.zone_id, "alerts")),
        "valves": {
            valve.entity_id: {
                "mode": registry_id(hass, "sensor", valve_uid(zone.zone_id, "valve_mode", valve.entity_id)),
                "alerts": registry_id(hass, "event", valve_uid(zone.zone_id, "valve_alerts", valve.entity_id)),
            }
            for valve in zone.valves
        },
    }
