import { html, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import {
  pauseValve,
  runValve,
  setValveEnabled,
  type Hass,
  type OpenValve,
  type Snapshot,
  type TimeSpan,
  type Valve,
} from "../api";
import { formatDuration, t, type Key } from "../i18n";
import type { ButtonSpec } from "./controls";

export type ValveState = "running" | "manual" | "queued" | "idle" | "stopped";

export interface ValveLive {
  state: ValveState;
  open?: OpenValve;
}

export const STATE_ICONS: Record<ValveState, string> = {
  running: "💧",
  manual: "💧",
  queued: "⏳",
  idle: "○",
  stopped: "⊘",
};

const LABELS: Record<ValveState, Key> = {
  running: "status_running",
  manual: "status_manual",
  queued: "status_queued",
  idle: "status_idle",
  stopped: "status_stopped",
};

/** Estado de una válvula guardada (02 §4.5). */
export function valveLive(valve: Valve, snapshot: Snapshot): ValveLive {
  const open = snapshot.open_valves.find((item) => item.entity_id === valve.entity_id);
  if (open) return { state: "running", open };
  if (snapshot.manual_on.some((item) => item.entity_id === valve.entity_id)) return { state: "manual" };
  if (snapshot.pending.some((job) => job.entity_id === valve.entity_id)) return { state: "queued" };
  return { state: valve.enabled ? "idle" : "stopped" };
}

export function remainingSeconds(span: Pick<TimeSpan, "ends_at">): number {
  return (Date.parse(span.ends_at) - Date.now()) / 1000;
}

export function progressBar(span: TimeSpan): TemplateResult {
  const start = Date.parse(span.started_at);
  const total = Date.parse(span.ends_at) - start;
  const ratio = total > 0 ? Math.min(1, Math.max(0, (Date.now() - start) / total)) : 1;
  return html`<div class="progress"><div style=${styleMap({ width: `${ratio * 100}%` })}></div></div>`;
}

/** «quedan 6:12», «En cola», «Detenida»… */
export function valveStatusText(hass: Hass, live: ValveLive): string {
  if (live.open) return t(hass, "remaining", { time: formatDuration(remainingSeconds(live.open)) });
  return t(hass, LABELS[live.state]);
}

/** Botones de válvula (02 §4.5). */
export function valveButtons(valve: Valve, live: ValveLive): ButtonSpec[] {
  const entityId = valve.entity_id;
  const stopValve: ButtonSpec = { action: "stop", run: (hass) => setValveEnabled(hass, entityId, false) };
  switch (live.state) {
    case "running":
    case "manual":
    case "queued":
      return [{ action: "pause", run: (hass) => pauseValve(hass, entityId) }, stopValve];
    case "idle":
      return [{ action: "run", run: (hass) => runValve(hass, entityId) }, stopValve];
    case "stopped":
      return [{ action: "resume", run: (hass) => setValveEnabled(hass, entityId, true) }];
  }
}
