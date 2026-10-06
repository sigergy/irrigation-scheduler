import type { AlertHistoryResponse, HistoryAttrState, Settings, Zone } from "../api";
import { ALERT_TYPES, alertConfig, type AlertType } from "../alerts";
import type { WindowRange } from "./time-window";

// marcas de alerta del histórico: una por evento de las entidades event (docs/features/alerts/spec.md §0.1)

export interface AlertMark {
  type: AlertType;
  // ms epoch
  at: number;
}

export interface ZoneMarks {
  zone: AlertMark[];
  // por entity_id de la switch
  valves: Record<string, AlertMark[]>;
}

export interface HistoryMarks {
  installation: AlertMark[];
  zones: Record<string, ZoneMarks>;
}

/** Alertas de una entidad event en la ventana; solo los tipos con «mostrar en histórico». */
function alertMarks(states: HistoryAttrState[], settings: Settings, range: WindowRange): AlertMark[] {
  const marks: AlertMark[] = [];
  for (const state of states) {
    // el estado de una entidad event es la hora del evento en ISO; unavailable/unknown dan NaN
    const at = Date.parse(state.s);
    const type = ALERT_TYPES.find((item) => item.id === state.a?.event_type);
    if (!type || Number.isNaN(at) || at < range.start || at > range.end) continue;
    if (alertConfig(settings, type.id).show_in_history) marks.push({ type, at });
  }
  return marks;
}

/** Marcas por nivel: instalación, zona y válvula. */
export function buildMarks(
  history: AlertHistoryResponse,
  zones: Zone[],
  installationId: string | null,
  settings: Settings,
  range: WindowRange,
): HistoryMarks {
  const of = (entityId: string | null | undefined) =>
    entityId ? alertMarks(history[entityId] ?? [], settings, range) : [];
  return {
    installation: of(installationId),
    zones: Object.fromEntries(
      zones.map((zone) => [
        zone.zone_id,
        {
          zone: of(zone.entities.alerts),
          valves: Object.fromEntries(
            zone.valves.map((valve) => [valve.entity_id, of(zone.entities.valves[valve.entity_id]?.alerts)]),
          ),
        },
      ]),
    ),
  };
}

/** entity_id de las entidades event de las zonas y de la instalación, sin nulos. */
export function alertEntityIds(zones: Zone[], installationId: string | null): string[] {
  const ids = [
    installationId,
    ...zones.flatMap((zone) => [
      zone.entities.alerts,
      ...zone.valves.map((valve) => zone.entities.valves[valve.entity_id]?.alerts),
    ]),
  ];
  return ids.filter((id): id is string => Boolean(id));
}
