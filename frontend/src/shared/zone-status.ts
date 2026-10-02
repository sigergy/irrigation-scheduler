import { html, type TemplateResult } from "lit";

import {
  runZone,
  setZoneEnabled,
  stop,
  type Hass,
  type OpenValve,
  type Snapshot,
  type TimeSpan,
  type Valve,
  type Zone,
} from "../api";
import { dayLetters, t, type Key } from "../i18n";
import type { Action, ButtonSpec } from "./controls";

export type ZoneState = "running" | "queued" | "idle" | "stopped";

export const ZONE_LABELS: Record<ZoneState, Key> = {
  running: "status_running",
  queued: "status_queued",
  idle: "status_idle",
  stopped: "status_stopped",
};

export const ZONE_ICONS: Record<ZoneState, string> = { running: "💧", queued: "⏳", idle: "○", stopped: "⊘" };

/** Icono de la fila de zona: el de la zona en reposo; el del estado en el resto (02 §4.4). */
export function zoneIcon(zone: Zone, state: ZoneState): TemplateResult {
  if (state === "idle" && zone.icon) return html`<ha-icon class="zone-icon" .icon=${zone.icon}></ha-icon>`;
  return html`${ZONE_ICONS[state]}`;
}

// texto de los botones de zona en la barra del editor
export const ZONE_ACTION_TEXT: Record<Action, Key> = {
  run: "zone_run",
  resume: "zone_resume",
  pause: "zone_pause",
  stop: "zone_stop",
};

/** Estado de zona (02 §4.4). Una válvula encendida a mano también cuenta como «Regando». */
export function zoneState(zone: Zone, snapshot: Snapshot): ZoneState {
  if (!zone.enabled) return "stopped";
  if (zone.status === "idle" && snapshot.manual_on.some((item) => item.zone_id === zone.zone_id)) {
    return "running";
  }
  return zone.status;
}

export function zoneBadge(hass: Hass, state: ZoneState): TemplateResult {
  return html`<span class="badge ${state}">${t(hass, ZONE_LABELS[state])}</span>`;
}

/** «L M X J V · 07:00, 20:00 · 3 válvulas». */
export function zoneSummary(hass: Hass, zone: Zone): string {
  const letters = dayLetters(hass);
  const days = zone.days.length === 7 ? t(hass, "every_day") : zone.days.map((day) => letters[day]).join(" ");
  const times = zone.start_times.length ? zone.start_times.join(", ") : t(hass, "no_times");
  const valves =
    zone.valves.length === 1 ? t(hass, "valves_one") : t(hass, "valves_count", { n: zone.valves.length });
  return `${days} · ${times} · ${valves}`;
}

/** Lote en curso de la zona (válvulas abiertas y en cola), si el backend lo informa. */
export function batchSpan(zone: Zone): TimeSpan | undefined {
  if (!zone.batch_started_at || !zone.batch_ends_at) return undefined;
  return { started_at: zone.batch_started_at, ends_at: zone.batch_ends_at };
}

/** Válvula que se muestra en la fila: la primera abierta por la integración o, si no, la encendida a mano. */
export function activeValve(zone: Zone, snapshot: Snapshot): { valve: Valve; open?: OpenValve } | undefined {
  for (const valve of zone.valves) {
    const open = snapshot.open_valves.find((item) => item.entity_id === valve.entity_id);
    if (open) return { valve, open };
  }
  const manual = zone.valves.find((valve) => snapshot.manual_on.some((item) => item.entity_id === valve.entity_id));
  return manual ? { valve: manual } : undefined;
}

/** Botones de zona (02 §4.6). */
export function zoneButtons(zone: Zone, state: ZoneState): ButtonSpec[] {
  const zoneId = zone.zone_id;
  const stopZone: ButtonSpec = { action: "stop", run: (hass) => setZoneEnabled(hass, zoneId, false) };
  switch (state) {
    case "running":
    case "queued":
      return [{ action: "pause", run: (hass) => stop(hass, zoneId) }, stopZone];
    case "idle":
      return [{ action: "run", run: (hass) => runZone(hass, zoneId) }, stopZone];
    case "stopped":
      return [{ action: "resume", run: (hass) => setZoneEnabled(hass, zoneId, true) }];
  }
}
