"""Estado de ejecución persistido y colas (03-valves-execution.md §3 y §5.1). Sin HA."""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class Job:
    """Apertura pendiente de una válvula. `seq` fija el orden FIFO de llegada."""

    seq: int
    zone_id: str
    entity_id: str
    duration_s: int
    # False en «regar válvula ahora»: solo respeta el límite global (03 §4)
    zone_limit: bool = True


@dataclass
class OpenValve:
    entity_id: str
    zone_id: str
    started_at: datetime
    ends_at: datetime

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "zone_id": self.zone_id,
            "started_at": self.started_at.isoformat(),
            "ends_at": self.ends_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> OpenValve:
        return cls(
            entity_id=data["entity_id"],
            zone_id=data["zone_id"],
            started_at=datetime.fromisoformat(data["started_at"]),
            ends_at=datetime.fromisoformat(data["ends_at"]),
        )


@dataclass
class RuntimeState:
    open_valves: dict[str, OpenValve] = field(default_factory=dict)
    pending: list[Job] = field(default_factory=list)
    next_seq: int = 0
    last_alive: datetime | None = None
    # Episodio de lluvia (05-rain-skip.md §7.1); se usa en la fase 5
    rain_episode_open: bool = False

    def enqueue(
        self, zone_id: str, entity_id: str, duration_s: int, zone_limit: bool = True
    ) -> Job:
        job = Job(self.next_seq, zone_id, entity_id, duration_s, zone_limit)
        self.next_seq += 1
        self.pending.append(job)
        return job

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
            "rain_episode_open": self.rain_episode_open,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RuntimeState:
        last_alive = data.get("last_alive")
        return cls(
            open_valves={
                item["entity_id"]: OpenValve.from_dict(item)
                for item in data.get("open_valves", [])
            },
            pending=[Job(**item) for item in data.get("pending", [])],
            next_seq=data.get("next_seq", 0),
            last_alive=datetime.fromisoformat(last_alive) if last_alive else None,
            rain_episode_open=data.get("rain_episode_open", False),
        )
