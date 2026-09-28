import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { listSnapshot, type Hass, type Snapshot, type Valve, type Zone } from "../api";
import { formatDuration, formatNextRun, t } from "../i18n";
import { SnapshotController, TickController } from "../store";
import { controlButton } from "../shared/controls";
import { define } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import {
  progressBar,
  remainingSeconds,
  STATE_ICONS,
  valveButtons,
  valveLive,
  valveStatusText,
} from "../shared/valve-status";
import { activeValve, ZONE_ICONS, zoneButtons, zoneState, type ZoneState } from "../shared/zone-status";

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
  };

  declare hass: Hass | undefined;
  declare _config: CardConfig | undefined;
  // se sustituye por un Set nuevo en cada cambio para que Lit lo detecte
  declare _expanded: Set<string>;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
    this._expanded = new Set();
    new TickController(this);
  }

  setConfig(config: CardConfig): void {
    const zones: unknown = config?.zones;
    if (!Array.isArray(zones) || !zones.length || zones.some((zone) => typeof zone !== "string")) {
      throw new Error(t(undefined, "card_no_zones"));
    }
    this._config = { ...config, zones: [...(zones as string[])] };
  }

  getCardSize(): number {
    return 1 + (this._config?.zones.length ?? 1);
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

  protected render() {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const { snapshot, error } = this.store.state;
    let body: unknown;
    if (error === "not_loaded") body = html`<div class="muted">${t(hass, "not_loaded")}</div>`;
    else if (error) body = html`<div class="muted">${t(hass, "load_error")}</div>`;
    else if (!snapshot) body = html`<div class="muted">${t(hass, "loading")}</div>`;
    else body = config.zones.map((zoneId) => this.renderZone(hass, snapshot, zoneId));
    return html`<ha-card .header=${config.title}>
      <div class="card-content">
        ${snapshot && !hass.connected ? html`<div class="banner error">${t(hass, "disconnected")}</div>` : nothing}
        ${body}
      </div>
    </ha-card>`;
  }

  private renderZone(hass: Hass, snapshot: Snapshot, zoneId: string): TemplateResult {
    const zone = snapshot.zones.find((item) => item.zone_id === zoneId);
    if (!zone) return html`<div class="zone-row muted">⚠ ${t(hass, "zone_not_found")}</div>`;
    const state = zoneState(zone, snapshot);
    const expanded = this._expanded.has(zoneId);
    const active = state === "running" ? activeValve(zone, snapshot) : undefined;
    return html`<div class="zone ${state === "stopped" ? "stopped" : ""}">
      <div class="zone-row" @click=${() => this.toggle(zoneId)}>
        <span class="icon">${ZONE_ICONS[state]}</span>
        <div class="main">
          <div class="name">${zone.name}</div>
          <div class="small muted">${this.zoneLine(hass, zone, state, active)}</div>
          ${active?.open ? progressBar(active.open) : nothing}
        </div>
        <div class="buttons">${zoneButtons(zone, state).map((spec) => controlButton(this, hass, spec))}</div>
        <button
          class="icon"
          aria-expanded=${expanded ? "true" : "false"}
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this.toggle(zoneId);
          }}
        >
          ${expanded ? "▴" : "▾"}
        </button>
      </div>
      ${expanded
        ? html`<div class="valves">${zone.valves.map((valve) => this.renderValve(hass, snapshot, valve))}</div>`
        : nothing}
    </div>`;
  }

  /** «Aspersores norte · quedan 6:12», «En cola», «Programada · sáb 09:30»… */
  private zoneLine(hass: Hass, zone: Zone, state: ZoneState, active: ReturnType<typeof activeValve>): string {
    switch (state) {
      case "running":
        if (active?.open) {
          const time = formatDuration(remainingSeconds(active.open));
          return `${active.valve.name} · ${t(hass, "remaining", { time })}`;
        }
        if (active) return `${active.valve.name} · ${t(hass, "status_manual")}`;
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
      }
      .valves {
        padding: 0 0 8px 32px;
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
