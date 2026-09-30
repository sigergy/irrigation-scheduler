"""Catálogo de alertas y resolución del push (docs/alerts/README.md). Sin dependencias de HA."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .const import PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_NORMAL
from .model import AlertConfig, Settings

LEVEL_VALVE = "valve"
LEVEL_ZONE = "zone"
LEVEL_INSTALLATION = "installation"

PRIORITIES = (PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_NORMAL)

# cabecera del push; la misma que el color de la marca del histórico (frontend/src/shared/alert-icons.ts)
SEVERITY_ERROR = "error"
SEVERITY_WARNING = "warning"
SEVERITY_INFO = "info"


@dataclass(frozen=True)
class AlertType:
    level: str
    severity: str
    # prioridad por defecto del push
    priority: str
    # prioridades que admite el ajuste; turn_off_failed no baja de alta (decisión 7)
    allowed: tuple[str, ...] = PRIORITIES
    # solo push: sin entidad event, sin evento de bus y sin marca en el histórico
    push_only: bool = False


# mismo orden que la tabla de docs/alerts/README.md y que la interfaz (frontend/src/alerts.ts)
ALERT_TYPES: dict[str, AlertType] = {
    "turn_on_failed": AlertType(LEVEL_VALVE, SEVERITY_ERROR, PRIORITY_HIGH),
    "turn_off_failed": AlertType(
        LEVEL_VALVE, SEVERITY_ERROR, PRIORITY_CRITICAL, (PRIORITY_CRITICAL, PRIORITY_HIGH)
    ),
    "overrun_restart": AlertType(LEVEL_VALVE, SEVERITY_WARNING, PRIORITY_HIGH),
    "overrun_running": AlertType(LEVEL_VALVE, SEVERITY_WARNING, PRIORITY_HIGH),
    "manual_overrun": AlertType(LEVEL_VALVE, SEVERITY_WARNING, PRIORITY_HIGH),
    "sensor_unavailable": AlertType(LEVEL_ZONE, SEVERITY_WARNING, PRIORITY_NORMAL),
    "rain_skipped": AlertType(LEVEL_ZONE, SEVERITY_INFO, PRIORITY_NORMAL),
    "rain_source_unavailable": AlertType(LEVEL_INSTALLATION, SEVERITY_WARNING, PRIORITY_NORMAL),
    "valve_switched": AlertType(LEVEL_VALVE, SEVERITY_INFO, PRIORITY_NORMAL, push_only=True),
}


@dataclass(frozen=True)
class Alert:
    """Una incidencia para las entidades event. En las de válvula, `entity_id` es la switch."""

    alert_id: str
    zone_id: str | None
    entity_id: str | None
    # atributos del disparo: los mismos datos que el evento de bus (spec §0.3)
    data: dict[str, Any] = field(default_factory=dict)


def alert_types(level: str) -> list[str]:
    """IDs de un nivel, en orden de catálogo: los event_types de su entidad. Sin los de solo push."""
    return [
        alert_id
        for alert_id, alert in ALERT_TYPES.items()
        if alert.level == level and not alert.push_only
    ]


def alert_config(settings: Settings, alert_id: str) -> AlertConfig:
    # ID ausente: valores por defecto; sin migración para tipos nuevos
    return settings.alerts.get(alert_id) or AlertConfig()


def alert_priority(settings: Settings, alert_id: str) -> str:
    return alert_config(settings, alert_id).priority or ALERT_TYPES[alert_id].priority


def push_targets(settings: Settings, alert_id: str) -> list[str]:
    """Móviles del push; vacío con el push apagado. Solo los que siguen en notify_targets."""
    config = alert_config(settings, alert_id)
    if not config.push:
        return []
    if config.targets is None:
        return list(settings.notify_targets)
    return [target for target in settings.notify_targets if target in config.targets]
