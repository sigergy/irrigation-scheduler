import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { fetchValveHistory, type Hass, type HistoryResponse, type Snapshot, type Zone } from "../api";
import { t } from "../i18n";
import { SnapshotController, TickController } from "../store";
import { cardZoneIds, parseCardZones, storeNotice } from "../shared/card-config";
import { define, registerCard } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { parseWindow, resolveWindow, type TimeWindow, type WindowUnit } from "../shared/time-window";
import { buildHistory } from "../shared/valve-history";
import {
  HISTORY_VIEWS,
  historyList,
  historyStyles,
  historyTimeline,
  historyTotals,
  viewChips,
  type HistoryView,
} from "./history-views";
import "./window-picker";

export const HISTORY_CARD_TYPE = "irrigation-history-card";
// el snapshot llega en cada cambio de válvula: una ráfaga se agrupa en una sola consulta
const RELOAD_DEBOUNCE_MS = 2000;

export interface HistoryCardConfig {
  type: string;
  zones: string[];
  title?: string;
  // iniciales: después mandan los chips de la tarjeta
  view?: HistoryView;
  window?: { amount: number; unit: WindowUnit };
}

/** Histórico de encendidos reales por zona, desde el recorder de HA. */
export class HistoryCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _view: { state: true },
    _window: { state: true },
    _history: { state: true },
    _error: { state: true },
    _expanded: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: HistoryCardConfig | undefined;
  declare _view: HistoryView;
  declare _window: TimeWindow;
  // undefined = cargando
  declare _history: HistoryResponse | undefined;
  declare _error: boolean;
  // se sustituye por un Set nuevo en cada cambio para que Lit lo detecte
  declare _expanded: Set<string>;

  private readonly store = new SnapshotController(this);
  // consulta vigente: entidades + ventana; si cambia, se vuelve a pedir
  private fetchKey?: string;
  private lastSnapshot?: Snapshot;
  // descarta respuestas de consultas anteriores a la vigente
  private seq = 0;
  private reloadTimer?: number;

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
    this._view = "list";
    this._window = parseWindow(undefined);
    this._history = undefined;
    this._error = false;
    this._expanded = new Set();
    // las duraciones «en curso» avanzan sin volver a consultar
    new TickController(this);
  }

  setConfig(config: HistoryCardConfig): void {
    this._config = { ...config, zones: parseCardZones(config?.zones) };
    this._view = HISTORY_VIEWS.includes(config?.view as HistoryView) ? (config.view as HistoryView) : "list";
    this._window = parseWindow(config?.window);
  }

  getCardSize(): number {
    return 4;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(`${HISTORY_CARD_TYPE}-editor`);
  }

  static getStubConfig(): HistoryCardConfig {
    return { type: `custom:${HISTORY_CARD_TYPE}`, zones: [] };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.reloadTimer);
    // al volver al DOM se consulta de nuevo
    this.fetchKey = undefined;
  }

  /** Zonas elegidas que existen, en el orden de la tarjeta; una que ya no existe se omite. */
  private zones(snapshot: Snapshot): Zone[] {
    return cardZoneIds(this._config?.zones ?? [], snapshot.zones).flatMap((zoneId) =>
      snapshot.zones.filter((zone) => zone.zone_id === zoneId),
    );
  }

  protected updated(): void {
    const snapshot = this.store.state.snapshot;
    if (!this.hass || !this._config || !snapshot) return;
    const entityIds = this.zones(snapshot).flatMap((zone) => zone.valves.map((valve) => valve.entity_id));
    const key = `${entityIds.join(",")}|${JSON.stringify(this._window)}`;
    if (key !== this.fetchKey) {
      this.fetchKey = key;
      this.lastSnapshot = snapshot;
      void this.load(entityIds, true);
      return;
    }
    if (snapshot !== this.lastSnapshot) {
      this.lastSnapshot = snapshot;
      // un rango fijo es pasado: no cambia
      if (this._window.kind === "relative") this.scheduleReload(entityIds);
    }
  }

  private scheduleReload(entityIds: string[]): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(entityIds, false), RELOAD_DEBOUNCE_MS);
  }

  /** `reset`: vacía lo mostrado mientras carga (cambio de ventana o de zonas). */
  private async load(entityIds: string[], reset: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    window.clearTimeout(this.reloadTimer);
    const seq = ++this.seq;
    if (reset) this._history = undefined;
    const range = resolveWindow(this._window, Date.now());
    try {
      const history = entityIds.length ? await fetchValveHistory(hass, entityIds, range.start, range.end) : {};
      if (seq !== this.seq) return;
      this._history = history;
      this._error = false;
    } catch {
      if (seq === this.seq) this._error = true;
    }
  }

  private toggle(zoneId: string): void {
    const next = new Set(this._expanded);
    if (next.has(zoneId)) next.delete(zoneId);
    else next.add(zoneId);
    this._expanded = next;
  }

  protected render() {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const { snapshot } = this.store.state;
    const body = storeNotice(hass, this.store.state) ?? (snapshot ? this.renderHistory(hass, snapshot) : nothing);
    return html`<ha-card .header=${config.title}>
      <div class="card-content">
        ${snapshot && !hass.connected ? html`<div class="banner error">${t(hass, "disconnected")}</div>` : nothing}
        ${viewChips(hass, this._view, (view) => {
          this._view = view;
        })}
        <irrigation-window-picker
          allow-range
          .hass=${hass}
          .window=${this._window}
          @window-changed=${(ev: CustomEvent<{ window: TimeWindow }>) => {
            this._window = ev.detail.window;
          }}
        ></irrigation-window-picker>
        <div class="view">${body}</div>
      </div>
    </ha-card>`;
  }

  private renderHistory(hass: Hass, snapshot: Snapshot): TemplateResult {
    if (this._error) return html`<div class="muted">${t(hass, "history_unavailable")}</div>`;
    if (!this._history) return html`<div class="muted">${t(hass, "loading")}</div>`;
    const zones = this.zones(snapshot);
    if (!zones.length) return html`<div class="muted">${t(hass, "empty_list")}</div>`;
    const range = resolveWindow(this._window, Date.now());
    const history = buildHistory(this._history, zones, range);
    const live = this._window.kind === "relative";
    switch (this._view) {
      case "list":
        return historyList(hass, history, this._expanded, (zoneId) => this.toggle(zoneId), live);
      case "timeline":
        return historyTimeline(hass, history, range, live);
      case "totals":
        return historyTotals(hass, history);
    }
  }

  static styles = [
    sharedStyles,
    historyStyles,
    css`
      .card-content {
        padding: 0 16px 8px;
      }
      ha-card:not([header]) .card-content {
        padding-top: 8px;
      }
      irrigation-window-picker {
        margin: 8px 0;
      }
      .view {
        border-top: 1px solid var(--divider-color);
        padding-top: 8px;
      }
    `,
  ];
}

define(HISTORY_CARD_TYPE, HistoryCard);

registerCard({
  type: HISTORY_CARD_TYPE,
  name: "Irrigation Scheduler History",
  description: t(undefined, "history_description"),
  preview: true,
});
