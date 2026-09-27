"""Reglas de validación V1–V11 (00-overview.md §5). Sin dependencias de HA."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .const import MODE_AUTO, NOTIFY_PREFIX
from .model import Config, Settings, Zone

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


@dataclass(frozen=True)
class Issue:
    """Error de validación. `path` señala el campo, p. ej. ("valves", 2, "frequency")."""

    rule: str
    path: tuple[str | int, ...]

    def to_dict(self) -> dict[str, Any]:
        return {"rule": self.rule, "path": list(self.path)}


def _is_int(value: Any) -> bool:
    # bool es subclase de int en Python: se excluye
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def validate_zone(zone: Zone, config: Config) -> list[Issue]:
    """Valida una zona contra el resto de la instalación."""
    issues: list[Issue] = []

    if not zone.name.strip():
        issues.append(Issue("name", ("name",)))
    if not zone.days or any(not _is_int(d) or not 0 <= d <= 6 for d in zone.days):
        # Validar que days no esté vacío y todos los valores sean enteros en rango 0–6 (lunes=0, domingo=6)
        issues.append(Issue("V4", ("days",)))
    if not zone.start_times:
        issues.append(Issue("V5", ("start_times",)))

    seen: set[str] = set()
    for index, start in enumerate(zone.start_times):
        if not _TIME_RE.match(start):
            issues.append(Issue("time", ("start_times", index)))
        elif start in seen:
            issues.append(Issue("V6", ("start_times", index)))
        seen.add(start)

    if not _is_int(zone.max_simultaneous) or zone.max_simultaneous < 1:
        issues.append(Issue("V9", ("max_simultaneous",)))
    if zone.mode == MODE_AUTO and zone.calc_method is None:
        issues.append(Issue("V8", ("mode",)))

    # switch usadas por otras zonas (V7)
    used = {
        valve.entity_id
        for other in config.zones.values()
        if other.zone_id != zone.zone_id
        for valve in other.valves
    }
    blocks = len(zone.start_times)
    local: set[str] = set()
    for index, valve in enumerate(zone.valves):
        if not valve.entity_id.startswith("switch."):
            issues.append(Issue("V1", ("valves", index, "entity_id")))
        elif valve.entity_id in used or valve.entity_id in local:
            issues.append(Issue("V7", ("valves", index, "entity_id")))
        local.add(valve.entity_id)
        if not _is_int(valve.duration_min) or valve.duration_min < 1:
            issues.append(Issue("V2", ("valves", index, "duration_min")))
        if not _is_int(valve.frequency) or not 1 <= valve.frequency <= blocks:
            issues.append(Issue("V3", ("valves", index, "frequency")))

    for kind, entity_id in zone.sensors.items():
        if entity_id is not None and not entity_id.startswith("sensor."):
            issues.append(Issue("entity", ("sensors", kind)))

    return issues


def validate_settings(settings: Settings) -> list[Issue]:
    """Valida la configuración global."""
    issues: list[Issue] = []

    limit = settings.global_max_valves
    if limit is not None and (not _is_int(limit) or limit < 1):
        issues.append(Issue("V9", ("global_max_valves",)))

    for index, target in enumerate(settings.notify_targets):
        if not target.startswith(NOTIFY_PREFIX):
            issues.append(Issue("notify", ("notify_targets", index)))

    if settings.rain_sensor is not None and not settings.rain_sensor.startswith("sensor."):
        issues.append(Issue("entity", ("rain_sensor",)))
    if settings.weather_entity is not None and not settings.weather_entity.startswith("weather."):
        issues.append(Issue("entity", ("weather_entity",)))

    if not _is_int(settings.rain_past_hours) or not 1 <= settings.rain_past_hours <= 24:
        issues.append(Issue("V10", ("rain_past_hours",)))
    if not _is_number(settings.rain_past_threshold_mm) or settings.rain_past_threshold_mm <= 0:
        issues.append(Issue("V10", ("rain_past_threshold_mm",)))
    if not _is_int(settings.rain_forecast_hours) or not 1 <= settings.rain_forecast_hours <= 48:
        issues.append(Issue("V11", ("rain_forecast_hours",)))
    if (
        not _is_number(settings.rain_forecast_threshold_mm)
        or settings.rain_forecast_threshold_mm <= 0
    ):
        issues.append(Issue("V11", ("rain_forecast_threshold_mm",)))

    return issues
