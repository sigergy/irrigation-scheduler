"""Estado de ejecución persistido y colas (03-valves-execution.md §3 y §5.1). Sin HA."""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from ..const import ORIGIN_MANUAL


@dataclass
class Job:
    """Apertura pendiente de una válvula. `seq` fija el orden FIFO de llegada."""

    seq: int
    zone_id: str
    entity_id: str
    duration_s: int
    # False en «regar válvula ahora»: solo respeta el límite global (03 §4)
    zone_limit: bool = True
    # scheduled o manual; los guardados antes de existir el campo se leen como manual
    origin: str = ORIGIN_MANUAL


@dataclass
class OpenValve:
    entity_id: str
    zone_id: str
    started_at: datetime
    ends_at: datetime
    origin: str = ORIGIN_MANUAL

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "zone_id": self.zone_id,
            "started_at": self.started_at.isoformat(),
            "ends_at": self.ends_at.isoformat(),
            "origin": self.origin,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> OpenValve:
        return cls(
            entity_id=data["entity_id"],
            zone_id=data["zone_id"],
            started_at=datetime.fromisoformat(data["started_at"]),
            ends_at=datetime.fromisoformat(data["ends_at"]),
            origin=data.get("origin", ORIGIN_MANUAL),
        )


@dataclass
class InterruptedValve:
    """Riego cortado por una parada ordenada de HA, con lo que le faltaba (03-remaining-time §4.1)."""

    entity_id: str
    zone_id: str
    remaining_s: int
    interrupted_at: datetime
    # la spec 04 retoma distinto un riego manual que uno programado
    origin: str = ORIGIN_MANUAL

    @property
    def remaining_min(self) -> int:
        """Minutos que faltaban, redondeados hacia arriba: lo que ven la entidad, el panel y el log."""
        return math.ceil(self.remaining_s / 60)

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "interrupted_at": self.interrupted_at.isoformat()}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> InterruptedValve:
        return cls(**{**data, "interrupted_at": datetime.fromisoformat(data["interrupted_at"])})


# (zone_id, "HH:MM", día del bloque): la clave de la decisión fijada (05-rain-skip.md §8.23)
type BlockRef = tuple[str, str, date]


@dataclass
class RainDecision:
    """Decisión de lluvia fijada a T−10 para un bloque (§8.16)."""

    zone_id: str
    start_time: str
    day: date
    skip: bool
    reason: str | None = None
    rain_mm: float | None = None

    @property
    def key(self) -> BlockRef:
        return (self.zone_id, self.start_time, self.day)

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "day": self.day.isoformat()}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RainDecision:
        return cls(**{**data, "day": date.fromisoformat(data["day"])})


