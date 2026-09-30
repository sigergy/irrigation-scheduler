import type { HistoryResponse, HistoryState, TimeSpan, Valve, Zone } from "../api";
import type { WindowRange } from "./time-window";

/** Origen de un riego según el sensor «Modo riego»; undefined = sin dato (anterior a la versión con sensor). */
export type RunOrigin = "scheduled" | "manual" | "external";
const ORIGINS: string[] = ["scheduled", "manual", "external"];

// encendidos reales de las válvulas: tiempo real = apagado real − encendido real (recorder de HA)

/** Un encendido, ya recortado a la ventana. */
export interface ValveRun extends TimeSpan {
  seconds: number;
  // sin apagado dentro de la ventana: sigue encendida al final
  ongoing: boolean;
  // ya estaba encendida al empezar la ventana
  startsBefore: boolean;
  origin?: RunOrigin;
}

export interface ValveHistory {
  valve: Valve;
  // del más reciente al más antiguo
  runs: ValveRun[];
  seconds: number;
}

export interface ZoneHistory {
  zone: Zone;
  // todas las válvulas de la zona, también sin encendidos
  valves: ValveHistory[];
  seconds: number;
  count: number;
}

const ON = "on";

/** Encendidos de una switch en la ventana. Termina en el primer estado ≠ on (off, unavailable, unknown). */
export function valveRuns(states: HistoryState[], range: WindowRange): ValveRun[] {
  const runs: ValveRun[] = [];
  let onSince: number | undefined;
  const close = (at: number, ongoing: boolean) => {
    if (onSince === undefined) return;
    const start = Math.max(onSince, range.start);
    const end = Math.min(at, range.end);
    if (end > start) {
      runs.push({
        started_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        seconds: (end - start) / 1000,
        ongoing,
        // HA fecha el estado vigente en start_time con start_time: «≤» lo detecta
        startsBefore: onSince <= range.start,
      });
    }
    onSince = undefined;
  };
  for (const state of states) {
    const at = (state.lc ?? state.lu) * 1000;
    if (state.s === ON) onSince ??= at;
    else close(at, false);
  }
  close(range.end, true);
  return runs.reverse();
}

/** Origen de un encendido: el primer estado del sensor «Modo riego» ≠ idle que se solapa con él. */
export function runOrigin(run: TimeSpan, states: HistoryState[], range: WindowRange): RunOrigin | undefined {
  const start = Date.parse(run.started_at);
  const end = Date.parse(run.ends_at);
  for (let i = 0; i < states.length; i++) {
    const from = (states[i].lc ?? states[i].lu) * 1000;
    const next = states[i + 1];
    const to = next ? (next.lc ?? next.lu) * 1000 : range.end;
    if (ORIGINS.includes(states[i].s) && from < end && to > start) return states[i].s as RunOrigin;
  }
  return undefined;
}

const total = (items: { seconds: number }[]) => items.reduce((sum, item) => sum + item.seconds, 0);

/** Histórico por zona en el orden recibido; las válvulas, en el orden de la configuración. */
export function buildHistory(history: HistoryResponse, zones: Zone[], range: WindowRange): ZoneHistory[] {
  return zones.map((zone) => {
    const valves = zone.valves.map((valve) => {
      const modeId = zone.entities.valves[valve.entity_id]?.mode;
      const modeStates = modeId ? (history[modeId] ?? []) : [];
      const runs = valveRuns(history[valve.entity_id] ?? [], range).map((run) => ({
        ...run,
        origin: runOrigin(run, modeStates, range),
      }));
      return { valve, runs, seconds: total(runs) };
    });
    const count = valves.reduce((sum, item) => sum + item.runs.length, 0);
    return { zone, valves, seconds: total(valves), count };
  });
}
