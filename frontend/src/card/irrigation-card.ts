import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { listSnapshot, type Hass, type Snapshot, type Valve, type Zone } from "../api";
import { formatDuration, formatNextRun, t } from "../i18n";
import { SnapshotController, TickController } from "../store";
import { controlButton, svgIcon } from "../shared/controls";
import { define, loadHaComponents } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import {
  progressBar,
  remainingSeconds,
  STATE_ICONS,
  valveButtons,
  valveLive,
  valveStatusText,
} from "../shared/valve-status";
import { activeValve, batchSpan, ZONE_ICONS, zoneButtons, zoneState, type ZoneState } from "../shared/zone-status";
import type { ZoneEditor } from "../panel/zone-editor";
import "../panel/zone-editor";

// mdi:chevron-down y mdi:chevron-up
const CHEVRON_DOWN = "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z";
const CHEVRON_UP = "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z";
// mdi:cog-outline
const COG_ICON =
  "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z";

export const CARD_TYPE = "irrigation-scheduler-card";
const STUB_TIMEOUT_MS = 3000;

export interface CardConfig {
  type: string;
  zones: string[];
  title?: string;
}

declare global {
  interface Window {
    customCards?: { type: string; name: string; description: string; preview?: boolean }[];
  }
}

/** Tarjeta con zonas plegables (mockup 04). */
export class IrrigationCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _expanded: { state: true },
    _editing: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: CardConfig | undefined;
  // se sustituye por un Set nuevo en cada cambio para que Lit lo detecte
  declare _expanded: Set<string>;
  // zona abierta en el diálogo de edición: undefined = cerrado; null = zona nueva
  declare _editing: string | null | undefined;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
    this._expanded = new Set();
    this._editing = undefined;
    new TickController(this);
  }

  setConfig(config: CardConfig): void {
    // sin zonas elegidas (o sin la clave) se muestran todas
    const zones: unknown = config?.zones ?? [];
    if (!Array.isArray(zones) || zones.some((zone) => typeof zone !== "string")) {
      throw new Error(t(undefined, "card_bad_zones"));
    }
    this._config = { ...config, zones: [...(zones as string[])] };
  }

  getCardSize(): number {
    return 1 + (this._config?.zones.length || this.store.state.snapshot?.zones.length || 1);
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(`${CARD_TYPE}-editor`);
  }

  static async getStubConfig(hass: Hass): Promise<CardConfig> {
    let zones: string[] = [];
    try {
      // el selector de tarjetas espera a esta promesa: sin límite, un WS que no responde deja el spinner fijo
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("timeout")), STUB_TIMEOUT_MS),
      );
      const snapshot = await Promise.race([listSnapshot(hass), timeout]);
      zones = snapshot.zones.slice(0, 3).map((zone) => zone.zone_id);
    } catch {
      // sin integración cargada: la tarjeta sale sin zonas y el editor pide elegirlas
    }
    return { type: `custom:${CARD_TYPE}`, zones };
  }

  private toggle(zoneId: string): void {
    const next = new Set(this._expanded);
    if (next.has(zoneId)) next.delete(zoneId);
    else next.add(zoneId);
    this._expanded = next;
  }

  private async openEditor(zoneId: string | null): Promise<void> {
    // el editor usa ha-selector, que HA carga de forma perezosa
    await loadHaComponents();
    this._editing = zoneId;
  }

  protected updated(): void {
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog.editor");
    if (dialog && !dialog.open) dialog.showModal();
  }

  private renderEditor(hass: Hass, snapshot: Snapshot): TemplateResult {
    // mismo editor que el panel, dentro de un diálogo modal a pantalla completa en móvil
    return html`<dialog
      class="editor"
      @cancel=${(ev: Event) => {
        // Esc pasa por el ← del editor: pide confirmación si hay cambios sin guardar
        ev.preventDefault();
        void this.renderRoot.querySelector<ZoneEditor>("irrigation-zone-editor")?.back();
      }}
    >
      <irrigation-zone-editor
        .hass=${hass}
        .snapshot=${snapshot}
        .zoneId=${this._editing}
        @zone-close=${(ev: Event) => {
          ev.stopPropagation();
          this._editing = undefined;
        }}
        @zone-saved=${(ev: CustomEvent<{ zoneId: string }>) => {
          ev.stopPropagation();
          this._editing = ev.detail.zoneId;
        }}
      ></irrigation-zone-editor>
    </dialog>`;
  }

  protected render() {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const { snapshot, error } = this.store.state;
    // configurar zonas exige admin, igual que el panel
    const admin = hass.user?.is_admin ?? false;
    let body: unknown;
    if (error === "not_loaded") body = html`<div class="muted">${t(hass, "not_loaded")}</div>`;
    else if (error) body = html`<div class="muted">${t(hass, "load_error")}</div>`;
    else if (!snapshot) body = html`<div class="muted">${t(hass, "loading")}</div>`;
    else {
      const zoneIds = config.zones.length ? config.zones : snapshot.zones.map((zone) => zone.zone_id);
      body = zoneIds.length
        ? zoneIds.map((zoneId) => this.renderZone(hass, snapshot, zoneId))
        : html`<div class="muted">${t(hass, "empty_list")}</div>`;
    }
    return html`<ha-card .header=${config.title}>
      <div class="card-content">
        ${snapshot && !hass.connected ? html`<div class="banner error">${t(hass, "disconnected")}</div>` : nothing}
        ${body}
        ${snapshot && admin
          ? html`<div class="footer">
              <button ?disabled=${!hass.connected} @click=${() => this.openEditor(null)}>${t(hass, "add_zone")}</button>
            </div>`
          : nothing}
      </div>
      ${snapshot && this._editing !== undefined ? this.renderEditor(hass, snapshot) : nothing}
    </ha-card>`;
  }

  private renderZone(hass: Hass, snapshot: Snapshot, zoneId: string): TemplateResult {
    const zone = snapshot.zones.find((item) => item.zone_id === zoneId);
    if (!zone) return html`<div class="zone-row muted">⚠ ${t(hass, "zone_not_found")}</div>`;
    const state = zoneState(zone, snapshot);
    const expanded = this._expanded.has(zoneId);
    const active = state === "running" ? activeValve(zone, snapshot) : undefined;
    const batch = state === "running" ? batchSpan(zone) : undefined;
    return html`<div class="zone ${state === "stopped" ? "stopped" : ""}">
      <div class="zone-row" @click=${() => this.toggle(zoneId)}>
        <button
          class="icon expand"
          aria-expanded=${expanded ? "true" : "false"}
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this.toggle(zoneId);
          }}
        >
          ${svgIcon(expanded ? CHEVRON_UP : CHEVRON_DOWN)}
        </button>
        <span class="icon">${ZONE_ICONS[state]}</span>
        <div class="main">
          <div class="name">${zone.name}</div>
          <div class="small muted">${this.zoneLine(hass, zone, state, active, batch)}</div>
          ${batch ? progressBar(batch) : nothing}
        </div>
        <div class="buttons">
          ${zoneButtons(zone, state).map((spec) => controlButton(this, hass, spec))}
          ${hass.user?.is_admin
            ? html`<button
                class="icon configure"
                title=${t(hass, "configure_zone")}
                aria-label=${t(hass, "configure_zone")}
                @click=${(ev: Event) => {
                  ev.stopPropagation();
                  void this.openEditor(zone.zone_id);
                }}
              >
                ${svgIcon(COG_ICON)}
              </button>`
            : nothing}
        </div>
      </div>
      ${expanded
        ? html`<div class="valves">${zone.valves.map((valve) => this.renderValve(hass, snapshot, valve))}</div>`
        : nothing}
    </div>`;
  }

  /** «Lote · quedan 12:30», «En cola», «Programada · sáb 09:30»… */
  private zoneLine(
    hass: Hass,
    zone: Zone,
    state: ZoneState,
    active: ReturnType<typeof activeValve>,
    batch: ReturnType<typeof batchSpan>,
  ): string {
    switch (state) {
      case "running":
        if (batch) {
          const time = formatDuration(remainingSeconds(batch));
          return `${t(hass, "batch")} · ${t(hass, "remaining", { time })}`;
        }
        if (active && !active.open) return `${active.valve.name} · ${t(hass, "status_manual")}`;
        return t(hass, "status_running");
      case "queued":
        return t(hass, "status_queued");
      case "idle":
        return `${t(hass, "status_idle")} · ${formatNextRun(hass, zone.next_run)}`;
      case "stopped":
        return t(hass, "status_stopped");
    }
  }

  private renderValve(hass: Hass, snapshot: Snapshot, valve: Valve): TemplateResult {
    const live = valveLive(valve, snapshot);
    let right = "";
    if (live.open) right = formatDuration(remainingSeconds(live.open));
    else if (live.state !== "idle") right = valveStatusText(hass, live).toLocaleLowerCase();
    return html`<div class="valve">
      <span class="icon">${STATE_ICONS[live.state]}</span>
      <div class="main">
        <div>${valve.name} · ${t(hass, "minutes_short", { n: valve.duration_min })}</div>
        ${live.open ? progressBar(live.open) : nothing}
      </div>
      <span class="small muted">${right}</span>
      <div class="buttons">${valveButtons(valve, live).map((spec) => controlButton(this, hass, spec))}</div>
    </div>`;
  }

  static styles = [
    sharedStyles,
    css`
      .card-content {
        padding: 0 16px 8px;
      }
      ha-card:not([header]) .card-content {
        padding-top: 8px;
      }
      .zone-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        cursor: pointer;
      }
      .zone + .zone {
        border-top: 1px solid var(--divider-color);
      }
      .stopped {
        opacity: 0.6;
      }
      .icon {
        width: 24px;
        text-align: center;
      }
      .main {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-weight: 500;
      }
      .buttons {
        display: flex;
        gap: 4px;
        /* en tarjetas estrechas encoge el texto, no los botones */
        flex: none;
      }
      .valve > .small {
        white-space: nowrap;
      }
      button.expand {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
        padding: 0;
        color: var(--secondary-text-color);
      }
      button.expand .svg-icon {
        width: 28px;
        height: 28px;
      }
      button.configure {
        display: flex;
        align-items: center;
        color: var(--secondary-text-color);
      }
      .footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 8px;
        border-top: 1px solid var(--divider-color);
      }
      dialog.editor {
        padding: 0;
        border: none;
        width: min(1200px, calc(100vw - 32px));
        max-width: none;
        height: calc(100vh - 64px);
        max-height: none;
        border-radius: var(--ha-dialog-border-radius, 24px);
        background: var(--primary-background-color);
        overflow: auto;
      }
      dialog.editor::backdrop {
        background: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.32));
      }
      dialog.editor irrigation-zone-editor {
        /* el editor ocupa 100vh en el panel; aquí se ajusta al diálogo */
        min-height: 100%;
      }
      @media (max-width: 600px) {
        dialog.editor {
          width: 100vw;
          height: 100vh;
          border-radius: 0;
        }
      }
      .valves {
        /* sangría = botón de desplegar + hueco: el icono de la válvula cae bajo el de la zona */
        padding: 0 0 8px 48px;
      }
      .valve {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
    `,
  ];
}

define(CARD_TYPE, IrrigationCard);

window.customCards ??= [];
if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "Irrigation Scheduler",
    description: t(undefined, "card_description"),
    preview: true,
  });
}