@dataclass
class RuntimeState:
    open_valves: dict[str, OpenValve] = field(default_factory=dict)
    pending: list[Job] = field(default_factory=list)
    next_seq: int = 0
    last_alive: datetime | None = None
    # episodio de lluvia por zona: zone_id -> hora de apertura; sin entrada = cerrado (§8.19)
    rain_episodes: dict[str, datetime] = field(default_factory=dict)
    # decisiones fijadas a T−10 que aún no se han consumido (§8.16, §8.23)
    rain_decisions: dict[BlockRef, RainDecision] = field(default_factory=dict)
    # inicio del lote en curso de cada zona: primera apertura hasta vaciar abiertas y cola
    batch_started: dict[str, datetime] = field(default_factory=dict)
    # cola retenida por el horario silencioso hasta esta hora; None = sin retener (quiet-hours §B.4)
    held_until: datetime | None = None
    # registro de previsiones: inicio de la hora (UTC) -> mm previstos (rain-estimated-design.md §5.1)
    forecast_log: dict[datetime, float] = field(default_factory=dict)
    # riegos cortados por una parada ordenada de HA: entity_id -> lo que faltaba (03-remaining-time §4.1)
    interrupted: dict[str, InterruptedValve] = field(default_factory=dict)

    def enqueue(
        self, zone_id: str, entity_id: str, duration_s: int, *, origin: str, zone_limit: bool = True
    ) -> Job:
        job = Job(self.next_seq, zone_id, entity_id, duration_s, zone_limit, origin)
        self.next_seq += 1
        self.pending.append(job)
        return job

    def drop_decisions(self, zone_id: str) -> None:
        """Anula las decisiones de la zona: sus bloques se evalúan a su hora (§8.22)."""
        self.rain_decisions = {
            key: decision for key, decision in self.rain_decisions.items() if key[0] != zone_id
        }

    def purge_decisions(self, cutoff: datetime) -> None:
        """Quita las decisiones de bloques con hora en o antes de `cutoff` (local) (§8.23)."""
        limit = (cutoff.date(), cutoff.strftime("%H:%M"))
        self.rain_decisions = {
            key: decision
            for key, decision in self.rain_decisions.items()
            if (decision.day, decision.start_time) > limit
        }

    def startable_jobs(
        self,
        zone_limits: dict[str, int],
        global_limit: int | None,
        reserved: Mapping[str, str] | None = None,
    ) -> list[Job]:
        """Trabajos que pueden abrir ya, en orden FIFO. No modifica el estado.

        Una válvula abre solo si hay hueco en la zona y en el global (03 §3). Si el global
        está lleno se para: el FIFO entre zonas no permite adelantar.

        `reserved` son válvulas en apertura (entity_id -> zone_id) que aún no están en
        `open_valves`: cuentan igual que las abiertas para no superar los límites.
        """
        reserved = reserved or {}
        open_total = len(self.open_valves) + len(reserved)
        per_zone = Counter(valve.zone_id for valve in self.open_valves.values())
        per_zone.update(reserved.values())
        busy = set(self.open_valves) | set(reserved)
        chosen: list[Job] = []
        for job in sorted(self.pending, key=lambda item: item.seq):
            if global_limit is not None and open_total >= global_limit:
                break
            # la misma switch no se abre dos veces a la vez
            if job.entity_id in busy:
                continue
            if job.zone_limit and per_zone[job.zone_id] >= zone_limits.get(job.zone_id, 1):
                continue
            chosen.append(job)
            open_total += 1
            per_zone[job.zone_id] += 1
            busy.add(job.entity_id)
        return chosen

    def to_dict(self) -> dict[str, Any]:
        return {
            "open_valves": [valve.to_dict() for valve in self.open_valves.values()],
            "pending": [asdict(job) for job in self.pending],
            "next_seq": self.next_seq,
            "last_alive": self.last_alive.isoformat() if self.last_alive else None,
            "rain_episodes": {
                zone_id: opened.isoformat() for zone_id, opened in self.rain_episodes.items()
            },
            "rain_decisions": [decision.to_dict() for decision in self.rain_decisions.values()],
            "batch_started": {
                zone_id: started.isoformat() for zone_id, started in self.batch_started.items()
            },
            "held_until": self.held_until.isoformat() if self.held_until else None,
            "forecast_log": {start.isoformat(): mm for start, mm in self.forecast_log.items()},
            "interrupted": [valve.to_dict() for valve in self.interrupted.values()],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RuntimeState:
        last_alive = data.get("last_alive")
        held_until = data.get("held_until")
        return cls(
            open_valves={
                item["entity_id"]: OpenValve.from_dict(item)
                for item in data.get("open_valves", [])
            },
            pending=[Job(**item) for item in data.get("pending", [])],
            next_seq=data.get("next_seq", 0),
            last_alive=datetime.fromisoformat(last_alive) if last_alive else None,
            rain_episodes={
                zone_id: datetime.fromisoformat(opened)
                for zone_id, opened in data.get("rain_episodes", {}).items()
            },
            rain_decisions={
                decision.key: decision
                for decision in (RainDecision.from_dict(item) for item in data.get("rain_decisions", []))
            },
            batch_started={
                zone_id: datetime.fromisoformat(started)
                for zone_id, started in data.get("batch_started", {}).items()
            },
            held_until=datetime.fromisoformat(held_until) if held_until else None,
            forecast_log={
                datetime.fromisoformat(start): mm for start, mm in data.get("forecast_log", {}).items()
            },
            # runtime guardado antes de existir la clave: sin interrupciones
            interrupted={
                item["entity_id"]: InterruptedValve.from_dict(item) for item in data.get("interrupted", [])
            },
        )


def estimate_batch_ends(
    state: RuntimeState,
    zone_limits: dict[str, int],
    global_limit: int | None,
    now: datetime,
    opening: Mapping[str, tuple[str, int]] | None = None,
) -> dict[str, datetime]:
    """Fin estimado del lote de cada zona con válvulas abiertas, abriéndose o en cola.

    Simula la cola en el tiempo con las mismas reglas que el despacho real
    (`startable_jobs`). `opening` son válvulas en apertura: entity_id -> (zone_id, duración
    en s); ocupan hueco desde `now`. Una válvula pasada de tiempo termina en `now`.
    """
    opened: dict[str, OpenValve] = {
        entity_id: OpenValve(entity_id, valve.zone_id, valve.started_at, max(valve.ends_at, now))
        for entity_id, valve in state.open_valves.items()
    }
    for entity_id, (zone_id, duration_s) in (opening or {}).items():
        opened[entity_id] = OpenValve(entity_id, zone_id, now, now + timedelta(seconds=duration_s))
    sim = RuntimeState(open_valves=opened, pending=list(state.pending))
    ends: dict[str, datetime] = {}
    clock = now
    while True:
        for job in sim.startable_jobs(zone_limits, global_limit):
            sim.pending.remove(job)
            sim.open_valves[job.entity_id] = OpenValve(
                job.entity_id, job.zone_id, clock, clock + timedelta(seconds=job.duration_s)
            )
        for valve in sim.open_valves.values():
            if valve.zone_id not in ends or valve.ends_at > ends[valve.zone_id]:
                ends[valve.zone_id] = valve.ends_at
        # sin abiertas no avanza nada: la cola que quede no puede arrancar
        if not sim.pending or not sim.open_valves:
            return ends
        clock = min(valve.ends_at for valve in sim.open_valves.values())
        sim.open_valves = {
            entity_id: valve for entity_id, valve in sim.open_valves.items() if valve.ends_at > clock
        }
