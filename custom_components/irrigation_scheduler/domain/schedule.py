"""Bloques, inicios perdidos y horario silencioso (00 §4.2, 03 §2 y §5.2, quiet-hours §B). Sin HA."""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from datetime import date, datetime, time, timedelta, tzinfo

from ..const import MODE_MANUAL, ORIGIN_SCHEDULED
from .model import Settings, Valve, Zone
from .runtime import RuntimeState, estimate_batch_ends

_DAY_MIN = 24 * 60


def valves_for_block(zone: Zone, index: int) -> list[Valve]:
    """Válvulas habilitadas con esa hora entre sus bloques, en el orden configurado (00 §4.2)."""
    start = zone.start_times[index]
    return [valve for valve in zone.valves if valve.enabled and start in valve.start_times]


def block_runs(zone: Zone, day: date) -> bool:
    """Condiciones de disparo de 03 §2. La lluvia va aparte (05-rain-skip.md §8.16)."""
    return zone.enabled and zone.mode == MODE_MANUAL and day.weekday() in zone.days


def _block_datetimes(zone: Zone, day: date, tz: tzinfo) -> list[tuple[datetime, int]]:
    result = []
    for index, start in enumerate(zone.start_times):
        hour, minute = (int(part) for part in start.split(":"))
        result.append((datetime.combine(day, time(hour, minute), tzinfo=tz), index))
    return result


def upcoming_blocks(zone: Zone, now: datetime) -> Iterator[datetime]:
    """Bloques futuros con al menos una válvula, en orden, en los próximos 8 días. `now` local y con tz."""
    if not zone.start_times or not zone.valves:
        return
    for offset in range(8):
        day = now.date() + timedelta(days=offset)
        if not block_runs(zone, day):
            continue
        for when, index in _block_datetimes(zone, day, now.tzinfo):
            if when > now and valves_for_block(zone, index):
                yield when


def blocks_at(zones: Iterable[Zone], start: str, day: date) -> list[Zone]:
    """Lote (05-rain-skip.md §8.11): zonas que riegan un bloque a esa hora ese día, en orden de alta."""
    return [
        zone
        for zone in zones
        if start in zone.start_times
        and block_runs(zone, day)
        and valves_for_block(zone, zone.start_times.index(start))
    ]


def block_day(start: str, evaluated: datetime) -> date:
    """Día de un bloque evaluado 10 min antes (§8.26): entre 00:00 y 00:09, el día siguiente."""
    if start < evaluated.strftime("%H:%M"):
        return evaluated.date() + timedelta(days=1)
    return evaluated.date()


def missed_blocks(
    zones: Iterable[Zone], since: datetime, now: datetime
) -> list[tuple[datetime, str, int]]:
    """Bloques con hora en (since, now], sin límite de antigüedad y en orden cronológico (03 §5.2).

    Se aplican las condiciones vigentes al arrancar y el día de la fecha del inicio perdido.
    `now` debe ser local y con tz; `since` puede estar en UTC.
    """
    tz = now.tzinfo
    zones = list(zones)
    result: list[tuple[datetime, str, int]] = []
    day = since.astimezone(tz).date()
    while day <= now.date():
        for zone in zones:
            if not block_runs(zone, day):
                continue
            for when, index in _block_datetimes(zone, day, tz):
                if since < when <= now and valves_for_block(zone, index):
                    result.append((when, zone.zone_id, index))
        day += timedelta(days=1)
    # sort estable: a igual hora se mantiene el orden de las zonas
    result.sort(key=lambda item: item[0])
    return result


def valve_block_between(zone: Zone, entity_id: str, since: datetime, until: datetime) -> datetime | None:
    """Primer bloque de la zona que incluye la válvula con hora en (since, until], o None.

    Mismas condiciones que `missed_blocks`; la lluvia no cuenta (04-resume-after-restart §4.3).
    `until` debe ser local y con tz; `since` puede estar en UTC.
    """
    for when, _zone_id, index in missed_blocks([zone], since, until):
        if any(valve.entity_id == entity_id for valve in valves_for_block(zone, index)):
            return when
    return None


