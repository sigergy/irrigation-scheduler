import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import type { Hass, Snapshot, Zone } from "../api";
import { formatDuration, formatNextRun, t } from "../i18n";
import { TickController } from "../store";
import { CHEVRON_DOWN, CHEVRON_UP, controlButton, fireEvent, svgIcon } from "../shared/controls";
import { define } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { remainingSeconds, valveRow, valveRowStyles } from "../shared/valve-status";
import { activeValve, batchSpan, zoneBadge, zoneButtons, zoneState, zoneSummary } from "../shared/zone-status";

/** Lista compacta de zonas (mockup 01). */
export class ZoneList extends LitElement {
  static properties = {
    hass: { attribute: false },
    snapshot: { attribute: false },
    _expanded: { state: true },
  };

  declare hass: Hass;
  declare snapshot: Snapshot;
  // se sustituye por un Set nuevo en cada cambio para que Lit lo detecte
  declare _expanded: Set<string>;

  constructor() {
    super();
    this._expanded = new Set();
    // repinta cada segundo el tiempo restante; el controlador se registra solo en el host
    new TickController(this);
  }

  protected render() {
    if (!this.hass || !this.snapshot) return nothing;
    const admin = this.hass.user?.is_admin ?? false;
    const zones = this.snapshot.zones;
    return html`
      <ha-card>
        ${zones.length
          ? zones.map((zone) => this.renderRow(zone))
          : html`<div class="empty muted">${t(this.hass, "empty_list")}</div>`}
      </ha-card>
      ${admin
        ? html`<button class="fab filled" @click=${() => this.open(null)}>${t(this.hass, "add_zone")}</button>`
        : nothing}
    `;
  }

  private renderRow(zone: Zone): TemplateResult {
    const hass = this.hass;
    const state = zoneState(zone, this.snapshot);
    const active = state === "running" ? activeValve(zone, this.snapshot) : undefined;
    const batch = state === "running" ? batchSpan(zone) : undefined;
    const expanded = this._expanded.has(zone.zone_id);
    return html`<div class="zone ${state === "stopped" ? "stopped" : ""}">
      <div class="list-row" @click=${() => this.open(zone.zone_id)}>
        <button
          class="icon expand"
          title=${t(hass, "valves")}
          aria-label=${t(hass, "valves")}
          aria-expanded=${expanded ? "true" : "false"}
          @click=${(ev: Event) => {
            // despliega las válvulas sin abrir el editor de la zona
            ev.stopPropagation();
            this.toggle(zone.zone_id);
          }}
        >
          ${svgIcon(expanded ? CHEVRON_UP : CHEVRON_DOWN)}
        </button>
        <div class="main">
          <div class="name">${zone.name}</div>
          <div class="muted small">${zoneSummary(hass, zone)}</div>
        </div>
        <div class="status">
          ${zoneBadge(hass, state)}
          ${batch
            ? html`<div class="small">${t(hass, "batch")} · ${formatDuration(remainingSeconds(batch))}</div>`
            : active
              ? html`<div class="small">${active.valve.name}</div>`
              : nothing}
        </div>
        <div class="next small muted">${formatNextRun(hass, zone.next_run)}</div>
        <div class="buttons">${zoneButtons(zone, state).map((spec) => controlButton(this, hass, spec))}</div>
        <span class="chevron muted">›</span>
      </div>
      ${expanded
        ? html`<div class="valves">
            ${zone.valves.map((valve) => valveRow(this, hass, this.snapshot, valve))}
          </div>`
        : nothing}
    </div>`;
  }

  private toggle(zoneId: string): void {
    const next = new Set(this._expanded);
    if (next.has(zoneId)) next.delete(zoneId);
    else next.add(zoneId);
    this._expanded = next;
  }

  private open(zoneId: string | null): void {
    fireEvent(this, "zone-open", { zoneId });
  }

  static styles = [
    sharedStyles,
    valveRowStyles,
    css`
      :host {
        display: block;
        padding-bottom: 80px;
      }
      .main {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-weight: 500;
      }
      .status {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        min-width: 120px;
      }
      .next {
        min-width: 90px;
        text-align: right;
      }
      .buttons {
        display: flex;
        gap: 4px;
        min-width: 84px;
        justify-content: flex-end;
      }
      .chevron {
        font-size: 1.4em;
      }
      .stopped {
        opacity: 0.6;
      }
      .zone + .zone {
        border-top: 1px solid var(--divider-color);
      }
      .zone .list-row {
        border-bottom: none;
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
      .valves {
        /* sangría = padding de la fila + botón de desplegar + hueco */
        padding: 0 16px 8px 68px;
      }
      .empty {
        padding: 24px 16px;
      }
      @media (max-width: 600px) {
        /* móvil: dos líneas; arriba nombre y estado, abajo próximo riego y botones */
        .list-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          grid-template-areas:
            "expand main status chevron"
            "expand next buttons chevron";
          column-gap: 8px;
          row-gap: 8px;
          padding: 12px;
        }
        .expand {
          grid-area: expand;
          align-self: center;
        }
        .main {
          grid-area: main;
        }
        .valves {
          padding: 0 12px 8px 12px;
        }
        .status {
          grid-area: status;
          min-width: 0;
        }
        .next {
          grid-area: next;
          min-width: 0;
          text-align: left;
          align-self: center;
        }
        .buttons {
          grid-area: buttons;
          min-width: 0;
        }
        .chevron {
          grid-area: chevron;
          align-self: center;
        }
      }
      .fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        min-height: 48px;
        padding: 0 20px;
        border-radius: 24px;
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.3));
      }
    `,
  ];
}

define("irrigation-zone-list", ZoneList);
