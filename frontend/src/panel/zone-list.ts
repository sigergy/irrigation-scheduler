import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import type { Hass, Snapshot, Zone } from "../api";
import { formatDuration, formatNextRun, t } from "../i18n";
import { TickController } from "../store";
import { controlButton, fireEvent } from "../shared/controls";
import { define } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { remainingSeconds } from "../shared/valve-status";
import { activeValve, batchSpan, zoneBadge, zoneButtons, zoneState, zoneSummary } from "../shared/zone-status";

/** Lista compacta de zonas (mockup 01). */
export class ZoneList extends LitElement {
  static properties = {
    hass: { attribute: false },
    snapshot: { attribute: false },
  };

  declare hass: Hass;
  declare snapshot: Snapshot;

  constructor() {
    super();
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
    return html`
      <div class="list-row ${state === "stopped" ? "stopped" : ""}" @click=${() => this.open(zone.zone_id)}>
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
    `;
  }

  private open(zoneId: string | null): void {
    fireEvent(this, "zone-open", { zoneId });
  }

  static styles = [
    sharedStyles,
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
      .empty {
        padding: 24px 16px;
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
