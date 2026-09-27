"""Frecuencia, bloques e inicios perdidos (00 §4.2, 03 §2 y §5.2). Sin dependencias de HA."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, tzinfo

from .const import MODE_MANUAL
from .model import Valve, Zone


def frequency_indices(frequency: int, blocks: int) -> set[int]:
    """Índices de bloque en que riega una válvula con frecuencia F (reparto uniforme)."""
    if frequency == 1:
        return {0}
    # round(i·(n−1)/(F−1)) redondeando medios hacia arriba, en aritmética entera
    return {
        (2 * i * (blocks - 1) + (frequency - 1)) // (2 * (frequency - 1))
        for i in range(frequency)
    }


def valves_for_block(zone: Zone, index: int) -> list[Valve]:
    """Válvulas que riegan en el bloque `index`, en el orden configurado."""
    blocks = len(zone.start_times)
    return [valve for valve in zone.valves if index in frequency_indices(valve.frequency, blocks)]


def block_runs(zone: Zone, day: date) -> bool:
    """Condiciones de disparo de 03 §2, salvo la lluvia (fase 5)."""
    return zone.enabled and zone.mode == MODE_MANUAL and day.weekday() in zone.days


def _block_datetimes(zone: Zone, day: date, tz: tzinfo) -> list[tuple[datetime, int]]:
    result = []
    for index, start in enumerate(zone.start_times):
        hour, minute = (int(part) for part in start.split(":"))
        result.append((datetime.combine(day, time(hour, minute), tzinfo=tz), index))
    return result


def next_run(zone: Zone, now: datetime) -> datetime | None:
    """Próximo bloque con al menos una válvula. `now` debe ser local y con tz."""
    if not zone.start_times or not zone.valves:
        return None
    for offset in range(8):
        day = now.date() + timedelta(days=offset)
        if not block_runs(zone, day):
            continue
        for when, index in _block_datetimes(zone, day, now.tzinfo):
            if when > now and valves_for_block(zone, index):
                return when
    return None


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
