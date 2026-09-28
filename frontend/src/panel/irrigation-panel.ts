import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { stop, type Hass } from "../api";
import { t } from "../i18n";
import { SnapshotController } from "../store";
import { controlButton } from "../shared/controls";
import { define, loadHaComponents } from "../shared/ha-components";
import { sharedStyles, toolbarStyles } from "../shared/styles";
import "./zone-list";
import "./zone-editor";

type Tab = "zones" | "settings";

interface SettingsElement extends HTMLElement {
  save(): Promise<void>;
}

/** Panel lateral: barra, pestañas, banners y vista activa (02 §4). */
export class IrrigationPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    _tab: { state: true },
    _zoneId: { state: true },
    _ready: { state: true },
    _settingsDirty: { state: true },
  };

  declare hass: Hass;
  declare narrow: boolean;
  declare _tab: Tab;
  // undefined = lista; null = zona nueva; string = zona existente
  declare _zoneId: string | null | undefined;
  declare _ready: boolean;
  declare _settingsDirty: boolean;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.narrow = false;
    this._tab = "zones";
    this._zoneId = undefined;
    this._ready = false;
    this._settingsDirty = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadHaComponents().then(() => {
      this._ready = true;
    });
  }

  protected render() {
    if (!this.hass) return nothing;
    const { snapshot } = this.store.state;
    if (this._tab === "zones" && this._zoneId !== undefined && snapshot && this._ready) {
      // el editor pinta su propia barra (← nombre, botones, Guardar)
      return html`<irrigation-zone-editor
        .hass=${this.hass}
        .narrow=${this.narrow}
        .snapshot=${snapshot}
        .zoneId=${this._zoneId}
        @zone-close=${() => {
          this._zoneId = undefined;
        }}
        @zone-saved=${(ev: CustomEvent<{ zoneId: string }>) => {
          this._zoneId = ev.detail.zoneId;
        }}
      ></irrigation-zone-editor>`;
    }
    return html`${this.renderToolbar()}
      <div class="content ${this._tab}">${this.renderBody()}</div>`;
  }

  private renderToolbar(): TemplateResult {
    const hass = this.hass;
    const { snapshot } = this.store.state;
    const admin = hass.user?.is_admin ?? false;
    let action: TemplateResult | typeof nothing = nothing;
    if (this._tab === "zones" && snapshot) {
      action = controlButton(this, hass, { action: "pause", run: (h) => stop(h) }, t(hass, "pause_all"));
    } else if (this._tab === "settings" && snapshot && admin) {
      action = html`<button
        class="filled"
        ?disabled=${!this._settingsDirty || !hass.connected}
        @click=${this.saveSettings}
      >
        ${t(hass, "save")}
      </button>`;
    }
    return html`<div class="toolbar">
      <ha-menu-button .hass=${hass} .narrow=${this.narrow}></ha-menu-button>
      <span class="title">${t(hass, "title")}</span>
      <button class="tab ${this._tab === "zones" ? "active" : ""}" @click=${() => this.selectTab("zones")}>
        ${t(hass, "tab_zones")}
      </button>
      <button class="tab ${this._tab === "settings" ? "active" : ""}" @click=${() => this.selectTab("settings")}>
        ${t(hass, "tab_settings")}
      </button>
      <span class="spacer"></span>
      ${action}
    </div>`;
  }

  private renderBody(): TemplateResult {
    const hass = this.hass;
    const { snapshot, error } = this.store.state;
    if (error === "not_loaded") return html`<div class="banner warning">${t(hass, "not_loaded")}</div>`;
    if (error) return html`<div class="banner error">${t(hass, "load_error")}</div>`;
    if (!snapshot || !this._ready) return html`<div class="muted">${t(hass, "loading")}</div>`;
    // sin conexión: se sigue pintando el último snapshot, con los botones deshabilitados
    const banner = hass.connected ? nothing : html`<div class="banner error">${t(hass, "disconnected")}</div>`;
    if (this._tab === "settings") {
      return html`${banner}<irrigation-settings-view
          .hass=${hass}
          .snapshot=${snapshot}
          @settings-dirty=${(ev: CustomEvent<boolean>) => {
            this._settingsDirty = ev.detail;
          }}
        ></irrigation-settings-view>`;
    }
    return html`${banner}<irrigation-zone-list
        .hass=${hass}
        .snapshot=${snapshot}
        @zone-open=${(ev: CustomEvent<{ zoneId: string | null }>) => {
          this._zoneId = ev.detail.zoneId;
        }}
      ></irrigation-zone-list>`;
  }

  private selectTab(tab: Tab): void {
    if (tab === this._tab) return;
    if (this._settingsDirty && !window.confirm(t(this.hass, "confirm_discard_settings"))) return;
    this._settingsDirty = false;
    this._zoneId = undefined;
    this._tab = tab;
  }

  private async saveSettings(): Promise<void> {
    const view = this.renderRoot.querySelector<SettingsElement>("irrigation-settings-view");
    await view?.save();
  }

  static styles = [
    sharedStyles,
    toolbarStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--primary-background-color);
      }
      .content {
        padding: 16px;
        max-width: 1200px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .content.settings {
        max-width: 760px;
      }
    `,
  ];
}

define("irrigation-scheduler-panel", IrrigationPanel);
