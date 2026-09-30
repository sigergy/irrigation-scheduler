import { css, html, nothing, type TemplateResult } from "lit";
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
import { controlButton, type ButtonSpec } from "./controls";

export type ValveState = "running" | "opening" | "closing" | "manual" | "queued" | "idle" | "stopped" | "no_water";

export interface ValveLive {
  state: ValveState;
  open?: OpenValve;
  // tramo de la barra: el de open o, encendida a mano, since + duration_min (03 §5.3.2)
  span?: TimeSpan;
}

export const STATE_ICONS: Record<ValveState, string> = {
  running: "💧",
  opening: "⏳",
  closing: "⏳",
  manual: "💧",
  queued: "⏳",
  idle: "○",
  stopped: "⊘",
  no_water: "🚱",
};

const LABELS: Record<ValveState, Key> = {
  running: "status_running",
  opening: "status_opening",
  closing: "status_closing",
  manual: "status_manual",
  queued: "status_queued",
  idle: "status_idle",
  stopped: "status_stopped",
  no_water: "status_no_water",
};

/** Estado de una válvula guardada (02 §4.5). */
export function valveLive(valve: Valve, snapshot: Snapshot): ValveLive {
  // va primero: sigue en open_valves hasta que la switch confirma el apagado
  if (snapshot.closing?.includes(valve.entity_id)) return { state: "closing" };
  const open = snapshot.open_valves.find((item) => item.entity_id === valve.entity_id);
  if (open) return { state: "running", open, span: open };
  // la zona ya sale «Regando»; la válvula dice que espera a la switch
  if (snapshot.opening.some((item) => item.entity_id === valve.entity_id)) return { state: "opening" };
  const manual = snapshot.manual_on.find((item) => item.entity_id === valve.entity_id);
  if (manual) {
    // el backend la apaga a esa misma hora (_manual_ends)
    const endsAt = new Date(Date.parse(manual.since) + valve.duration_min * 60_000).toISOString();
    return { state: "manual", span: { started_at: manual.since, ends_at: endsAt } };
  }
  if (snapshot.pending.some((job) => job.entity_id === valve.entity_id)) return { state: "queued" };
  if (!valve.enabled) return { state: "stopped" };
  // detrás de detenida: una válvula desactivada conserva su botón de reanudar
  if (snapshot.no_water.some((item) => item.entity_id === valve.entity_id)) return { state: "no_water" };
  return { state: "idle" };
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
    case "opening":
    case "manual":
    case "queued":
      return [{ action: "pause", run: (hass) => pauseValve(hass, entityId) }, stopValve];
    case "idle":
    case "no_water":
      return [{ action: "run", run: (hass) => runValve(hass, entityId) }, stopValve];
    case "closing":
      return [];
    case "stopped":
      return [{ action: "resume", run: (hass) => setValveEnabled(hass, entityId, true) }];
  }
}

/** Fila de válvula con estado, progreso y botones: lista desplegable de la tarjeta y del panel. */
export function valveRow(host: HTMLElement, hass: Hass, snapshot: Snapshot, valve: Valve): TemplateResult {
  const live = valveLive(valve, snapshot);
  let right = "";
  if (live.span) right = formatDuration(remainingSeconds(live.span));
  else if (live.state !== "idle") right = valveStatusText(hass, live).toLocaleLowerCase();
  return html`<div class="valve-row">
    <span class="valve-icon">${STATE_ICONS[live.state]}</span>
    <div class="valve-main">
      <div>${valve.name} · ${t(hass, "minutes_short", { n: valve.duration_min })}</div>
      ${live.span ? progressBar(live.span) : nothing}
    </div>
    <span class="small valve-time ${live.state === "no_water" ? "no-water" : "muted"}">${right}</span>
    <div class="valve-buttons">${valveButtons(valve, live).map((spec) => controlButton(host, hass, spec))}</div>
  </div>`;
}

export const valveRowStyles = css`
  .valve-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .valve-icon {
    width: 24px;
    text-align: center;
  }
  .valve-main {
    flex: 1;
    min-width: 0;
  }
  .valve-time {
    white-space: nowrap;
  }
  .valve-time.no-water {
    color: var(--error-color);
  }
  .valve-buttons {
    display: flex;
    gap: 4px;
    flex: none;
  }
`;
