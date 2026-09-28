import { css, html, LitElement, nothing } from "lit";

import type { Hass } from "../api";
import { t } from "../i18n";
import { SnapshotController } from "../store";
import { fireEvent } from "../shared/controls";
import { define, loadHaComponents, selectorValue } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { CARD_TYPE, type CardConfig } from "./irrigation-card";

/** Editor visual de la tarjeta (mockup 04). */
export class CardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: CardConfig | undefined;

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

  setConfig(config: CardConfig): void {
    this._config = { ...config, zones: Array.isArray(config.zones) ? [...config.zones] : [] };
  }

  // nunca «update»: pisaría el método de ciclo de vida de LitElement
  private changeConfig(patch: Partial<CardConfig>): void {
    if (!this._config) return;
    const config: CardConfig = { ...this._config, ...patch };
    if (!config.title) delete config.title;
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }

  private addZone(ev: Event): void {
    const select = ev.target as HTMLSelectElement;
    const zoneId = select.value;
    select.value = "";
    if (!this._config || !zoneId) return;
    this.changeConfig({ zones: [...this._config.zones, zoneId] });
  }

  protected render() {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return nothing;
    const zones = this.store.state.snapshot?.zones ?? [];
    const nameOf = (zoneId: string) => zones.find((zone) => zone.zone_id === zoneId)?.name ?? zoneId;
    const available = zones.filter((zone) => !config.zones.includes(zone.zone_id));
    return html`
      <div class="section">
        <div class="label">${t(hass, "card_zones")}*</div>
        <div class="chips">
          ${config.zones.map(
            (zoneId) =>
              html`<button
                class="chip on"
                @click=${() => this.changeConfig({ zones: config.zones.filter((item) => item !== zoneId) })}
              >
                ${nameOf(zoneId)} ✕
              </button>`,
          )}
          ${available.length
            ? html`<select @change=${this.addZone}>
                <option value="" selected>${t(hass, "add_zone")}</option>
                ${available.map((zone) => html`<option .value=${zone.zone_id}>${zone.name}</option>`)}
              </select>`
            : nothing}
        </div>
        ${config.zones.length ? nothing : html`<div class="error-text">${t(hass, "card_no_zones")}</div>`}
        <div class="muted small">${t(hass, "card_order_help")}</div>
      </div>
      <ha-selector
        .hass=${hass}
        .selector=${{ text: {} }}
        .label=${t(hass, "card_title")}
        .value=${config.title ?? ""}
        @value-changed=${(ev: Event) => this.changeConfig({ title: selectorValue<string>(ev) ?? "" })}
      ></ha-selector>
    `;
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .chips {
        margin-bottom: 4px;
      }
    `,
  ];
}

define(`${CARD_TYPE}-editor`, CardEditor);
