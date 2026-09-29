import { css, html, LitElement, nothing } from "lit";

import type { Hass } from "../api";
import { SnapshotController } from "../store";
import { cardConfigStyles, changeCardConfig, titleField, zonePicker } from "../shared/card-config";
import { define, loadHaComponents } from "../shared/ha-components";
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
    if (this._config) this._config = changeCardConfig(this, this._config, patch);
  }

  protected render() {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return nothing;
    const zones = this.store.state.snapshot?.zones ?? [];
    return html`
      ${zonePicker(hass, zones, config.zones, (next) => this.changeConfig({ zones: next }))}
      ${titleField(hass, config.title, (title) => this.changeConfig({ title }))}
    `;
  }

  static styles = [
    sharedStyles,
    cardConfigStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];
}

define(`${CARD_TYPE}-editor`, CardEditor);
