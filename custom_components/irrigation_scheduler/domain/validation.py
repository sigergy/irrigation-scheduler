"""Reglas de validación V1–V14 (00-overview.md §5) y V18 (cast-notifies/spec.md §3). Sin dependencias de HA."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ..const import (
    MODE_AUTO,
    NOTIFY_PREFIX,
    RAIN_FORECAST_HOURS_MAX,
    RAIN_FORECAST_HOURS_MIN,
    SPEAKER_PREFIX,
    TTS_PREFIX,
)
from .alerts import ALERT_TYPES
from .model import Config, Settings, Zone

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


@dataclass(frozen=True)
class Issue:
    """Error de validación. `path` señala el campo, p. ej. ("valves", 2, "start_times")."""

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
    # sensores de suministro usados por otras zonas (V14)
    used_supply = {
        valve.supply_sensor
        for other in config.zones.values()
        if other.zone_id != zone.zone_id
        for valve in other.valves
        if valve.supply_sensor
    }
    zone_times = set(zone.start_times)
    local: set[str] = set()
    local_supply: set[str] = set()
    for index, valve in enumerate(zone.valves):
        if not valve.name.strip():
            issues.append(Issue("V12", ("valves", index, "name")))
        if not valve.entity_id.startswith("switch."):
            issues.append(Issue("V1", ("valves", index, "entity_id")))
        elif valve.entity_id in used or valve.entity_id in local:
            issues.append(Issue("V7", ("valves", index, "entity_id")))
        local.add(valve.entity_id)
        if valve.supply_sensor is not None:
            if not valve.supply_sensor.startswith("binary_sensor."):
                issues.append(Issue("V13", ("valves", index, "supply_sensor")))
            elif valve.supply_sensor in used_supply or valve.supply_sensor in local_supply:
                issues.append(Issue("V14", ("valves", index, "supply_sensor")))
            local_supply.add(valve.supply_sensor)
        if not _is_int(valve.duration_min) or valve.duration_min < 1:
            issues.append(Issue("V2", ("valves", index, "duration_min")))
        # V3: cada bloque de la válvula es una hora de la zona, sin repetir (00 §4.2)
        if len(set(valve.start_times)) != len(valve.start_times) or not zone_times.issuperset(
            valve.start_times
        ):
            issues.append(Issue("V3", ("valves", index, "start_times")))

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

    for index, target in enumerate(settings.speaker_targets):
        if not target.startswith(SPEAKER_PREFIX):
            issues.append(Issue("entity", ("speaker_targets", index)))
    if settings.tts_entity is not None and not settings.tts_entity.startswith(TTS_PREFIX):
        issues.append(Issue("entity", ("tts_entity",)))
    volume = settings.tts_volume
    if volume is not None and (not _is_number(volume) or not 0 <= volume <= 1):
        issues.append(Issue("V18", ("tts_volume",)))

    if settings.rain_sensor is not None and not settings.rain_sensor.startswith("sensor."):
        issues.append(Issue("entity", ("rain_sensor",)))
    if settings.weather_entity is not None and not settings.weather_entity.startswith("weather."):
        issues.append(Issue("entity", ("weather_entity",)))

    if not _is_int(settings.rain_past_hours) or not 1 <= settings.rain_past_hours <= 24:
        issues.append(Issue("V10", ("rain_past_hours",)))
    if not _is_number(settings.rain_past_threshold_mm) or settings.rain_past_threshold_mm <= 0:
        issues.append(Issue("V10", ("rain_past_threshold_mm",)))
    hours = settings.rain_forecast_hours
    if not _is_int(hours) or not RAIN_FORECAST_HOURS_MIN <= hours <= RAIN_FORECAST_HOURS_MAX:
        issues.append(Issue("V11", ("rain_forecast_hours",)))
    if (
        not _is_number(settings.rain_forecast_threshold_mm)
        or settings.rain_forecast_threshold_mm <= 0
    ):
        issues.append(Issue("V11", ("rain_forecast_threshold_mm",)))

    for alert_id, alert in settings.alerts.items():
        if alert_id not in ALERT_TYPES:
            issues.append(Issue("alert", ("alerts", alert_id)))
            continue
        # turn_off_failed no admite normal (decisión 7)
        if alert.priority is not None and alert.priority not in ALERT_TYPES[alert_id].allowed:
            issues.append(Issue("alert_priority", ("alerts", alert_id, "priority")))
        for index, target in enumerate(alert.targets or []):
            if not target.startswith(NOTIFY_PREFIX):
                issues.append(Issue("notify", ("alerts", alert_id, "targets", index)))
        for index, target in enumerate(alert.voice_targets or []):
            if not target.startswith(SPEAKER_PREFIX):
                issues.append(Issue("entity", ("alerts", alert_id, "voice_targets", index)))

    return issues
