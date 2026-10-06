"""Huecos de válvula: cola, abiertas y estados en tránsito (03 §3).

Único que modifica `pending`, `open_valves`, `batch_started`, `interrupted` y los estados en tránsito.
Sin HA ni asyncio. Quien lo usa debe tener el lock del manager para llamar a los MUTATORS.
"""

from __future__ import annotations

from collections.abc import Callable, Collection, Iterable
from datetime import datetime, timedelta

from ..domain.runtime import InterruptedValve, Job, OpenValve, RuntimeState

MUTATORS = frozenset(
    {
        "enqueue",
        "reserve",
        "finish_opening",
        "opened",
        "begin_close",
        "closed",
        "begin_manual_close",
        "end_manual_close",
        "cancel",
        "drop_pending",
        "prune_batches",
        "interrupt",
        "interrupt_job",
        "drop_interrupted",
    }
)


class ValveSlots:
    def __init__(self, runtime: RuntimeState) -> None:
        self.runtime = runtime
        # abriéndose: entity_id -> zone_id; ocupan su hueco de zona y global
        self._opening: dict[str, str] = {}
        # duración (s) de cada apertura, para estimar el fin del lote
        self._opening_s: dict[str, int] = {}
        # origen de cada apertura: el sensor «Modo riego» lo muestra antes del turn_on
        self._opening_origin: dict[str, str] = {}
        self._closing: set[str] = set()
        # pausadas mientras abrían: al terminar el turn_on se cierran
        self._cancelled: set[str] = set()

    # ---------- transiciones ----------

    def enqueue(
        self, zone_id: str, entity_id: str, duration_s: int, *, origin: str, zone_limit: bool = True
    ) -> Job:
        """Añade un trabajo al final de la cola (FIFO por `seq`)."""
        return self.runtime.enqueue(zone_id, entity_id, duration_s, origin=origin, zone_limit=zone_limit)

    def startable(self, zone_limits: dict[str, int], global_limit: int | None) -> list[Job]:
        """Trabajos con hueco ahora, contando las aperturas en curso. No modifica el estado."""
        return self.runtime.startable_jobs(zone_limits, global_limit, reserved=self._opening)

    def reserve(self, job: Job) -> None:
        """Saca el trabajo de la cola y lo marca como abriéndose.

        Uno a uno: el manager lanza cada apertura justo tras reservarla, como antes.
        """
        self.runtime.pending.remove(job)
        self._opening[job.entity_id] = job.zone_id
        self._opening_s[job.entity_id] = job.duration_s
        self._opening_origin[job.entity_id] = job.origin

    def finish_opening(self, entity_id: str) -> bool:
        """Termina la apertura (bien o mal). Devuelve si se pausó mientras abría."""
        self._opening.pop(entity_id, None)
        self._opening_s.pop(entity_id, None)
        self._opening_origin.pop(entity_id, None)
        cancelled = entity_id in self._cancelled
        self._cancelled.discard(entity_id)
        return cancelled

    def opened(self, job: Job, started: datetime) -> OpenValve:
        valve = OpenValve(
            job.entity_id, job.zone_id, started, started + timedelta(seconds=job.duration_s), job.origin
        )
        self.runtime.open_valves[job.entity_id] = valve
        self.runtime.batch_started.setdefault(job.zone_id, started)
        return valve

    def begin_close(self, entity_id: str) -> bool:
        """Marca la válvula como cerrándose; sigue en `open_valves` y ocupa hueco."""
        if entity_id not in self.runtime.open_valves or entity_id in self._closing:
            return False
        self._closing.add(entity_id)
        return True

    def closed(self, entity_id: str) -> OpenValve | None:
        """Libera el hueco tras el turn_off, haya ido bien o no."""
        self._closing.discard(entity_id)
        return self.runtime.open_valves.pop(entity_id, None)

    def begin_manual_close(self, entity_ids: Iterable[str]) -> None:
        """Encendidas a mano que se apagan: no ocupan hueco, solo se marcan."""
        self._closing.update(entity_ids)

    def end_manual_close(self, entity_id: str) -> None:
        self._closing.discard(entity_id)

    def cancel(self, match: Callable[[str, str], bool]) -> list[str]:
        """Pausa (03 §4): vacía la cola, cancela aperturas y empieza a cerrar las abiertas."""
        self.runtime.pending = [job for job in self.runtime.pending if not match(job.zone_id, job.entity_id)]
        closing = [
            entity_id
            for entity_id, valve in list(self.runtime.open_valves.items())
            if match(valve.zone_id, entity_id) and self.begin_close(entity_id)
        ]
        for entity_id, zone_id in self._opening.items():
            if match(zone_id, entity_id):
                self._cancelled.add(entity_id)
        return closing

    def drop_pending(self, keep: Callable[[Job], bool]) -> None:
        self.runtime.pending = [job for job in self.runtime.pending if keep(job)]

    def interrupt(self, entity_id: str, now: datetime) -> InterruptedValve | None:
        """Parada de HA: la abierta sale de `open_valves` con lo que le faltaba (03-remaining-time §4.2).

        Cerrándose (a su hora o por «Pausar») o sin tiempo por delante, su riego ya terminaba:
        devuelve None y no toca nada; quien llama la libera con `closed`.
        """
        valve = self.runtime.open_valves.get(entity_id)
        if valve is None or entity_id in self._closing:
            return None
        remaining_s = int((valve.ends_at - now).total_seconds())
        if remaining_s <= 0:
            return None
        del self.runtime.open_valves[entity_id]
        interrupted = InterruptedValve(entity_id, valve.zone_id, remaining_s, now, valve.origin)
        self.runtime.interrupted[entity_id] = interrupted
        return interrupted

    def interrupt_job(self, job: Job, now: datetime) -> InterruptedValve:
        """Apertura abortada por la parada de HA: interrumpida con su duración entera."""
        interrupted = InterruptedValve(job.entity_id, job.zone_id, job.duration_s, now, job.origin)
        self.runtime.interrupted[job.entity_id] = interrupted
        return interrupted

    def drop_interrupted(self) -> list[InterruptedValve]:
        """Vacía las interrupciones y las devuelve."""
        dropped = list(self.runtime.interrupted.values())
        self.runtime.interrupted.clear()
        return dropped

    def prune_batches(self, zone_ids: Collection[str]) -> None:
        """Cierra el lote de las zonas sin abiertas, abriéndose ni en cola, o ya borradas."""
        active = (
            {valve.zone_id for valve in self.runtime.open_valves.values()}
            | set(self._opening.values())
            | {job.zone_id for job in self.runtime.pending}
        )
        for zone_id in list(self.runtime.batch_started):
            if zone_id not in active or zone_id not in zone_ids:
                del self.runtime.batch_started[zone_id]

    # ---------- vistas (sin cambios de estado) ----------

    def busy(self) -> set[str]:
        """Switch en manos de la integración: abiertas, abriéndose o cerrándose."""
        return set(self.runtime.open_valves) | set(self._opening) | self._closing

    def reserved(self) -> dict[str, str]:
        """Todas las aperturas, también las pausadas: aún ocupan hueco."""
        return dict(self._opening)

    def visible_opening(self) -> dict[str, str]:
        """Aperturas no pausadas: las que el panel muestra como «Encendiendo»."""
        return {e: z for e, z in self._opening.items() if e not in self._cancelled}

    def closing(self) -> set[str]:
        """Cerrándose o con la apertura ya pausada: las que el panel muestra como «Cerrando»."""
        return self._closing | (self._cancelled & set(self._opening))

    def durations(self) -> dict[str, tuple[str, int]]:
        return {e: (z, self._opening_s.get(e, 0)) for e, z in self._opening.items()}

    def origin(self, entity_id: str) -> str | None:
        return self._opening_origin.get(entity_id)

    def is_cancelled(self, entity_id: str) -> bool:
        return entity_id in self._cancelled

    def is_closing(self, entity_id: str) -> bool:
        return entity_id in self._closing
