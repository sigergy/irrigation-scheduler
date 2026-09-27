"""Modelo de configuración (00-overview.md §4). Sin dependencias de HA."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from typing import Any

from .const import (
    DEFAULT_RAIN_FORECAST_HOURS,
    DEFAULT_RAIN_FORECAST_THRESHOLD_MM,
    DEFAULT_RAIN_PAST_HOURS,
    DEFAULT_RAIN_PAST_THRESHOLD_MM,
    MODE_MANUAL,
    SENSOR_KINDS,
)


@dataclass
class Valve:
    entity_id: str
    duration_min: int
    frequency: int = 1


@dataclass
class Zone:
    zone_id: str
    name: str
    enabled: bool = True
    mode: str = MODE_MANUAL
    # 0 = lunes … 6 = domingo (L M X J V S D)
    days: list[int] = field(default_factory=lambda: list(range(7)))
    # "HH:MM" ordenadas; el índice es el índice de bloque (00 §4.2)
    start_times: list[str] = field(default_factory=list)
    max_simultaneous: int = 1
    rain_skip: bool = True
    sensors: dict[str, str | None] = field(default_factory=lambda: dict.fromkeys(SENSOR_KINDS))
    calc_method: str | None = None
    valves: list[Valve] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Zone:
        sensors = data.get("sensors") or {}
        return cls(
            zone_id=data["zone_id"],
            name=data["name"],
            enabled=data.get("enabled", True),
            mode=data.get("mode", MODE_MANUAL),
            days=sorted(set(data.get("days", []))),
            start_times=list(data.get("start_times", [])),
            max_simultaneous=data.get("max_simultaneous", 1),
            rain_skip=data.get("rain_skip", True),
            sensors={kind: sensors.get(kind) for kind in SENSOR_KINDS},
            calc_method=data.get("calc_method"),
            valves=[Valve(**valve) for valve in data.get("valves", [])],
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Settings:
    global_max_valves: int | None = None
    notify_targets: list[str] = field(default_factory=list)
    rain_sensor: str | None = None
    rain_past_hours: int = DEFAULT_RAIN_PAST_HOURS
    rain_past_threshold_mm: float = DEFAULT_RAIN_PAST_THRESHOLD_MM
    weather_entity: str | None = None
    rain_forecast_hours: int = DEFAULT_RAIN_FORECAST_HOURS
    rain_forecast_threshold_mm: float = DEFAULT_RAIN_FORECAST_THRESHOLD_MM

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Settings:
        known = {f.name for f in fields(cls)}
        return cls(**{key: value for key, value in data.items() if key in known})

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Config:
    settings: Settings = field(default_factory=Settings)
    # dict ordenado por inserción: orden de alta de las zonas
    zones: dict[str, Zone] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Config:
        zones = [Zone.from_dict(zone) for zone in data.get("zones", [])]
        return cls(
            settings=Settings.from_dict(data.get("settings", {})),
            zones={zone.zone_id: zone for zone in zones},
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "settings": self.settings.to_dict(),
            "zones": [zone.to_dict() for zone in self.zones.values()],
        }
