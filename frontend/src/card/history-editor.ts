import { css, html, LitElement, nothing } from "lit";

import type { Hass } from "../api";
import { t } from "../i18n";
import { SnapshotController } from "../store";
import { cardConfigStyles, changeCardConfig, titleField, zonePicker } from "../shared/card-config";
import { define, loadHaComponents } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { parseWindow, type TimeWindow } from "../shared/time-window";
import { HISTORY_CARD_TYPE, type HistoryCardConfig } from "./history-card";
import { parseView, viewChips } from "./history-views";
import "./window-picker";

/** Editor visual de la tarjeta de histórico. */
export class HistoryEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: HistoryCardConfig | undefined;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadHaComponents().then(() => this.requestUpdate());
  }

  setConfig(config: HistoryCardConfig): void {
    this._config = { ...config, zones: Array.isArray(config.zones) ? [...config.zones] : [] };
  }

  // nunca «update»: pisaría el método de ciclo de vida de LitElement
  private changeConfig(patch: Partial<HistoryCardConfig>): void {
    if (this._config) this._config = changeCardConfig(this, this._config, patch);
  }

  protected render() {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return nothing;
    const zones = this.store.state.snapshot?.zones ?? [];
    return html`
      ${zonePicker(hass, zones, config.zones, (next) => this.changeConfig({ zones: next }))}
      <div class="section">
        <div class="label">${t(hass, "history_card_view")}</div>
        ${viewChips(hass, parseView(config.view), (view) => this.changeConfig({ view }))}
      </div>
      <div class="section">
        <div class="label">${t(hass, "history_card_window")}</div>
        <irrigation-window-picker
          allow-custom
          .hass=${hass}
          .window=${parseWindow(config.window)}
          @window-changed=${(ev: CustomEvent<{ window: TimeWindow }>) => {
            const window = ev.detail.window;
            // sin allow-range solo llegan ventanas relativas; el rango no se guarda en la configuración
            if (window.kind === "relative") this.changeConfig({ window: { amount: window.amount, unit: window.unit } });
          }}
        ></irrigation-window-picker>
      </div>
      ${titleField(hass, config.title, (title) => this.changeConfig({ title }))}
      <div class="muted small help">${t(hass, "history_card_help")}</div>
    `;
  }

  static styles = [
    sharedStyles,
    cardConfigStyles,
    css`
      :host {
        display: block;
      }
      .help {
        margin-top: 8px;
      }
    `,
  ];
}

define(`${HISTORY_CARD_TYPE}-editor`, HistoryEditor);
