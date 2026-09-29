"""Bloques e inicios perdidos (00 §4.2, 03 §2 y §5.2). Sin dependencias de HA."""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from datetime import date, datetime, time, timedelta, tzinfo

from .const import MODE_MANUAL
from .model import Valve, Zone


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


def next_run(zone: Zone, now: datetime) -> datetime | None:
    """Próximo bloque con al menos una válvula. `now` debe ser local y con tz."""
    return next(upcoming_blocks(zone, now), None)


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
