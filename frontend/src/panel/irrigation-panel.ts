import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";

import { stop, type Hass } from "../api";
import { t } from "../i18n";
import { SnapshotController } from "../store";
import { controlButton } from "../shared/controls";
import { confirmDialog } from "../shared/confirm-dialog";
import { define, loadHaComponents } from "../shared/ha-components";
import { sharedStyles, toolbarStyles } from "../shared/styles";
import type { IrrigationCard } from "../card/irrigation-card";
import type { HistoryCard } from "../card/history-card";
import "../card/irrigation-card";
import "../card/history-card";
import "./settings-view";

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
    _ready: { state: true },
    _settingsDirty: { state: true },
  };

  declare hass: Hass;
  declare narrow: boolean;
  declare _tab: Tab;
  declare _ready: boolean;
  declare _settingsDirty: boolean;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.narrow = false;
    this._tab = "zones";
    this._ready = false;
    this._settingsDirty = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadHaComponents().then(() => {
      this._ready = true;
    });
  }

  // `zones: []` = todas las zonas. setConfig va una sola vez por elemento: reinicia vista y ventana del histórico
  private readonly configureSummary = (el?: Element): void => {
    (el as IrrigationCard | undefined)?.setConfig({ type: "custom:irrigation-scheduler-card", zones: [] });
  };
  private readonly configureHistory = (el?: Element): void => {
    (el as HistoryCard | undefined)?.setConfig({ type: "custom:irrigation-history-card", zones: [] });
  };

  protected render() {
    if (!this.hass) return nothing;
    return html`${this.renderToolbar()}
      <div class="content ${this._tab}">${this.renderBody()}</div>`;
  }

  private renderToolbar(): TemplateResult {
    const hass = this.hass;
    const { snapshot } = this.store.state;
    let action: TemplateResult | typeof nothing = nothing;
    if (this._tab === "zones" && snapshot) {
      action = controlButton(this, hass, { action: "pause", run: (h) => stop(h) }, t(hass, "pause_all"));
    } else if (this._tab === "settings" && snapshot) {
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
    // las tarjetas Lovelace son la vista: cada una abre su propia suscripción al store y su editor en diálogo
    return html`${banner}
      <div class="cards">
        <irrigation-scheduler-card ${ref(this.configureSummary)} .hass=${hass}></irrigation-scheduler-card>
        <irrigation-history-card ${ref(this.configureHistory)} .hass=${hass}></irrigation-history-card>
      </div>`;
  }

  private async selectTab(tab: Tab): Promise<void> {
    if (tab === this._tab) return;
    if (
      this._settingsDirty &&
      !(await confirmDialog(this.hass, {
        text: t(this.hass, "confirm_discard_settings"),
        confirmText: t(this.hass, "confirm_discard_action"),
        destructive: true,
      }))
    )
      return;
    this._settingsDirty = false;
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
      .cards {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      @media (max-width: 450px) {
        /* móvil estrecho: «Pausar todo» queda solo con el icono para que quepan las pestañas */
        .toolbar {
          gap: 4px;
          padding: 0 8px;
        }
        .toolbar .title {
          margin-right: 4px;
        }
        .toolbar button .text {
          display: none;
        }
        .content {
          padding: 8px;
        }
        .cards {
          gap: 8px;
        }
      }
    `,
  ];
}

define("irrigation-scheduler-panel", IrrigationPanel);
