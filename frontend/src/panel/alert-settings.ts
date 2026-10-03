import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { ALERT_LEVELS, ALERT_TYPES, alertConfig, type AlertLevel, type AlertType } from "../alerts";
import type { AlertConfig, AlertPriority, Hass, Settings } from "../api";
import { t, type Key } from "../i18n";
import { fireEvent, svgIcon } from "../shared/controls";
import { define } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { PHONE_ICON, speakerIcon, speakerName, targetName } from "./notify-targets";

const LEVEL_KEYS: Record<AlertLevel, Key> = {
  valve: "level_valve",
  zone: "level_zone",
  installation: "level_installation",
};

const PRIORITY_KEYS: Record<AlertPriority, Key> = {
  critical: "priority_critical",
  high: "priority_high",
  normal: "priority_normal",
};

/** Tarjeta «Errores y avisos» de Ajustes: push, voz, móviles, altavoces, prioridad e histórico por tipo. */
export class AlertSettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    settings: { attribute: false },
    errors: { attribute: false },
    _open: { state: true },
  };

  declare hass: Hass;
  declare settings: Settings;
  declare errors: Record<string, string>;
  // tipo desplegado con ›
  declare _open: string | null;

  constructor() {
    super();
    this.errors = {};
    this._open = null;
  }

  private change(id: string, patch: Partial<AlertConfig>): void {
    const next = { ...alertConfig(this.settings, id), ...patch };
    fireEvent(this, "alerts-changed", { ...this.settings.alerts, [id]: next });
  }

  private toggleAll(id: string, config: AlertConfig): void {
    // al apagar «Todos» se parte de todos marcados, para quitar uno a uno
    this.change(id, { targets: config.targets === null ? [...this.settings.notify_targets] : null });
  }

  private toggleTarget(id: string, targets: string[], target: string): void {
    this.change(id, {
      targets: targets.includes(target) ? targets.filter((item) => item !== target) : [...targets, target],
    });
  }

  private toggleAllVoice(id: string, config: AlertConfig): void {
    // al apagar «Todos» se parte de todos marcados, para quitar uno a uno
    this.change(id, { voice_targets: config.voice_targets === null ? [...this.settings.speaker_targets] : null });
  }

  private toggleSpeaker(id: string, speakers: string[], speaker: string): void {
    this.change(id, {
      voice_targets: speakers.includes(speaker) ? speakers.filter((item) => item !== speaker) : [...speakers, speaker],
    });
  }

  private error(path: string): TemplateResult | typeof nothing {
    const message = this.errors[path];
    return message ? html`<div class="error-text">${message}</div>` : nothing;
  }

  protected render() {
    const hass = this.hass;
    if (!hass || !this.settings) return nothing;
    const noTargets = this.settings.notify_targets.length === 0;
    // la voz necesita altavoces elegidos y motor TTS
    const noVoice = this.settings.speaker_targets.length === 0 || !this.settings.tts_entity;
    return html`<div class="card section">
      <div class="label">${t(hass, "alerts")}</div>
      <div class="muted small help">${t(hass, "alerts_help")}</div>
      ${noTargets ? html`<div class="banner warning">${t(hass, "alerts_no_targets")}</div>` : nothing}
      ${noVoice ? html`<div class="banner info">${t(hass, "alerts_no_voice")}</div>` : nothing}
      ${ALERT_LEVELS.map(
        (level) => html`<div class="row head">
            <span class="name">${t(hass, LEVEL_KEYS[level])}</span>
            <span class="cell">${t(hass, "alert_push")}</span>
            <span class="cell">${t(hass, "alert_voice")}</span>
            <span class="cell">${t(hass, "alert_priority")}</span>
            <span class="cell">${t(hass, "alert_history")}</span>
            <span class="expand"></span>
          </div>
          ${ALERT_TYPES.filter((type) => type.level === level).map((type) => this.renderRow(type, noTargets, noVoice))}`,
      )}
    </div>`;
  }

  private renderRow(type: AlertType, noTargets: boolean, noVoice: boolean): TemplateResult {
    const hass = this.hass;
    const config = alertConfig(this.settings, type.id);
    const pushOff = !config.push || noTargets;
    const voiceOff = !config.voice || noVoice;
    const open = this._open === type.id;
    return html`<div class="row">
        <span class="name">${t(hass, type.name)}</span>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${config.push && !noTargets}
            ?disabled=${noTargets}
            @change=${(ev: Event) => this.change(type.id, { push: (ev.target as HTMLInputElement).checked })}
          />
          <span class="inline-label">${t(hass, "alert_push")}</span>
        </label>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${config.voice && !noVoice}
            ?disabled=${noVoice}
            @change=${(ev: Event) => this.change(type.id, { voice: (ev.target as HTMLInputElement).checked })}
          />
          <span class="inline-label">${t(hass, "alert_voice")}</span>
        </label>
        <select
          class="cell"
          aria-label=${t(hass, "alert_priority")}
          ?disabled=${pushOff}
          @change=${(ev: Event) =>
            this.change(type.id, { priority: (ev.target as HTMLSelectElement).value as AlertPriority })}
        >
          ${type.allowed.map(
            (priority) =>
              html`<option .value=${priority} ?selected=${(config.priority ?? type.priority) === priority}>
                ${t(hass, PRIORITY_KEYS[priority])}
              </option>`,
          )}
        </select>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${config.show_in_history && !type.pushOnly}
            ?disabled=${type.pushOnly}
            @change=${(ev: Event) =>
              this.change(type.id, { show_in_history: (ev.target as HTMLInputElement).checked })}
          />
          <span class="inline-label">${t(hass, "alert_history")}</span>
        </label>
        <button
          class="expand ${open ? "open" : ""}"
          aria-label=${t(hass, "alert_details")}
          aria-expanded=${open ? "true" : "false"}
          @click=${() => (this._open = open ? null : type.id)}
        >
          ›
        </button>
      </div>
      ${this.error(`alerts.${type.id}.priority`)} ${open ? this.renderDetail(type, config, pushOff, voiceOff, noVoice) : nothing}`;
  }

  private renderDetail(
    type: AlertType,
    config: AlertConfig,
    pushOff: boolean,
    voiceOff: boolean,
    noVoice: boolean,
  ): TemplateResult {
    const hass = this.hass;
    const all = config.targets === null;
    const selected = config.targets ?? [];
    const allVoice = config.voice_targets === null;
    const selectedVoice = config.voice_targets ?? [];
    return html`<div class="detail">
      <div class="muted small">${t(hass, type.help)}</div>
      <div class="sub-label">${t(hass, "alert_push_targets")}</div>
      <div class="chips">
        <button
          class="chip ${all ? "on" : ""}"
          ?disabled=${pushOff}
          aria-pressed=${all ? "true" : "false"}
          @click=${() => this.toggleAll(type.id, config)}
        >
          ${t(hass, "alert_all_targets")}
        </button>
        ${this.settings.notify_targets.map((target) => {
          const on = all || selected.includes(target);
          return html`<button
            class="chip with-icon ${on ? "on" : ""}"
            ?disabled=${pushOff || all}
            title=${target}
            aria-pressed=${on ? "true" : "false"}
            @click=${() => this.toggleTarget(type.id, selected, target)}
          >
            ${svgIcon(PHONE_ICON)}${targetName(target)}
          </button>`;
        })}
      </div>
      ${selected.map((_target, index) => this.error(`alerts.${type.id}.targets.${index}`))}
      <div class="sub-label">${t(hass, "alert_voice_targets")}</div>
      ${noVoice
        ? html`<div class="muted small">${t(hass, "alert_voice_unavailable")}</div>`
        : html`<div class="chips">
            <button
              class="chip ${allVoice ? "on" : ""}"
              ?disabled=${voiceOff}
              aria-pressed=${allVoice ? "true" : "false"}
              @click=${() => this.toggleAllVoice(type.id, config)}
            >
              ${t(hass, "alert_all_targets")}
            </button>
            ${this.settings.speaker_targets.map((speaker) => {
              const on = allVoice || selectedVoice.includes(speaker);
              const state = this.hass.states[speaker];
              return html`<button
                class="chip with-icon ${on ? "on" : ""}"
                ?disabled=${voiceOff || allVoice}
                title=${speaker}
                aria-pressed=${on ? "true" : "false"}
                @click=${() => this.toggleSpeaker(type.id, selectedVoice, speaker)}
              >
                ${svgIcon(speakerIcon(state))}${speakerName(speaker, state)}
              </button>`;
            })}
          </div>`}
      ${selectedVoice.map((_speaker, index) => this.error(`alerts.${type.id}.voice_targets.${index}`))}
    </div>`;
  }

  static styles = [
    sharedStyles,
    css`
      .help {
        margin-bottom: 12px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 64px 64px 112px 72px 32px;
        align-items: center;
        gap: 8px;
        min-height: 40px;
      }
      .row.head {
        margin-top: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .cell {
        justify-self: center;
      }
      select.cell {
        justify-self: stretch;
      }
      input[type="checkbox"] {
        accent-color: var(--primary-color);
      }
      .inline-label {
        display: none;
      }
      .expand {
        background: none;
        border: none;
        color: var(--secondary-text-color);
        font-size: 1.25rem;
        cursor: pointer;
        transition: transform 0.15s;
      }
      .expand.open {
        transform: rotate(90deg);
      }
      .detail {
        padding: 4px 0 12px;
      }
      .detail .chips {
        margin-top: 8px;
      }
      .sub-label {
        margin-top: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      /* estrecho: Push, Voz, Prioridad e Histórico bajan a una segunda línea bajo el nombre */
      @media (max-width: 600px) {
        .row {
          grid-template-columns: auto auto auto 1fr 32px;
          row-gap: 4px;
        }
        .row .name {
          grid-column: 1 / 5;
        }
        .row .expand {
          grid-column: 5;
          grid-row: 1;
        }
        .row.head .cell {
          display: none;
        }
        .inline-label {
          display: inline;
        }
      }
    `,
  ];
}

define("irrigation-alert-settings", AlertSettings);
