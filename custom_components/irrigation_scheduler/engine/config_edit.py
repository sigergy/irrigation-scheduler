"""Validación y preparación de cambios de configuración antes de aplicarlos.

Puro respecto al runtime: no toca RuntimeState, ValveSlots, el lock ni hass.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from homeassistant.exceptions import ServiceValidationError

from ..const import DOMAIN, MODE_AUTO, MODES
from ..domain.model import Config, Settings, Zone
from ..domain.validation import Issue, validate_settings, validate_zone

ZONE_OPTIONS = ("enabled", "rain_skip", "mode")


def require_zone(config: Config, zone_id: str) -> Zone:
    if (zone := config.zones.get(zone_id)) is None:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="unknown_zone",
            translation_placeholders={"zone_id": zone_id},
        )
    return zone


def prepare_zone(config: Config, data: dict[str, Any]) -> tuple[Zone | None, list[Issue], bool]:
    """Zona lista para guardar, o sus issues V1–V14; y si es un alta (sin zone_id)."""
    is_new = not data.get("zone_id")
    if is_new:
        data = {**data, "zone_id": uuid4().hex}
    else:
        require_zone(config, data["zone_id"])
    zone = Zone.from_dict(data)
    if issues := validate_zone(zone, config):
        return None, issues, is_new
    zone.start_times.sort()
    for valve in zone.valves:
        valve.start_times.sort()
    return zone, [], is_new


def prepare_settings(config: Config, data: dict[str, Any]) -> tuple[Settings | None, list[Issue]]:
    """Ajustes actuales fusionados con `data`, o sus issues."""
    settings = Settings.from_dict({**config.settings.to_dict(), **data})
    if issues := validate_settings(settings, config):
        return None, issues
    return settings, []


def check_zone_option(zone: Zone, key: str, value: Any) -> None:
    """Valor de una opción de zona; `key` ya está en ZONE_OPTIONS y no es `enabled`."""
    if key == "mode":
        if value not in MODES:
            raise ValueError(value)
        if value == MODE_AUTO and zone.calc_method is None:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="auto_unavailable"
            )
