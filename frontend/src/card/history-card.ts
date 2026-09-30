import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import {
  fetchAlertHistory,
  fetchValveHistory,
  type AlertHistoryResponse,
  type Hass,
  type HistoryResponse,
  type Snapshot,
  type Zone,
} from "../api";
import { t } from "../i18n";
import { SnapshotController, TickController } from "../store";
import { cardZoneIds, parseCardZones, storeNotice } from "../shared/card-config";
import { define, registerCard } from "../shared/ha-components";
import { alertEntityIds, buildMarks } from "../shared/history-marks";
import { sharedStyles } from "../shared/styles";
import { parseWindow, resolveWindow, type TimeWindow, type WindowUnit } from "../shared/time-window";
import { buildHistory } from "../shared/valve-history";
import {
  historyStyles,
  historyTimeline,
  historyTotals,
  parseView,
  viewChips,
  type HistoryView,
} from "./history-views";
import { placeTip, renderTip, tipStyles, type Tip } from "./history-tip";
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
    _alerts: { state: true },
    _error: { state: true },
    _tip: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: HistoryCardConfig | undefined;
  declare _view: HistoryView;
  declare _window: TimeWindow;
  // undefined = cargando
  declare _history: HistoryResponse | undefined;
  // alertas de las entidades event; {} si no hay o si falla su consulta
  declare _alerts: AlertHistoryResponse;
  declare _error: boolean;
  // pop up abierto en la línea de tiempo y la barra o marca que lo abrió
  declare _tip: Tip | undefined;
  private tipTarget?: Element;

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
    this._view = "timeline";
    this._window = parseWindow(undefined);
    this._history = undefined;
    this._alerts = {};
    this._error = false;
    this._tip = undefined;
    // las duraciones «en curso» avanzan sin volver a consultar
    new TickController(this);
  }

  setConfig(config: HistoryCardConfig): void {
    this._config = { ...config, zones: parseCardZones(config?.zones) };
    this._view = parseView(config?.view);
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

  private readonly onTip = (target: Element, tip?: Tip): void => {
    if (tip) {
      this.tipTarget = target;
      this._tip = tip;
    } else if (target === this.tipTarget) this.closeTip();
  };

  private closeTip(): void {
    this._tip = undefined;
    this.tipTarget = undefined;
  }

  // un toque fuera de la tarjeta cierra el pop up
  private readonly onWindowClick = (ev: Event): void => {
    if (this._tip && !ev.composedPath().includes(this)) this.closeTip();
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("click", this.onWindowClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("click", this.onWindowClick);
    this.closeTip();
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

  /** Coloca el pop up junto a su ancla; si el ancla ya no está en el DOM, lo cierra. */
  private positionTip(): void {
    if (!this._tip || !this.tipTarget) return;
    if (!this.tipTarget.isConnected) {
      this.closeTip();
      return;
    }
    const el = this.renderRoot.querySelector<HTMLElement>(".tip");
    const container = this.renderRoot.querySelector<HTMLElement>(".card-content");
    if (el && container) placeTip(el, this.tipTarget, container);
  }

  protected updated(): void {
    this.positionTip();
    const snapshot = this.store.state.snapshot;
    if (!this.hass || !this._config || !snapshot) return;
    const zones = this.zones(snapshot);
    // switch y su sensor «Modo riego»: mismo formato mínimo
    const entityIds = zones.flatMap((zone) =>
      zone.valves.flatMap((valve) => {
        const mode = zone.entities.valves[valve.entity_id]?.mode;
        return mode ? [valve.entity_id, mode] : [valve.entity_id];
      }),
    );
    const alertIds = alertEntityIds(zones, snapshot.installation_alerts);
    const key = `${entityIds.join(",")}|${alertIds.join(",")}|${JSON.stringify(this._window)}`;
    if (key !== this.fetchKey) {
      this.fetchKey = key;
      this.lastSnapshot = snapshot;
      void this.load(entityIds, alertIds, true);
      return;
    }
    if (snapshot !== this.lastSnapshot) {
      this.lastSnapshot = snapshot;
      // un rango fijo es pasado: no cambia
      if (this._window.kind === "relative") this.scheduleReload(entityIds, alertIds);
    }
  }

  private scheduleReload(entityIds: string[], alertIds: string[]): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(entityIds, alertIds, false), RELOAD_DEBOUNCE_MS);
  }

  /** `reset`: vacía lo mostrado mientras carga (cambio de ventana o de zonas). */
  private async load(entityIds: string[], alertIds: string[], reset: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    window.clearTimeout(this.reloadTimer);
    const seq = ++this.seq;
    if (reset) this._history = undefined;
    const range = resolveWindow(this._window, Date.now());
    try {
      const [history, alerts] = await Promise.all([
        entityIds.length ? fetchValveHistory(hass, entityIds, range.start, range.end) : Promise.resolve<HistoryResponse>({}),
        // si fallan las alertas se pintan los riegos igual, sin marcas ni error (spec, «Datos»)
        alertIds.length
          ? fetchAlertHistory(hass, alertIds, range.start, range.end).catch((): AlertHistoryResponse => ({}))
          : Promise.resolve<AlertHistoryResponse>({}),
      ]);
      if (seq !== this.seq) return;
      this._history = history;
      this._alerts = alerts;
      this._error = false;
    } catch {
      if (seq === this.seq) this._error = true;
    }
  }

  protected render() {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const { snapshot } = this.store.state;
    const body = storeNotice(hass, this.store.state) ?? (snapshot ? this.renderHistory(hass, snapshot) : nothing);
    return html`<ha-card .header=${config.title} @click=${() => this.closeTip()}>
      <div class="card-content">
        ${snapshot && !hass.connected ? html`<div class="banner error">${t(hass, "disconnected")}</div>` : nothing}
        ${viewChips(hass, this._view, (view) => {
          this._view = view;
          this.closeTip();
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
        ${renderTip(this._tip)}
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
    switch (this._view) {
      case "timeline": {
        const marks = buildMarks(this._alerts, zones, snapshot.installation_alerts, snapshot.settings, range);
        return historyTimeline(hass, history, marks, range, this._window.kind === "relative", this.onTip);
      }
      case "totals":
        return historyTotals(hass, history);
    }
  }

  static styles = [
    sharedStyles,
    historyStyles,
    tipStyles,
    css`
      .card-content {
        position: relative;
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
