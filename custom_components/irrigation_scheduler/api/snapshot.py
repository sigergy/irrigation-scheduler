"""Foto del estado para la tarjeta (WebSocket): configuración, colas, válvulas y alertas."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.util import dt as dt_util

from ..adapters.registry import history_entities, registry_id
from ..domain.runtime import estimate_batch_ends
from ..engine.manual import supply_on
from ..entities.unique_ids import installation_uid

if TYPE_CHECKING:
    from ..engine.manager import IrrigationManager


def build_snapshot(manager: IrrigationManager) -> dict[str, Any]:
    """Solo lee la API pública del manager; no toma el lock (lectura síncrona, sin await)."""
    batch_ends = estimate_batch_ends(
        manager.runtime,
        {zone_id: zone.max_simultaneous for zone_id, zone in manager.config.zones.items()},
        manager.config.settings.global_max_valves,
        dt_util.utcnow(),
        opening=manager.opening_durations(),
    )
    # cola retenida por el horario silencioso: la simulación la haría arrancar ya (§B.5)
    held_until = manager.runtime.held_until
    zones = []
    for zone in manager.config.zones.values():
        upcoming = manager.zone_plan(zone.zone_id)[1]
        batch_start = manager.runtime.batch_started.get(zone.zone_id)
        batch_end = batch_ends.get(zone.zone_id) if batch_start and held_until is None else None
        zones.append(
            {
                **zone.to_dict(),
                "status": manager.zone_status(zone.zone_id),
                "next_run": upcoming.isoformat() if upcoming else None,
                # lote en curso: primera apertura y fin estimado con la cola
                "batch_started_at": batch_start.isoformat() if batch_start else None,
                "batch_ends_at": batch_end.isoformat() if batch_end else None,
                # entity_id que pide la tarjeta de histórico al recorder
                "entities": history_entities(manager.hass, zone),
            }
        )
    return {
        "settings": manager.config.settings.to_dict(),
        "zones": zones,
        "held_until": held_until.isoformat() if held_until else None,
        "open_valves": [valve.to_dict() for valve in manager.runtime.open_valves.values()],
        "pending": [
            {
                "seq": job.seq,
                "zone_id": job.zone_id,
                "entity_id": job.entity_id,
                "duration_s": job.duration_s,
            }
            for job in sorted(manager.runtime.pending, key=lambda item: item.seq)
        ],
        # encendiéndose (con sus reintentos); las ya pausadas no salen
        "opening": [
            {"entity_id": entity_id, "zone_id": zone_id}
            for entity_id, zone_id in manager.visible_opening().items()
        ],
        # apagándose tras pausar o a su hora: el panel lo muestra al momento
        "closing": sorted(manager.closing_valves()),
        # cortadas por la parada ordenada de HA, con lo que les faltaba (03-remaining-time §4.5)
        "interrupted": [
            {"entity_id": valve.entity_id, "zone_id": valve.zone_id, "remaining_min": valve.remaining_min}
            for valve in manager.runtime.interrupted.values()
        ],
        "manual_on": [
            {"entity_id": valve.entity_id, "zone_id": zone.zone_id, "since": since.isoformat()}
            for zone, valve, since in manager.manual_on()
        ],
        # válvulas con su sensor de suministro en on (spec no_water §1.5)
        "no_water": [
            {"entity_id": valve.entity_id, "zone_id": zone.zone_id}
            for zone in manager.config.zones.values()
            for valve in zone.valves
            if supply_on(manager.hass, valve)
        ],
        "installation_alerts": registry_id(manager.hass, "event", installation_uid("alerts")),
    }
