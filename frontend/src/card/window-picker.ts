import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";

import type { Hass } from "../api";
import { t, type Key } from "../i18n";
import { fireEvent } from "../shared/controls";
import { define } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import {
  DEFAULT_WINDOW,
  isoToLocalInput,
  localInputToIso,
  MAX_WINDOW_MS,
  maxAmount,
  resolveWindow,
  sameWindow,
  WINDOW_PRESETS,
  type RangeWindow,
  type RelativeWindow,
  type TimeWindow,
  type WindowUnit,
} from "../shared/time-window";

type Mode = "preset" | "custom" | "range";

const UNITS: WindowUnit[] = ["hours", "days"];
const UNIT_KEYS: Record<WindowUnit, Key> = { hours: "history_unit_hours", days: "history_unit_days" };
const SHORT_KEYS: Record<WindowUnit, Key> = { hours: "history_hours", days: "history_days" };

/** Chips de ventana (6 h … 7 d), «Otra» (número + unidad) y, con `allow-range`, «Rango». Emite `window-changed`. */
export class WindowPicker extends LitElement {
  static properties = {
    hass: { attribute: false },
    window: { attribute: false },
    allowRange: { type: Boolean, attribute: "allow-range" },
    _custom: { state: true },
  };

  declare hass: Hass | undefined;
  declare window: TimeWindow;
  declare allowRange: boolean;
  // «Otra» abierta aunque la ventana coincida con un chip
  declare _custom: boolean;

  constructor() {
    super();
    this.hass = undefined;
    this.window = DEFAULT_WINDOW;
    this.allowRange = false;
    this._custom = false;
  }

  private mode(): Mode {
    const window = this.window;
    if (window.kind === "range") return "range";
    return this._custom || !WINDOW_PRESETS.some((preset) => sameWindow(preset, window)) ? "custom" : "preset";
  }

  private emit(window: TimeWindow): void {
    fireEvent(this, "window-changed", { window });
    // el campo vuelve a mostrar el valor aplicado aunque el padre no cambie
    this.requestUpdate();
  }

  private pickPreset(preset: RelativeWindow): void {
    this._custom = false;
    this.emit(preset);
  }

  private pickCustom(): void {
    this._custom = true;
    if (this.window.kind === "range") this.emit(DEFAULT_WINDOW);
  }

  private pickRange(): void {
    this._custom = false;
    const range = resolveWindow(DEFAULT_WINDOW, Date.now());
    this.emit({ kind: "range", start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() });
  }

  private changeCustom(amount: number, unit: WindowUnit): void {
    // se acota aquí para que el campo muestre lo que se aplica
    const value = Math.min(Math.max(1, Math.round(amount) || 1), maxAmount(unit));
    this.emit({ kind: "relative", amount: value, unit });
  }

  private changeRange(window: RangeWindow, edge: "start" | "end", value: string): void {
    if (!this.hass) return;
    const iso = localInputToIso(value, this.hass.config.time_zone);
    if (iso) this.emit({ ...window, [edge]: iso });
  }

  protected render() {
    const hass = this.hass;
    if (!hass) return nothing;
    const mode = this.mode();
    const window = this.window;
    const chip = (on: boolean, label: string, pick: () => void) =>
      html`<button class="chip ${on ? "on" : ""}" @click=${pick}>${label}</button>`;
    return html`<div class="chips">
        ${WINDOW_PRESETS.map((preset) =>
          chip(
            mode === "preset" && window.kind === "relative" && sameWindow(preset, window),
            t(hass, SHORT_KEYS[preset.unit], { n: preset.amount }),
            () => this.pickPreset(preset),
          ),
        )}
        ${chip(mode === "custom", t(hass, "history_custom"), () => this.pickCustom())}
        ${this.allowRange ? chip(mode === "range", t(hass, "history_range"), () => this.pickRange()) : nothing}
      </div>
      ${mode === "custom" && window.kind === "relative" ? this.renderCustom(hass, window) : nothing}
      ${window.kind === "range" ? this.renderRange(hass, window) : nothing}`;
  }

  private renderCustom(hass: Hass, window: RelativeWindow): TemplateResult {
    return html`<div class="row edit">
      <input
        type="number"
        min="1"
        max=${maxAmount(window.unit)}
        .value=${live(String(window.amount))}
        @change=${(ev: Event) => this.changeCustom(Number((ev.target as HTMLInputElement).value), window.unit)}
      />
      <select
        @change=${(ev: Event) =>
          this.changeCustom(window.amount, (ev.target as HTMLSelectElement).value as WindowUnit)}
      >
        ${UNITS.map(
          (unit) => html`<option .value=${unit} ?selected=${unit === window.unit}>${t(hass, UNIT_KEYS[unit])}</option>`,
        )}
      </select>
    </div>`;
  }

  private renderRange(hass: Hass, window: RangeWindow): TemplateResult {
    const timeZone = hass.config.time_zone;
    const now = Date.now();
    // se muestra el rango efectivo: si algo se sale de los 7 días, el campo enseña lo aplicado
    const range = resolveWindow(window, now);
    const min = isoToLocalInput(now - MAX_WINDOW_MS, timeZone);
    const max = isoToLocalInput(now, timeZone);
    const field = (edge: "start" | "end", label: string, value: number) =>
      html`<label class="row">
        <span class="small muted">${label}</span>
        <input
          type="datetime-local"
          min=${min}
          max=${max}
          .value=${live(isoToLocalInput(value, timeZone))}
          @change=${(ev: Event) => this.changeRange(window, edge, (ev.target as HTMLInputElement).value)}
        />
      </label>`;
    return html`<div class="row edit">
      ${field("start", t(hass, "history_from"), range.start)} ${field("end", t(hass, "history_to"), range.end)}
    </div>`;
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .edit {
        margin-top: 8px;
      }
      input[type="number"] {
        width: 5em;
      }
    `,
  ];
}

define("irrigation-window-picker", WindowPicker);
