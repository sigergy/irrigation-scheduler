import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";

import { ALERT_TYPES, alertConfig } from "../alerts";
import { saveSettings, testSpeak, type AlertConfig, type Hass, type Settings, type Snapshot } from "../api";
import { issueMap, t } from "../i18n";
import { errorMessage, fireEvent, showToast, svgIcon } from "../shared/controls";
import { define, selectorValue } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import "./alert-settings";
import {
  NOTIFY_PREFIX,
  PHONE_ICON,
  PLAY_ICON,
  speakerEntities,
  speakerIcon,
  speakerName,
  speakerOffline,
  targetName,
  ttsEntities,
} from "./notify-targets";

const MM_PER_INCH = 25.4;
// WeatherEntityFeature.FORECAST_HOURLY (ha/components/weather/const.py:32)
const FORECAST_HOURLY = 2;

/** Unidad de lluvia del sistema de HA (05-rain-skip.md §8.12). Se guarda siempre en mm. */
function rainUnit(hass: Hass): "mm" | "in" {
  return hass.config.unit_system?.accumulated_precipitation === "in" ? "in" : "mm";
}

/** mm guardados → valor en la unidad del sistema. */
function fromMm(mm: number, unit: "mm" | "in"): number {
  return unit === "in" ? Math.round((mm / MM_PER_INCH) * 100) / 100 : mm;
}

/** Valor en la unidad del sistema → mm para guardar. */
function toMm(value: number, unit: "mm" | "in"): number {
  return unit === "in" ? value * MM_PER_INCH : value;
}

/** La weather elegida no anuncia pronóstico horario (05-rain-skip.md §8.4). */
function lacksHourly(hass: Hass, entityId: string | null): boolean {
  const state = entityId ? hass.states[entityId] : undefined;
  return state !== undefined && (Number(state.attributes.supported_features ?? 0) & FORECAST_HOURLY) === 0;
}

function copySettings(settings: Settings): Settings {
  return {
    ...settings,
    notify_targets: [...settings.notify_targets],
    speaker_targets: [...settings.speaker_targets],
    alerts: { ...settings.alerts },
  };
}

/** Huella con orden fijo de claves para detectar cambios sin guardar. */
function settingsKey(settings: Settings): string {
  return JSON.stringify([
    settings.global_max_valves,
    settings.notify_targets,
    settings.speaker_targets,
    settings.tts_entity,
    settings.tts_volume,
    settings.rain_sensor,
    settings.rain_past_hours,
    settings.rain_past_threshold_mm,
    settings.weather_entity,
    settings.rain_forecast_hours,
    settings.rain_forecast_threshold_mm,
    // valores efectivos: guardar un tipo con sus valores por defecto no cuenta como cambio
    ALERT_TYPES.map((type) => {
      const config = alertConfig(settings, type.id);
      return [config.push, config.targets, config.priority, config.show_in_history, config.voice, config.voice_targets];
    }),
  ]);
}

/** Pestaña «Ajustes»: copia de trabajo y un Guardar en la barra del panel (mockup 03). */
export class SettingsView extends LitElement {
  static properties = {
    hass: { attribute: false },
    snapshot: { attribute: false },
    _draft: { state: true },
    _errors: { state: true },
  };

  declare hass: Hass;
  declare snapshot: Snapshot;
  declare _draft: Settings | undefined;
  declare _errors: Record<string, string>;

  private baseline = "";
  private saving = false;
  // último máximo global, para recuperarlo al volver a activar el límite
  private lastMax = 1;

  constructor() {
    super();
    this._draft = undefined;
    this._errors = {};
  }

  get dirty(): boolean {
    return this._draft !== undefined && settingsKey(this._draft) !== this.baseline;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (!this.snapshot) return;
    // los cambios sin guardar no se pisan con el snapshot
    if (!this._draft || (changed.has("snapshot") && !this.dirty && !this.saving)) this.reset(this.snapshot.settings);
  }

  private reset(settings: Settings): void {
    this._draft = copySettings(settings);
    this.baseline = settingsKey(settings);
    if (settings.global_max_valves !== null) this.lastMax = settings.global_max_valves;
  }

  private patch(patch: Partial<Settings>): void {
    if (!this._draft) return;
    this._draft = { ...this._draft, ...patch };
    const keys = Object.keys(patch);
    this._errors = Object.fromEntries(
      Object.entries(this._errors).filter(([path]) => !keys.some((key) => path === key || path.startsWith(`${key}.`))),
    );
    fireEvent(this, "settings-dirty", this.dirty);
  }

