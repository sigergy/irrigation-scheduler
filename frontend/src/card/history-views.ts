import { css, html, nothing, svg, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import type { Hass } from "../api";
import { formatDateTime, formatDuration, sameDay, t, type Key } from "../i18n";
import { ALERT_MARKS } from "../shared/alert-icons";
import { svgIcon } from "../shared/controls";
import type { AlertMark, HistoryMarks } from "../shared/history-marks";
import { axisDays, axisTicks, type WindowRange } from "../shared/time-window";
import type { RunOrigin, ValveHistory, ValveRun, ZoneHistory } from "../shared/valve-history";
import { tipEvents, type Tip, type TipHandler } from "./history-tip";

// vistas del histórico: solo pintan ZoneHistory[]; el cálculo está en shared/valve-history.ts

export type HistoryView = "timeline" | "totals";
export const HISTORY_VIEWS: HistoryView[] = ["timeline", "totals"];

const VIEW_KEYS: Record<HistoryView, Key> = {
  timeline: "history_view_timeline",
  totals: "history_view_totals",
};

// ancho mínimo de barra en % del eje: un riego de segundos sigue viéndose (~2 px en una tarjeta estrecha)
const MIN_BAR = 0.6;
// fecha más a la derecha que esto (fracción del eje): se ancla al final
const DAY_END_ANCHOR = 0.85;

/** Vista guardada en la configuración; una desconocida (o la antigua «list») pasa a la línea de tiempo. */
export const parseView = (view: unknown): HistoryView =>
  HISTORY_VIEWS.includes(view as HistoryView) ? (view as HistoryView) : "timeline";

/** Chips de vista: en la tarjeta cambian la vista activa; en el editor, la inicial. */
export function viewChips(hass: Hass, current: HistoryView, onPick: (view: HistoryView) => void): TemplateResult {
  return html`<div class="chips">
    ${HISTORY_VIEWS.map(
      (view) =>
        html`<button class="chip ${view === current ? "on" : ""}" @click=${() => onPick(view)}>
          ${t(hass, VIEW_KEYS[view])}
        </button>`,
    )}
  </div>`;
}

const runsText = (hass: Hass, count: number) =>
  count === 1 ? t(hass, "history_runs_one") : t(hass, "history_runs", { n: count });

const emptyZone = (hass: Hass) => html`<div class="muted small empty">${t(hass, "history_empty")}</div>`;

/** «← lun 29 07:00 → 07:29»; «→ en curso» si sigue encendida en una ventana que acaba ahora. */
function runText(hass: Hass, run: ValveRun, live: boolean): string {
  const start = Date.parse(run.started_at);
  const end = Date.parse(run.ends_at);
  const from = `${run.startsBefore ? "← " : ""}${formatDateTime(hass, start)}`;
  if (run.ongoing && live) return `${from} → ${t(hass, "history_ongoing")}`;
  const to = formatDateTime(hass, end, sameDay(hass, start, end) ? "time" : "full");
  // sigue encendida después del fin de un rango fijo
  return `${from} → ${to}${run.ongoing ? " →" : ""}`;
}

const ORIGIN_TITLES: Record<RunOrigin, Key> = {
  scheduled: "history_run_scheduled",
  manual: "history_run_manual",
  external: "history_run_external",
};

/** Riego: título por origen («Riego» sin dato), horas y tiempo real regado. */
function runTip(hass: Hass, run: ValveRun, live: boolean): Tip {
  const lines = [runText(hass, run, live), t(hass, "history_watered", { time: formatDuration(run.seconds) })];
  if (run.startsBefore) lines.push(t(hass, "history_before_window"));
  return { title: t(hass, run.origin ? ORIGIN_TITLES[run.origin] : "history_run"), lines };
}

const markTip = (hass: Hass, mark: AlertMark): Tip => ({
  title: t(hass, mark.type.name),
  lines: [formatDateTime(hass, mark.at)],
});

const position = (range: WindowRange, ms: number) => ((ms - range.start) / (range.end - range.start)) * 100;

/** Una fila por válvula con encendidos o alertas: barras y marcas sobre el eje de la ventana, sin scroll horizontal. */
export function historyTimeline(
  hass: Hass,
  history: ZoneHistory[],
  marks: HistoryMarks,
  range: WindowRange,
  live: boolean,
  onTip: TipHandler,
): TemplateResult {
  const ticks = axisTicks(range, hass.config.time_zone);
  const bars = (runs: ValveRun[]) =>
    runs.map((run) => {
      const x = position(range, Date.parse(run.started_at));
      const width = Math.max(MIN_BAR, position(range, Date.parse(run.ends_at)) - x);
      const on = tipEvents(onTip, runTip(hass, run, live));
      return svg`<rect class=${run.ongoing ? "ongoing" : ""} x=${x} y="0" width=${width} height="10"
        @pointerenter=${on.enter} @pointerleave=${on.leave} @click=${on.click}></rect>`;
    });
  const markButtons = (items: AlertMark[]) =>
    items.map((mark) => {
      const style = ALERT_MARKS[mark.type.id];
      const on = tipEvents(onTip, markTip(hass, mark));
      return html`<button
        class="tl-mark ${style.color}"
        style=${styleMap({ left: `${position(range, mark.at)}%` })}
        aria-label=${t(hass, mark.type.name)}
        @pointerenter=${on.enter}
        @pointerleave=${on.leave}
        @click=${on.click}
      >
        ${svgIcon(style.icon)}
      </button>`;
    });
  const grid = ticks.map((tick) => {
    const x = position(range, tick.at);
    return svg`<line x1=${x} x2=${x} y1="0" y2="10"></line>`;
  });
  const row = (label: string, runs: ValveRun[], items: AlertMark[], extra = "") => html`<div class="tl-row ${extra}">
    <span class="tl-label small">${label}</span>
    <div class="tl-lane">
      <svg class="tl-bars" viewBox="0 0 100 10" preserveAspectRatio="none">${grid}${bars(runs)}</svg>
      ${markButtons(items)}
    </div>
  </div>`;
  const zoneBlock = ({ zone, valves }: ZoneHistory) => {
    const zoneMarks = marks.zones[zone.zone_id];
    const valveMarks = (item: ValveHistory) => zoneMarks?.valves[item.valve.entity_id] ?? [];
    const shown = valves.filter((item) => item.runs.length || valveMarks(item).length);
    // la fila de la zona solo lleva pista si tiene alertas de zona
    const title = zoneMarks?.zone.length
      ? row(zone.name, [], zoneMarks.zone, "tl-zone")
      : html`<div class="tl-zone">${zone.name}</div>`;
    return html`${title}
      ${shown.length ? shown.map((item) => row(item.valve.name, item.runs, valveMarks(item))) : emptyZone(hass)}`;
  };
  const days = axisDays(range, hass.config.time_zone);
  return html`${days.length
      ? html`<div class="tl-row tl-days">
          <span></span>
          <div class="tl-track">
            ${days.map(
              // cerca del borde derecho se ancla al final para no salirse
              (day) =>
                html`<span
                  class="tl-day small muted ${day.midnight && day.x <= DAY_END_ANCHOR ? "midnight" : ""}"
                  style=${styleMap(day.x > DAY_END_ANCHOR ? { right: "0" } : { left: `${day.x * 100}%` })}
                >
                  ${formatDateTime(hass, day.at, "day")}
                </span>`,
            )}
          </div>
        </div>`
      : nothing}
    <div class="tl-row tl-axis">
      <span></span>
      <div class="tl-track">
        ${ticks.map(
          (tick) =>
            html`<span class="tl-tick small muted" style=${styleMap({ left: `${position(range, tick.at)}%` })}>
              ${formatDateTime(hass, tick.at, tick.parts)}
            </span>`,
        )}
      </div>
    </div>
    ${marks.installation.length ? row(t(hass, "history_installation"), [], marks.installation, "tl-zone") : nothing}
    ${history.map(zoneBlock)}`;
}

/** Recuento y tiempo total por zona y por válvula; muestra también las válvulas sin encendidos. */
export function historyTotals(hass: Hass, history: ZoneHistory[]): TemplateResult {
  return html`<div class="totals">
    ${history.map(
      ({ zone, valves, seconds, count }) =>
        html`<span class="t-zone">${zone.name}</span>
          <span class="t-zone">${runsText(hass, count)}</span>
          <span class="t-zone t-time">${formatDuration(seconds)}</span>
          ${valves.map(
            (item) =>
              html`<span class="t-valve">${item.valve.name}</span>
                <span class="muted">${item.runs.length}</span>
                <span class="t-time">${formatDuration(item.seconds)}</span>`,
          )}`,
    )}
  </div>`;
}

export const historyStyles = css`
  .empty {
    padding: 4px 0 8px 28px;
  }
  .tl-row {
    display: grid;
    grid-template-columns: minmax(0, 35%) 1fr;
    gap: 8px;
    align-items: center;
    padding: 2px 0;
  }
  .tl-track {
    position: relative;
    height: 1.4em;
  }
  .tl-tick {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .tl-day {
    position: absolute;
    white-space: nowrap;
  }
  .tl-day.midnight {
    padding-left: 4px;
    border-left: 1px solid var(--divider-color);
  }
  .tl-zone {
    font-weight: 500;
    margin-top: 8px;
  }
  .tl-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tl-bars {
    display: block;
    width: 100%;
    height: 12px;
    border-radius: 2px;
    background: var(--secondary-background-color);
  }
  .tl-bars rect {
    fill: var(--primary-color);
  }
  .tl-bars rect.ongoing {
    fill: var(--accent-color);
  }
  .tl-bars line {
    stroke: var(--divider-color);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .tl-lane {
    position: relative;
  }
  .tl-bars rect {
    cursor: pointer;
  }
  button.tl-mark {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    min-width: 0;
    min-height: 0;
    padding: 2px;
    border: none;
    border-radius: 50%;
    background: var(--card-background-color);
    line-height: 0;
  }
  button.tl-mark .svg-icon {
    width: 16px;
    height: 16px;
  }
  button.tl-mark.error {
    color: var(--error-color);
  }
  button.tl-mark.warning {
    color: var(--warning-color);
  }
  button.tl-mark.info {
    color: var(--info-color);
  }
  .totals {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 4px 12px;
  }
  .t-zone {
    font-weight: 500;
    margin-top: 8px;
  }
  .t-valve {
    padding-left: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .t-time {
    text-align: right;
  }
`;
