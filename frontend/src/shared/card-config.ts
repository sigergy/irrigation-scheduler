import { css, html, nothing, type TemplateResult } from "lit";

import type { Hass, Zone } from "../api";
import { t } from "../i18n";
import type { StoreState } from "../store";
import { fireEvent } from "./controls";
import { selectorValue } from "./ha-components";

// configuración común de las tarjetas Lovelace: zonas elegidas, título y avisos del store

/** Valida `zones` de la configuración de una tarjeta; sin la clave, lista vacía. */
export function parseCardZones(raw: unknown): string[] {
  const zones = raw ?? [];
  if (!Array.isArray(zones) || zones.some((zone) => typeof zone !== "string")) {
    throw new Error(t(undefined, "card_bad_zones"));
  }
  return [...(zones as string[])];
}

/** Sin zonas elegidas la tarjeta muestra todas, en el orden de la configuración. */
export function cardZoneIds(configured: string[], zones: Zone[]): string[] {
  return configured.length ? configured : zones.map((zone) => zone.zone_id);
}

/** Aplica un cambio del editor y lo notifica a Lovelace; un título vacío se quita. */
export function changeCardConfig<T extends { title?: string }>(host: HTMLElement, config: T, patch: Partial<T>): T {
  const next: T = { ...config, ...patch };
  if (!next.title) delete next.title;
  fireEvent(host, "config-changed", { config: next });
  return next;
}

/** Aviso de la tarjeta mientras no hay snapshot: sin integración, error o cargando. */
export function storeNotice(hass: Hass, state: StoreState): TemplateResult | undefined {
  if (state.error === "not_loaded") return html`<div class="muted">${t(hass, "not_loaded")}</div>`;
  if (state.error) return html`<div class="muted">${t(hass, "load_error")}</div>`;
  if (!state.snapshot) return html`<div class="muted">${t(hass, "loading")}</div>`;
  return undefined;
}

/** Chips de las zonas elegidas (✕ quita) y desplegable para añadir; el orden es el de la tarjeta. */
export function zonePicker(
  hass: Hass,
  zones: Zone[],
  selected: string[],
  onChange: (zones: string[]) => void,
): TemplateResult {
  const nameOf = (zoneId: string) => zones.find((zone) => zone.zone_id === zoneId)?.name ?? zoneId;
  const available = zones.filter((zone) => !selected.includes(zone.zone_id));
  const add = (ev: Event) => {
    const select = ev.target as HTMLSelectElement;
    const zoneId = select.value;
    select.value = "";
    if (zoneId) onChange([...selected, zoneId]);
  };
  return html`<div class="section">
    <div class="label">${t(hass, "card_zones")}</div>
    <div class="chips zone-chips">
      ${selected.map(
        (zoneId) =>
          html`<button class="chip on" @click=${() => onChange(selected.filter((item) => item !== zoneId))}>
            ${nameOf(zoneId)} ✕
          </button>`,
      )}
      ${available.length
        ? html`<select @change=${add}>
            <option value="" selected>${t(hass, "add_zone")}</option>
            ${available.map((zone) => html`<option .value=${zone.zone_id}>${zone.name}</option>`)}
          </select>`
        : nothing}
    </div>
    <div class="muted small">${t(hass, selected.length ? "card_order_help" : "card_all_zones")}</div>
  </div>`;
}

/** Título opcional de la tarjeta. */
export function titleField(hass: Hass, title: string | undefined, onChange: (title: string) => void): TemplateResult {
  // ha-selector marca required por defecto: sin esto sale el asterisco
  return html`<ha-selector
    .hass=${hass}
    .selector=${{ text: {} }}
    .label=${t(hass, "card_title")}
    .required=${false}
    .value=${title ?? ""}
    @value-changed=${(ev: Event) => onChange(selectorValue<string>(ev) ?? "")}
  ></ha-selector>`;
}

export const cardConfigStyles = css`
  .zone-chips {
    margin-bottom: 4px;
  }
`;