  async save(): Promise<void> {
    if (!this._draft || this.saving) return;
    this.saving = true;
    try {
      const result = await saveSettings(this.hass, this._draft);
      if (result.errors.length || !result.settings) {
        this._errors = issueMap(this.hass, result.errors);
        showToast(this, t(this.hass, "settings_not_saved"));
        return;
      }
      this._errors = {};
      this.reset(result.settings);
      showToast(this, t(this.hass, "settings_saved"));
      fireEvent(this, "settings-dirty", false);
    } catch (err) {
      showToast(this, errorMessage(this.hass, err));
    } finally {
      this.saving = false;
    }
  }

  private toggleLimit(on: boolean): void {
    const current = this._draft?.global_max_valves;
    if (typeof current === "number") this.lastMax = current;
    this.patch({ global_max_valves: on ? Math.max(1, this.lastMax) : null });
  }

  private toggleTarget(target: string): void {
    if (!this._draft) return;
    const targets = this._draft.notify_targets;
    this.patch({
      notify_targets: targets.includes(target) ? targets.filter((item) => item !== target) : [...targets, target],
    });
  }

  private toggleSpeaker(speaker: string): void {
    if (!this._draft) return;
    const speakers = this._draft.speaker_targets;
    this.patch({
      speaker_targets: speakers.includes(speaker) ? speakers.filter((item) => item !== speaker) : [...speakers, speaker],
    });
  }

  private async test(speaker: string): Promise<void> {
    const draft = this._draft;
    if (!draft?.tts_entity) return;
    try {
      await testSpeak(this.hass, speaker, draft.tts_entity, draft.tts_volume);
      showToast(this, t(this.hass, "voice_tested", { name: speakerName(speaker, this.hass.states[speaker]) }));
    } catch (err) {
      showToast(this, errorMessage(this.hass, err));
    }
  }

  private error(path: string): TemplateResult | typeof nothing {
    const message = this._errors[path];
    return message ? html`<div class="error-text">${message}</div>` : nothing;
  }

  protected render() {
    const draft = this._draft;
    if (!this.hass || !draft) return nothing;
    return html`${this.renderConcurrency(draft)} ${this.renderNotifications(draft)}
    <irrigation-alert-settings
      .hass=${this.hass}
      .settings=${draft}
      .errors=${this._errors}
      @alerts-changed=${(ev: CustomEvent<Record<string, AlertConfig>>) => this.patch({ alerts: ev.detail })}
    ></irrigation-alert-settings>
    ${this.renderRain(draft)}`;
  }

  private renderConcurrency(draft: Settings): TemplateResult {
    const hass = this.hass;
    const limited = draft.global_max_valves !== null;
    return html`<div class="card section">
      <div class="label">${t(hass, "concurrency")}</div>
      <ha-selector
        .hass=${hass}
        .selector=${{ boolean: {} }}
        .label=${t(hass, "limit_global")}
        .value=${limited}
        @value-changed=${(ev: Event) => this.toggleLimit(selectorValue<boolean>(ev) ?? false)}
      ></ha-selector>
      ${limited
        ? html`<ha-selector
            class="narrow-field"
            .hass=${hass}
            .selector=${{ number: { min: 1, max: 50, mode: "box" } }}
            .label=${t(hass, "global_max")}
            .value=${draft.global_max_valves}
            @value-changed=${(ev: Event) => {
              const value = Math.trunc(selectorValue<number>(ev) ?? 0);
              this.lastMax = value;
              this.patch({ global_max_valves: value });
            }}
          ></ha-selector>`
        : nothing}
      ${this.error("global_max_valves")}
      <div class="muted small">${t(hass, "global_off_help")}</div>
    </div>`;
  }

  private renderNotifications(draft: Settings): TemplateResult {
    const hass = this.hass;
    // todos los móviles como chips que se activan y desactivan, igual que los días de la zona;
    // se añaden los destinos guardados cuyo servicio ya no existe, para poder quitarlos
    const services = Object.keys(hass.services.notify ?? {})
      .map((service) => `notify.${service}`)
      .filter((target) => target.startsWith(NOTIFY_PREFIX));
    const targets = [...new Set([...services, ...draft.notify_targets])].sort();
    return html`<div class="card section">
      <div class="label">${t(hass, "notifications")}</div>
      <div class="muted small help">${t(hass, "notifications_help")}</div>
      <div class="subtitle first">${t(hass, "voice_phones")}</div>
      <div class="chips">
        ${targets.map(
          (target) =>
            html`<button
              class="chip with-icon ${draft.notify_targets.includes(target) ? "on" : ""}"
              title=${target}
              aria-pressed=${draft.notify_targets.includes(target) ? "true" : "false"}
              @click=${() => this.toggleTarget(target)}
            >
              ${svgIcon(PHONE_ICON)}${targetName(target)}
            </button>`,
        )}
      </div>
      ${draft.notify_targets.map((_target, index) => this.error(`notify_targets.${index}`))}
      ${targets.length ? nothing : html`<div class="muted small">${t(hass, "no_targets")}</div>`}
      ${this.renderSpeakers(draft)}
    </div>`;
  }

