import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { deleteZone, saveZone, type Hass, type Snapshot, type Valve, type Zone, type ZoneConfig } from "../api";
import { dayLetters, formatNextRun, issueMap, t } from "../i18n";
import { TickController } from "../store";
import { controlButton, errorMessage, fireEvent, showToast, svgIcon } from "../shared/controls";
import { confirmDialog } from "../shared/confirm-dialog";
import { define, selectorValue } from "../shared/ha-components";
import { sharedStyles, toolbarStyles } from "../shared/styles";
import {
  progressBar,
  STATE_ICONS,
  valveButtons,
  valveLive,
  valveStatusText,
  type ValveLive,
} from "../shared/valve-status";
import { ZONE_ACTION_TEXT, zoneBadge, zoneButtons, zoneState } from "../shared/zone-status";

interface DraftValve extends Valve {
  // clave estable para repeat y el arrastre; no se envía al backend
  key: number;
}

interface Draft extends Omit<ZoneConfig, "valves"> {
  valves: DraftValve[];
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
let nextKey = 0;
// mdi:trash-can-outline; SVG en línea para heredar el color con currentColor
const TRASH_ICON =
  "M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z";

function toDraft(zone: ZoneConfig): Draft {
  return {
    zone_id: zone.zone_id ?? null,
    name: zone.name,
    enabled: zone.enabled,
    mode: zone.mode,
    days: [...zone.days],
    start_times: [...zone.start_times],
    max_simultaneous: zone.max_simultaneous,
    rain_skip: zone.rain_skip,
    sensors: { ...zone.sensors },
    calc_method: zone.calc_method,
    valves: zone.valves.map((valve) => ({ ...valve, start_times: [...valve.start_times], key: nextKey++ })),
  };
}

function emptyDraft(): Draft {
  return {
    zone_id: null,
    name: "",
    enabled: true,
    mode: "manual",
    days: [...ALL_DAYS],
    start_times: [],
    max_simultaneous: 1,
    rain_skip: true,
    sensors: { temperature: null, humidity: null, soil_moisture: null },
    calc_method: null,
    valves: [],
  };
}

/** Huella de lo editable; `enabled` queda fuera porque cambia en vivo con ■ ▶. */
function configKey(zone: ZoneConfig): string {
  return JSON.stringify([
    zone.name,
    zone.mode,
    zone.days,
    zone.start_times,
    zone.max_simultaneous,
    zone.rain_skip,
    zone.sensors,
    zone.calc_method,
    zone.valves.map((valve) => [valve.entity_id, valve.name, valve.duration_min, valve.start_times]),
  ]);
}

/** Editor de zona en dos columnas (mockup 02). */
export class ZoneEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    snapshot: { attribute: false },
    zoneId: { attribute: false },
    _draft: { state: true },
    _errors: { state: true },
    _banner: { state: true },
    _external: { state: true },
    _saving: { state: true },
    _newTime: { state: true },
    _dragKey: { state: true },
  };

  declare hass: Hass;
  declare narrow: boolean;
  declare snapshot: Snapshot;
  declare zoneId: string | null;
  declare _draft: Draft | undefined;
  // mensaje por ruta de error («valves.2.name»)
  declare _errors: Record<string, string>;
  declare _banner: string | undefined;
  declare _external: boolean;
  declare _saving: boolean;
  declare _newTime: string;
  declare _dragKey: number | undefined;

  // estado no reactivo del ciclo de edición
  private loaded = false;
  private loadedId: string | null = null;
  private baseline = "";
  private seen = false;
  private deleting = false;

  constructor() {
    super();
    this.narrow = false;
    this._draft = undefined;
    this._errors = {};
    this._banner = undefined;
    this._external = false;
    this._saving = false;
    this._newTime = "";
    this._dragKey = undefined;
    new TickController(this);
  }

  private get dirty(): boolean {
    return this._draft !== undefined && configKey(this._draft) !== this.baseline;
  }

  private liveZone(): Zone | undefined {
    return this.loadedId === null ? undefined : this.snapshot.zones.find((zone) => zone.zone_id === this.loadedId);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (!this.hass || !this.snapshot) return;
    if (!this.loaded || (changed.has("zoneId") && this.zoneId !== this.loadedId)) {
      this.load();
    } else if (changed.has("snapshot")) {
      this.checkExternal();
    }
  }

  private load(): void {
    this.loaded = true;
    this.loadedId = this.zoneId;
    this.deleting = false;
    this._errors = {};
    this._banner = undefined;
    this._external = false;
    if (this.zoneId === null) {
      this._draft = emptyDraft();
      this.baseline = configKey(this._draft);
      this.seen = false;
      return;
    }
    const zone = this.liveZone();
    if (!zone) {
      this._draft = undefined;
      this.leaveDeleted();
      return;
    }
    this.seen = true;
    this._draft = toDraft(zone);
    this.baseline = configKey(zone);
  }

  private checkExternal(): void {
    // mientras se guarda, el resultado de save_zone manda
    if (this._saving) return;
    const zone = this.liveZone();
    if (!zone) {
      if (this.seen && !this.deleting) this.leaveDeleted();
      return;
    }
    this.seen = true;
    const key = configKey(zone);
    if (key === this.baseline) return;
    if (this._draft && key === configKey(this._draft)) {
      this.baseline = key;
    } else {
      this._external = true;
    }
  }

  private leaveDeleted(): void {
    // fuera del ciclo de actualización: el panel cambia de vista al recibir el evento
    void this.updateComplete.then(() => {
      showToast(this, t(this.hass, "zone_deleted"));
      fireEvent(this, "zone-close");
    });
  }

  private reloadFromLive(): void {
    const zone = this.liveZone();
    if (!zone) return;
    this._draft = toDraft(zone);
    this.baseline = configKey(zone);
    this._external = false;
    this._errors = {};
    this._banner = undefined;
  }

  private patch(patch: Partial<Draft>): void {
    if (!this._draft) return;
    this._draft = { ...this._draft, ...patch };
  }

  private clearErrors(prefix: string): void {
    this._errors = Object.fromEntries(Object.entries(this._errors).filter(([path]) => !path.startsWith(prefix)));
  }

  private setValves(valves: DraftValve[], structural: boolean): void {
    this.patch({ valves });
    // al añadir, quitar o mover, los índices de los errores ya no apuntan a la fila correcta
    if (structural) this.clearErrors("valves.");
  }

  private patchValve(key: number, patch: Partial<DraftValve>): void {
    if (!this._draft) return;
    this.setValves(
      this._draft.valves.map((valve) => (valve.key === key ? { ...valve, ...patch } : valve)),
      false,
    );
  }

  private toggleDay(day: number): void {
    if (!this._draft) return;
    const days = this._draft.days.includes(day)
      ? this._draft.days.filter((item) => item !== day)
      : [...this._draft.days, day].sort((a, b) => a - b);
    this.patch({ days });
  }

  private addTime(): void {
    if (!this._draft) return;
    // ha-selector de hora puede devolver segundos: se recorta a HH:MM
    const time = this._newTime.slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(time) || this._draft.start_times.includes(time)) return;
    // el chip nuevo entra desmarcado en todas las válvulas
    this.patch({ start_times: [...this._draft.start_times, time].sort() });
    this.clearErrors("start_times");
    this._newTime = "";
  }

  private removeTime(time: string): void {
    if (!this._draft) return;
    this.patch({
      start_times: this._draft.start_times.filter((item) => item !== time),
      valves: this._draft.valves.map((valve) => ({
        ...valve,
        start_times: valve.start_times.filter((item) => item !== time),
      })),
    });
    this.clearErrors("start_times");
  }

  private toggleValveTime(key: number, time: string): void {
    const draft = this._draft;
    const valve = draft?.valves.find((item) => item.key === key);
    if (!draft || !valve) return;
    const marked = new Set(valve.start_times);
    if (marked.has(time)) marked.delete(time);
    else marked.add(time);
    // mismo orden que los bloques de la zona
    this.patchValve(key, { start_times: draft.start_times.filter((item) => marked.has(item)) });
  }

  private addValve(): void {
    if (!this._draft) return;
    this.setValves(
      [...this._draft.valves, { entity_id: "", name: "", duration_min: 10, start_times: [], enabled: true, key: nextKey++ }],
      true,
    );
  }

  private async removeValve(target: DraftValve): Promise<void> {
    if (!this._draft) return;
    const name = target.name || target.entity_id || t(this.hass, "new_valve");
    const confirmed = await confirmDialog(this.hass, {
      text: t(this.hass, "confirm_remove_valve", { name }),
      confirmText: t(this.hass, "confirm_remove"),
      destructive: true,
    });
    // el borrador puede haber cambiado mientras el diálogo estaba abierto
    if (!confirmed || !this._draft) return;
    this.setValves(
      this._draft.valves.filter((valve) => valve.key !== target.key),
      true,
    );
  }

  private drop(targetKey: number): void {
    const draft = this._draft;
    const dragKey = this._dragKey;
    this._dragKey = undefined;
    if (!draft || dragKey === undefined || dragKey === targetKey) return;
    const valves = [...draft.valves];
    const from = valves.findIndex((valve) => valve.key === dragKey);
    const to = valves.findIndex((valve) => valve.key === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = valves.splice(from, 1);
    valves.splice(to, 0, moved);
    this.setValves(valves, true);
  }

  private entityChanged(key: number, entityId: string): void {
    const valve = this._draft?.valves.find((item) => item.key === key);
    if (!valve) return;
    // el nombre se precarga con el de HA solo si está vacío
    const friendly = entityId ? this.hass.states[entityId]?.attributes.friendly_name : undefined;
    this.patchValve(key, { entity_id: entityId, name: valve.name || (friendly ?? "") });
  }

  /** Switch ya usadas en otras zonas o en otras filas de este borrador (V7). */
  private excluded(key: number): string[] {
    const others = this.snapshot.zones
      .filter((zone) => zone.zone_id !== this.loadedId)
      .flatMap((zone) => zone.valves.map((valve) => valve.entity_id));
    const siblings = (this._draft?.valves ?? []).filter((valve) => valve.key !== key).map((valve) => valve.entity_id);
    return [...others, ...siblings].filter((entityId) => entityId !== "");
  }

  private async back(): Promise<void> {
    if (
      this.dirty &&
      !(await confirmDialog(this.hass, {
        text: t(this.hass, "confirm_leave"),
        confirmText: t(this.hass, "confirm_leave_action"),
        destructive: true,
      }))
    )
      return;
    fireEvent(this, "zone-close");
  }

  private async save(): Promise<void> {
    const draft = this._draft;
    if (!draft || this._saving) return;
    const live = this.liveZone();
    // enabled no se edita aquí: manda el estado en vivo
    const zone: ZoneConfig = {
      ...draft,
      zone_id: this.loadedId,
      enabled: live?.enabled ?? true,
      valves: draft.valves.map((valve) => ({
        ...valve,
        enabled: live?.valves.find((item) => item.entity_id === valve.entity_id)?.enabled ?? true,
      })),
    };
    this._saving = true;
    try {
      const result = await saveZone(this.hass, zone);
      if (result.errors.length || !result.zone) {
        this._errors = issueMap(this.hass, result.errors);
        this._banner = t(this.hass, "not_saved");
        return;
      }
      const saved = result.zone;
      if (saved.zone_id !== this.loadedId) this.seen = false;
      this.loadedId = saved.zone_id;
      this._draft = toDraft(saved);
      this.baseline = configKey(saved);
      this._errors = {};
      this._banner = undefined;
      this._external = false;
      showToast(this, t(this.hass, "saved"));
      fireEvent(this, "zone-saved", { zoneId: saved.zone_id });
    } catch (err) {
      showToast(this, errorMessage(this.hass, err));
    } finally {
      this._saving = false;
    }
  }

  private async removeZone(): Promise<void> {
    const zoneId = this.loadedId;
    const draft = this._draft;
    if (zoneId === null || !draft) return;
    const name = this.liveZone()?.name ?? draft.name;
    const confirmed = await confirmDialog(this.hass, {
      text: t(this.hass, "confirm_delete", { name }),
      confirmText: t(this.hass, "confirm_delete_action"),
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting = true;
    try {
      await deleteZone(this.hass, zoneId);
      fireEvent(this, "zone-close");
    } catch (err) {
      this.deleting = false;
      showToast(this, errorMessage(this.hass, err));
    }
  }

  private error(path: string): TemplateResult | typeof nothing {
    const message = this._errors[path];
    return message ? html`<div class="error-text">${message}</div>` : nothing;
  }

  protected render() {
    const draft = this._draft;
    if (!this.hass || !this.snapshot || !draft) return nothing;
    const hass = this.hass;
    const admin = hass.user?.is_admin ?? false;
    const live = this.liveZone();
    const state = live ? zoneState(live, this.snapshot) : undefined;
    return html`
      <div class="toolbar">
        <button class="icon" title=${t(hass, "back")} @click=${this.back}>←</button>
        <span class="title">${draft.name || t(hass, "new_zone")}</span>
        ${live && state
          ? html`${zoneBadge(hass, state)}
            ${zoneButtons(live, state).map((spec) =>
              controlButton(this, hass, spec, t(hass, ZONE_ACTION_TEXT[spec.action])),
            )}`
          : nothing}
        ${admin && live
          ? html`<button
              class="danger with-icon"
              title=${t(hass, "delete_zone")}
              aria-label=${t(hass, "delete_zone")}
              ?disabled=${this._saving || !hass.connected}
              @click=${this.removeZone}
            >
              ${svgIcon(TRASH_ICON)}<span class="text">${t(hass, "delete_zone")}</span>
            </button>`
          : nothing}
        <span class="spacer"></span>
        ${admin
          ? html`<button class="filled" ?disabled=${this._saving || !hass.connected} @click=${this.save}>
              ${t(hass, "save")}
            </button>`
          : nothing}
      </div>
      <div class="content">
        ${hass.connected ? nothing : html`<div class="banner error">${t(hass, "disconnected")}</div>`}
        ${admin ? nothing : html`<div class="banner info">${t(hass, "read_only")}</div>`}
        ${this._external
          ? html`<div class="banner warning">
              ${t(hass, "external_change")}<span class="spacer"></span>
              <button @click=${this.reloadFromLive}>${t(hass, "reload")}</button>
            </div>`
          : nothing}
        ${this._banner ? html`<div class="banner error">${this._banner}</div>` : nothing}
        <div class="columns">
          ${this.renderSchedule(draft, live, !admin)} ${this.renderValves(draft, live, !admin)}
        </div>
      </div>
    `;
  }

  private renderSchedule(draft: Draft, live: Zone | undefined, readOnly: boolean): TemplateResult {
    const hass = this.hass;
    const letters = dayLetters(hass);
    const timeErrors = Object.entries(this._errors).filter(([path]) => path.startsWith("start_times."));
    return html`<div class="card">
      <div class="section">
        <ha-selector
          .hass=${hass}
          .selector=${{ text: {} }}
          .label=${t(hass, "field_name")}
          .value=${draft.name}
          .required=${true}
          .disabled=${readOnly}
          @value-changed=${(ev: Event) => this.patch({ name: selectorValue<string>(ev) ?? "" })}
        ></ha-selector>
        ${this.error("name")}
      </div>
      <div class="section">
        <div class="label">${t(hass, "rain")}</div>
        <ha-selector
          .hass=${hass}
          .selector=${{ boolean: {} }}
          .label=${t(hass, "rain_skip")}
          .value=${draft.rain_skip}
          .disabled=${readOnly}
          @value-changed=${(ev: Event) => this.patch({ rain_skip: selectorValue<boolean>(ev) ?? false })}
        ></ha-selector>
        <div class="muted small">${t(hass, "rain_skip_help")}</div>
      </div>
      <div class="section">
        <div class="label">${t(hass, "mode")}</div>
        <div class="chips">
          <button
            class="chip ${draft.mode === "manual" ? "on" : ""}"
            ?disabled=${readOnly}
            @click=${() => this.patch({ mode: "manual" })}
          >
            ${t(hass, "mode_manual")}
          </button>
          <button class="chip ${draft.mode === "auto" ? "on" : ""}" disabled>${t(hass, "mode_auto")}</button>
        </div>
        <div class="muted small">${t(hass, "auto_help")}</div>
        ${this.error("mode")}
      </div>
      <div class="section">
        <div class="label">${t(hass, "days")}</div>
        <div class="chips">
          ${ALL_DAYS.map(
            (day) =>
              html`<button
                class="chip ${draft.days.includes(day) ? "on" : ""}"
                ?disabled=${readOnly}
                @click=${() => this.toggleDay(day)}
              >
                ${letters[day]}
              </button>`,
          )}
        </div>
        ${this.error("days")}
      </div>
      <div class="section">
        <div class="label">${t(hass, "start_times")}</div>
        <div class="chips">
          ${draft.start_times.map(
            (time) =>
              html`<button class="chip on" ?disabled=${readOnly} @click=${() => this.removeTime(time)}>
                ${time}${readOnly ? "" : " ✕"}
              </button>`,
          )}
        </div>
        ${readOnly
          ? nothing
          : html`<div class="row add-time">
              <ha-selector
                .hass=${hass}
                .selector=${{ time: { no_second: true } }}
                .value=${this._newTime}
                @value-changed=${(ev: Event) => {
                  this._newTime = selectorValue<string>(ev) ?? "";
                }}
              ></ha-selector>
              <button ?disabled=${!this._newTime} @click=${this.addTime}>${t(hass, "add_time")}</button>
            </div>`}
        ${this.error("start_times")}
        ${timeErrors.map(([path, message]) => {
          const index = Number(path.split(".")[1]);
          return html`<div class="error-text">${draft.start_times[index] ?? ""} ${message}</div>`;
        })}
      </div>
      <div class="section">
        <ha-selector
          .hass=${hass}
          .selector=${{ number: { min: 1, max: 20, mode: "box" } }}
          .label=${t(hass, "max_simultaneous")}
          .value=${draft.max_simultaneous}
          .disabled=${readOnly}
          @value-changed=${(ev: Event) =>
            this.patch({ max_simultaneous: Math.trunc(selectorValue<number>(ev) ?? 0) })}
        ></ha-selector>
        ${this.error("max_simultaneous")}
      </div>
      <div class="muted small">
        ${t(hass, "next_run", { when: live ? formatNextRun(hass, live.next_run) : "—" })}
      </div>
    </div>`;
  }

  private renderValves(draft: Draft, live: Zone | undefined, readOnly: boolean): TemplateResult {
    const hass = this.hass;
    return html`<div class="card valves">
      <div class="row">
        <h3>${t(hass, "valves")}</h3>
        <span class="muted small">${t(hass, "queue_order")}</span>
        <span class="spacer"></span>
        ${readOnly ? nothing : html`<button @click=${this.addValve}>${t(hass, "add_valve")}</button>`}
      </div>
      <div class="table">
        <div class="valve head muted small">
          <span></span><span>${t(hass, "col_name")}</span><span>${t(hass, "col_entity")}</span>
          <span>${t(hass, "col_minutes")}</span><span>${t(hass, "col_blocks")}</span>
          <span>${t(hass, "col_status")}</span><span></span><span></span>
        </div>
        ${draft.valves.length
          ? repeat(
              draft.valves,
              (valve) => valve.key,
              (valve, index) => this.renderValve(draft, live, valve, index, readOnly),
            )
          : html`<div class="muted small empty">${t(hass, "no_valves")}</div>`}
      </div>
      ${readOnly ? nothing : html`<div class="muted small note">${t(hass, "picker_help")}</div>`}
      ${live ? nothing : html`<div class="muted small note">${t(hass, "status_after_save")}</div>`}
    </div>`;
  }

  private renderValve(
    draft: Draft,
    live: Zone | undefined,
    valve: DraftValve,
    index: number,
    readOnly: boolean,
  ): TemplateResult {
    const hass = this.hass;
    const path = `valves.${index}`;
    // estado y botones solo para válvulas ya guardadas en esta zona
    const saved = valve.entity_id ? live?.valves.find((item) => item.entity_id === valve.entity_id) : undefined;
    const status = saved ? valveLive(saved, this.snapshot) : undefined;
    return html`<div
      class="valve ${this._dragKey === valve.key ? "dragging" : ""}"
      @dragover=${(ev: DragEvent) => {
        if (this._dragKey !== undefined) ev.preventDefault();
      }}
      @drop=${(ev: DragEvent) => {
        ev.preventDefault();
        this.drop(valve.key);
      }}
    >
      <span
        class="handle cell muted f-handle"
        title=${t(hass, "drag")}
        draggable=${readOnly ? "false" : "true"}
        @dragstart=${(ev: DragEvent) => {
          this._dragKey = valve.key;
          // Firefox no arrastra sin datos
          ev.dataTransfer?.setData("text/plain", String(valve.key));
        }}
        @dragend=${() => {
          this._dragKey = undefined;
        }}
        >⋮⋮</span
      >
      <div class="f-name">
        <ha-selector
          .hass=${hass}
          .selector=${{ text: {} }}
          .label=${t(hass, "valve_name")}
          .value=${valve.name}
          .required=${true}
          .disabled=${readOnly}
          @value-changed=${(ev: Event) => this.patchValve(valve.key, { name: selectorValue<string>(ev) ?? "" })}
        ></ha-selector>
        ${this.error(`${path}.name`)}
      </div>
      <div class="f-entity">
        <ha-selector
          .hass=${hass}
          .selector=${{ entity: { domain: "switch", exclude_entities: this.excluded(valve.key) } }}
          .value=${valve.entity_id || undefined}
          .disabled=${readOnly}
          @value-changed=${(ev: Event) => this.entityChanged(valve.key, selectorValue<string>(ev) ?? "")}
        ></ha-selector>
        ${this.error(`${path}.entity_id`)}
      </div>
      <div class="f-minutes">
        <ha-selector
          .hass=${hass}
          .selector=${{ number: { min: 1, max: 600, mode: "box" } }}
          .label=${t(hass, "valve_minutes")}
          .value=${valve.duration_min}
          .disabled=${readOnly}
          @value-changed=${(ev: Event) =>
            this.patchValve(valve.key, { duration_min: Math.trunc(selectorValue<number>(ev) ?? 0) })}
        ></ha-selector>
        ${this.error(`${path}.duration_min`)}
      </div>
      <div class="cell f-blocks">${this.renderBlocks(draft, valve, readOnly)} ${this.error(`${path}.start_times`)}</div>
      <div class="cell small f-status">${status ? this.renderValveStatus(status) : html`<span class="muted">—</span>`}</div>
      <div class="buttons cell f-buttons">
        ${saved && status ? valveButtons(saved, status).map((spec) => controlButton(this, hass, spec)) : nothing}
      </div>
      <div class="cell f-remove">
        ${readOnly
          ? nothing
          : html`<button
              class="icon remove"
              title=${t(hass, "remove_valve")}
              aria-label=${t(hass, "remove_valve")}
              @click=${() => this.removeValve(valve)}
            >
              ${svgIcon(TRASH_ICON)}
            </button>`}
      </div>
    </div>`;
  }

  private renderBlocks(draft: Draft, valve: DraftValve, readOnly: boolean): TemplateResult {
    const hass = this.hass;
    if (!draft.start_times.length) return html`<span class="muted small">${t(hass, "add_times_first")}</span>`;
    return html`<div class="chips">
        ${draft.start_times.map(
          (time) =>
            html`<button
              class="chip ${valve.start_times.includes(time) ? "on" : ""}"
              ?disabled=${readOnly}
              @click=${() => this.toggleValveTime(valve.key, time)}
            >
              ${time}
            </button>`,
        )}
      </div>
      ${valve.start_times.length ? nothing : html`<div class="muted small">${t(hass, "manual_only")}</div>`}`;
  }

  private renderValveStatus(status: ValveLive): TemplateResult {
    const text = `${STATE_ICONS[status.state]} ${valveStatusText(this.hass, status).toLocaleLowerCase()}`;
    return html`<div class="state-${status.state}">${text}</div>
      ${status.open ? progressBar(status.open) : nothing}`;
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
        max-width: 1600px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .columns {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .columns {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .add-time {
        margin-top: 8px;
      }
      .add-time ha-selector {
        /* el botón va junto al campo, no al otro extremo de la fila */
        flex: none;
      }
      .table {
        overflow-x: auto;
        margin-top: 8px;
      }
      .valve {
        display: grid;
        grid-template-columns:
          24px minmax(160px, 1fr) minmax(200px, 1fr) 90px minmax(170px, 1fr)
          150px 96px 32px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        min-width: 960px;
      }
      .valve.head {
        align-items: center;
        padding: 4px 0;
      }
      .valve:not(.head) {
        /* arriba: los ha-input suman relleno inferior y el picker de entidad no;
           centrados quedaban a alturas distintas */
        align-items: start;
      }
      .valve .cell {
        /* alto de la caja de un campo de HA, para centrar el resto con ella */
        min-height: 56px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
      }
      .valve.dragging {
        opacity: 0.5;
      }
      button.remove {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--secondary-text-color);
      }
      button.remove:hover:not(:disabled) {
        color: var(--error-color);
      }
      button.remove .svg-icon {
        width: 20px;
        height: 20px;
      }
      .handle {
        cursor: grab;
        user-select: none;
      }
      .buttons {
        display: flex;
        gap: 4px;
      }
      .valve .buttons.cell {
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
      }
      .state-running,
      .state-manual {
        color: var(--primary-color);
      }
      .state-queued {
        color: var(--accent-color);
      }
      .state-idle,
      .state-stopped {
        color: var(--secondary-text-color);
      }
      .empty {
        padding: 16px 0;
      }
      .note {
        margin-top: 8px;
      }
      @media (max-width: 600px) {
        /* móvil: la barra no cabe; solo iconos y sin título (el nombre está en el formulario) */
        .toolbar {
          gap: 4px;
          padding: 0 8px;
        }
        .toolbar .title,
        .toolbar button .text {
          display: none;
        }
        .content {
          padding: 8px;
        }
      }
      .valves {
        container-type: inline-size;
      }
      @container (max-width: 700px) {
        /* ancho estrecho: cada válvula en bloque apilado en vez de tabla con scroll lateral */
        .valve.head {
          display: none;
        }
        .valve {
          min-width: 0;
          grid-template-columns: 24px minmax(0, 1fr) 96px 32px;
          grid-template-areas:
            "handle name minutes remove"
            ". entity entity entity"
            ". blocks blocks blocks"
            ". status buttons buttons";
          row-gap: 4px;
          padding: 12px 0;
        }
        .f-handle {
          grid-area: handle;
        }
        .f-name {
          grid-area: name;
        }
        .f-entity {
          grid-area: entity;
        }
        .f-minutes {
          grid-area: minutes;
        }
        .f-blocks {
          grid-area: blocks;
        }
        .f-status {
          grid-area: status;
        }
        .f-buttons {
          grid-area: buttons;
        }
        .f-remove {
          grid-area: remove;
        }
        .valve .f-blocks,
        .valve .f-status,
        .valve .f-buttons {
          min-height: 36px;
        }
        .valve .buttons.cell {
          justify-content: flex-end;
        }
      }
    `,
  ];
}

define("irrigation-zone-editor", ZoneEditor);