# ---------- horario silencioso (quiet-hours §B) ----------


def _minutes(value: object) -> int | None:
    """Minuto del día de un "HH:MM"; None si no tiene ese formato."""
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":":
        return None
    hour, minute = value[:2], value[3:]
    if not (hour.isdigit() and minute.isdigit()):
        return None
    hour_i, minute_i = int(hour), int(minute)
    if hour_i > 23 or minute_i > 59:
        return None
    return hour_i * 60 + minute_i


def _quiet_window(settings: Settings) -> tuple[int, int] | None:
    """(inicio, fin) en minutos, con fin > inicio si cruza medianoche; None = sin franja."""
    start = _minutes(settings.quiet_start)
    end = _minutes(settings.quiet_end)
    if start is None or end is None or start == end:
        return None
    return start, end if end > start else end + _DAY_MIN


def quiet_active(settings: Settings) -> bool:
    """Hay franja silenciosa configurada y válida."""
    return _quiet_window(settings) is not None


def in_quiet_hours(settings: Settings, local_time: datetime) -> bool:
    """La hora de reloj de `local_time` cae en [inicio, fin), contando el cruce de medianoche."""
    window = _quiet_window(settings)
    if window is None:
        return False
    start, end = window
    now = local_time.hour * 60 + local_time.minute
    # el día siguiente: un minuto tras medianoche está dentro de 23:00–07:00
    return start <= now < end or start <= now + _DAY_MIN < end


def quiet_end_after(settings: Settings, local_now: datetime) -> datetime:
    """Próximo fin de franja estrictamente posterior a `local_now`, en hora de reloj.

    Sin franja devuelve `local_now`: no hay nada que esperar.
    """
    end = _minutes(settings.quiet_end)
    if not quiet_active(settings) or end is None:
        return local_now
    candidate = datetime.combine(
        local_now.date(), time(end // 60, end % 60), tzinfo=local_now.tzinfo
    )
    if candidate <= local_now:
        candidate += timedelta(days=1)
    return candidate


def block_span_min(zone: Zone, index: int) -> int:
    """Minutos que dura el bloque `index` con todas sus válvulas, también las desactivadas.

    Simula la cola con el `max_simultaneous` de la zona y sin límite global, con las mismas
    reglas que el despacho (`estimate_batch_ends`). Duraciones no válidas no cuentan (V2).
    """
    start = zone.start_times[index]
    sim = RuntimeState()
    for valve in zone.valves:
        duration = valve.duration_min
        valid = isinstance(duration, int) and not isinstance(duration, bool) and duration >= 1
        if valid and start in valve.start_times:
            sim.enqueue(zone.zone_id, valve.entity_id, duration * 60, origin=ORIGIN_SCHEDULED)
    if not sim.pending:
        return 0
    limit = zone.max_simultaneous
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        limit = 1
    origin = datetime(2000, 1, 1)
    ends = estimate_batch_ends(sim, {zone.zone_id: limit}, None, origin)
    end = ends.get(zone.zone_id, origin)
    return int((end - origin).total_seconds() // 60)


def block_hits_quiet(settings: Settings, zone: Zone, index: int) -> bool:
    """El bloque `index` se solapa con la franja (§B.2). Tocar los extremos no es conflicto."""
    window = _quiet_window(settings)
    begin = _minutes(zone.start_times[index])
    if window is None or begin is None:
        return False
    span = block_span_min(zone, index)
    if span <= 0:
        return False
    quiet_start, quiet_end = window
    # el bloque de ayer, de hoy y de mañana frente a la franja de hoy
    return any(
        begin + offset < quiet_end and quiet_start < begin + offset + span
        for offset in (-_DAY_MIN, 0, _DAY_MIN)
    )