  private renderSpeakers(draft: Settings): TemplateResult {
    const hass = this.hass;
    const speakers = speakerEntities(hass).map((state) => state.entity_id);
    const engines = ttsEntities(hass).map((state) => state.entity_id);
    // se añaden los altavoces guardados que ya no existen, para poder quitarlos
    const all = [...new Set([...speakers, ...draft.speaker_targets])].sort();
    const noTts = engines.length === 0;
    const volumeSet = draft.tts_volume !== null;
    return html`<div class="subtitle">${t(hass, "voice_group")}</div>
      <div class="muted small help">${t(hass, "voice_group_help")}</div>
      <div class="chips">
        ${all.map((speaker) => {
          const state = hass.states[speaker];
          const on = draft.speaker_targets.includes(speaker);
          return html`<button
            class="chip with-icon ${on ? "on" : ""} ${speakerOffline(state) ? "offline" : ""}"
            title=${speaker}
            ?disabled=${noTts && !on}
            aria-pressed=${on ? "true" : "false"}
            @click=${() => this.toggleSpeaker(speaker)}
          >
            ${svgIcon(speakerIcon(state))}${speakerName(speaker, state)}
          </button>`;
        })}
      </div>
      ${draft.speaker_targets.map((_speaker, index) => this.error(`speaker_targets.${index}`))}
      ${all.length ? nothing : html`<div class="muted small">${t(hass, "voice_no_speakers")}</div>`}
      ${noTts ? html`<div class="banner warning">${t(hass, "voice_no_tts")}</div>` : nothing}
      ${!noTts && all.length
        ? html`<div class="voice-box">
            <ha-selector
              .hass=${hass}
              .selector=${{ entity: { include_entities: engines } }}
              .label=${t(hass, "voice_engine")}
              .required=${false}
              .value=${draft.tts_entity ?? undefined}
              @value-changed=${(ev: Event) => this.patch({ tts_entity: selectorValue<string>(ev) || null })}
            ></ha-selector>
            ${this.error("tts_entity")}
            <ha-selector
              .hass=${hass}
              .selector=${{ boolean: {} }}
              .label=${t(hass, "voice_volume_set")}
              .value=${volumeSet}
              @value-changed=${(ev: Event) =>
                this.patch({ tts_volume: (selectorValue<boolean>(ev) ?? false) ? (draft.tts_volume ?? 0.5) : null })}
            ></ha-selector>
            ${volumeSet
              ? html`<ha-selector
                  .hass=${hass}
                  .selector=${{ number: { min: 0, max: 100, step: 5, mode: "slider", unit_of_measurement: "%" } }}
                  .label=${t(hass, "voice_volume")}
                  .value=${Math.round((draft.tts_volume ?? 0) * 100)}
                  @value-changed=${(ev: Event) => this.patch({ tts_volume: (selectorValue<number>(ev) ?? 0) / 100 })}
                ></ha-selector>`
              : html`<div class="muted small">${t(hass, "voice_volume_help")}</div>`}
            ${this.error("tts_volume")}
            ${draft.tts_entity
              ? html`<div class="chips test-row">
                  ${draft.speaker_targets.map(
                    (speaker) =>
                      html`<button
                        class="chip with-icon"
                        title=${t(hass, "voice_test_title", { name: speakerName(speaker, hass.states[speaker]) })}
                        @click=${() => this.test(speaker)}
                      >
                        ${svgIcon(PLAY_ICON)}${t(hass, "voice_test")} · ${speakerName(speaker, hass.states[speaker])}
                      </button>`,
                  )}
                </div>`
              : nothing}
          </div>`
        : nothing}`;
  }

  private renderRain(draft: Settings): TemplateResult {
    const hass = this.hass;
    const unit = rainUnit(hass);
    const step = unit === "in" ? 0.01 : 0.1;
    const pastOk = !this._errors.rain_past_hours && !this._errors.rain_past_threshold_mm;
    const forecastOk = !this._errors.rain_forecast_hours && !this._errors.rain_forecast_threshold_mm;
    return html`<div class="card section">
      <div class="label">${t(hass, "rain")}</div>
      <div class="muted small help">${t(hass, "rain_help")}</div>

      <div class="subtitle">${t(hass, "rain_past")}</div>
      <ha-selector
        .hass=${hass}
        .selector=${{ entity: { domain: "sensor" } }}
        .label=${t(hass, "rain_sensor")}
        .required=${false}
        .value=${draft.rain_sensor ?? undefined}
        @value-changed=${(ev: Event) => this.patch({ rain_sensor: selectorValue<string>(ev) || null })}
      ></ha-selector>
      ${this.error("rain_sensor")}
      <div class="pair">
        <div>
          <ha-selector
            .hass=${hass}
            .selector=${{ number: { min: 1, max: 24, mode: "box" } }}
            .label=${t(hass, "rain_past_hours")}
            .value=${draft.rain_past_hours}
            @value-changed=${(ev: Event) =>
              this.patch({ rain_past_hours: Math.trunc(selectorValue<number>(ev) ?? 0) })}
          ></ha-selector>
          ${this.error("rain_past_hours")}
        </div>
        <div>
          <ha-selector
            .hass=${hass}
            .selector=${{ number: { min: 0, step, mode: "box", unit_of_measurement: unit } }}
            .label=${t(hass, "rain_past_threshold")}
            .value=${fromMm(draft.rain_past_threshold_mm, unit)}
            @value-changed=${(ev: Event) =>
              this.patch({ rain_past_threshold_mm: toMm(selectorValue<number>(ev) ?? 0, unit) })}
          ></ha-selector>
          ${this.error("rain_past_threshold_mm")}
        </div>
      </div>
      ${pastOk
        ? html`<div class="muted small rule">
            ${t(hass, "rain_past_rule", {
              amount: fromMm(draft.rain_past_threshold_mm, unit),
              unit,
              hours: draft.rain_past_hours,
            })}
          </div>`
        : nothing}

      <div class="subtitle">${t(hass, "rain_forecast")}</div>
      <ha-selector
        .hass=${hass}
        .selector=${{ entity: { domain: "weather" } }}
        .label=${t(hass, "weather_entity")}
        .required=${false}
        .value=${draft.weather_entity ?? undefined}
        @value-changed=${(ev: Event) => this.patch({ weather_entity: selectorValue<string>(ev) || null })}
      ></ha-selector>
      ${this.error("weather_entity")}
      ${lacksHourly(hass, draft.weather_entity)
        ? html`<div class="error-text">${t(hass, "weather_no_hourly")}</div>`
        : nothing}
      <div class="pair">
        <div>
          <ha-selector
            .hass=${hass}
            .selector=${{ number: { min: 6, max: 24, mode: "box" } }}
            .label=${t(hass, "rain_forecast_hours")}
            .value=${draft.rain_forecast_hours}
            @value-changed=${(ev: Event) =>
              this.patch({ rain_forecast_hours: Math.trunc(selectorValue<number>(ev) ?? 0) })}
          ></ha-selector>
          ${this.error("rain_forecast_hours")}
        </div>
        <div>
          <ha-selector
            .hass=${hass}
            .selector=${{ number: { min: 0, step, mode: "box", unit_of_measurement: unit } }}
            .label=${t(hass, "rain_forecast_threshold")}
            .value=${fromMm(draft.rain_forecast_threshold_mm, unit)}
            @value-changed=${(ev: Event) =>
              this.patch({ rain_forecast_threshold_mm: toMm(selectorValue<number>(ev) ?? 0, unit) })}
          ></ha-selector>
          ${this.error("rain_forecast_threshold_mm")}
        </div>
      </div>
      ${forecastOk
        ? html`<div class="muted small rule">
            ${t(hass, "rain_forecast_rule", {
              amount: fromMm(draft.rain_forecast_threshold_mm, unit),
              unit,
              hours: draft.rain_forecast_hours,
            })}
          </div>`
        : nothing}
    </div>`;
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .help {
        margin-bottom: 12px;
      }
      .subtitle {
        margin: 16px 0 8px;
      }
      .subtitle.first {
        margin-top: 0;
      }
      .voice-box {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }
      .test-row {
        margin-top: 12px;
      }
      .chip.offline {
        opacity: 0.55;
      }
      .narrow-field {
        max-width: 200px;
        margin-top: 12px;
      }
      .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 12px;
      }
      @media (max-width: 600px) {
        .pair {
          grid-template-columns: 1fr;
        }
      }
      .rule {
        margin-top: 4px;
      }
    `,
  ];
}

define("irrigation-settings-view", SettingsView);
