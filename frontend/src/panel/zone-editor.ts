import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { deleteZone, saveZone, type Hass, type Snapshot, type Valve, type Zone, type ZoneConfig } from "../api";
import { dayLetters, formatNextRun, issueMap, t } from "../i18n";
import { TickController } from "../store";
import { controlButton, errorMessage, fireEvent, showToast, svgIcon } from "../shared/controls";
import { alertDialog, confirmDialog } from "../shared/confirm-dialog";
import { define, selectorValue } from "../shared/ha-components";
import { sharedStyles, toolbarStyles } from "../shared/styles";
import { quietRange } from "../shared/quiet-hours";
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
    icon: zone.icon ?? null,
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
    icon: null,
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
    zone.icon,
    zone.mode,
    zone.days,
    zone.start_times,
    zone.max_simultaneous,
    zone.rain_skip,
    zone.sensors,
    zone.calc_method,
    zone.valves.map((valve) => [valve.entity_id, valve.name, valve.duration_min, valve.start_times, valve.supply_sensor]),
  ]);
}

/** Editor de zona en dos columnas (mockup 02). */
export class ZoneEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    // abierto en el diálogo de la tarjeta: añade «Cancelar» a la barra
    inDialog: { type: Boolean, attribute: "in-dialog", reflect: true },
    snapshot: { attribute: false },
    zoneId: { attribute: false },
    _draft: { state: true },
    _errors: { state: true },
    _banner: { state: true },
    _external: { state: true },
    _saving: { state: true },
    _newTime: { state: true },
    _dragKey: { state: true },
    _overKey: { state: true },
  };

  declare hass: Hass;
  declare narrow: boolean;
  declare inDialog: boolean;
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
  // fila sobre la que caerá la válvula arrastrada
  declare _overKey: number | undefined;

  // estado no reactivo del ciclo de edición
  private loaded = false;
  private loadedId: string | null = null;
  private baseline = "";
  private seen = false;
  private deleting = false;

  constructor() {
    super();
    this.narrow = false;
    this.inDialog = false;
    this._draft = undefined;
    this._errors = {};
    this._banner = undefined;
    this._external = false;
    this._saving = false;
    this._newTime = "";
    this._dragKey = undefined;
    this._overKey = undefined;
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
      [...this._draft.valves, { entity_id: "", name: "", duration_min: 10, start_times: [], enabled: true, supply_sensor: null, key: nextKey++ }],
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

  // arrastre con Pointer Events: los eventos drag de HTML5 no nacen de un toque en móvil
  private dragStart(ev: PointerEvent, key: number): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    // la captura mantiene los pointermove en el asa aunque el dedo salga de ella
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this._dragKey = key;
    this._overKey = key;
  }

  private dragMove(ev: PointerEvent): void {
    if (this._dragKey === undefined) return;
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>(".valve[data-key]")];
    if (!rows.length) return;
    // por encima de la primera fila o por debajo de la última se queda en el extremo
    const row = rows.find((item) => ev.clientY < item.getBoundingClientRect().bottom) ?? rows[rows.length - 1];
    this._overKey = Number(row.dataset.key);
  }

  private dragEnd(): void {
    const draft = this._draft;
    const dragKey = this._dragKey;
    const targetKey = this._overKey;
    this._dragKey = undefined;
    this._overKey = undefined;
    if (!draft || dragKey === undefined || targetKey === undefined || dragKey === targetKey) return;
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

  /** Sensores de suministro ya usados en otras zonas o en otras filas de este borrador (V14). */
  private excludedSupply(key: number): string[] {
    const others = this.snapshot.zones
      .filter((zone) => zone.zone_id !== this.loadedId)
      .flatMap((zone) => zone.valves.map((valve) => valve.supply_sensor));
    const siblings = (this._draft?.valves ?? []).filter((valve) => valve.key !== key).map((valve) => valve.supply_sensor);
    return [...others, ...siblings].filter((entityId): entityId is string => !!entityId);
  }

  /** Cierra el editor; con cambios sin guardar pide confirmación. También lo usa el diálogo de la tarjeta. */
  async back(): Promise<void> {
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
      const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown };
      const valves = typeof message === "string" ? message : "";
      if (code === "valves_not_off") await alertDialog(this.hass, t(this.hass, "delete_valves_not_off", { valves }));
      else if (code === "zone_busy") await alertDialog(this.hass, t(this.hass, "delete_zone_busy", { valves }));
      else showToast(this, errorMessage(this.hass, err));
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
    const live = this.liveZone();
    const state = live ? zoneState(live, this.snapshot) : undefined;
    return html`
      <div class="toolbar">
        <button class="icon" title=${t(hass, "back")} @click=${this.back}>←</button>
        <span class="title">${draft.name || t(hass, "new_zone")}</span>
        ${live && state
          ? html`${zoneBadge(hass, state)}
            ${zoneButtons(live, state, this.snapshot.settings).map((spec) =>
              controlButton(this, hass, spec, t(hass, ZONE_ACTION_TEXT[spec.action])),
            )}`
          : nothing}
        ${live
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
        ${this.inDialog
          ? html`<button ?disabled=${this._saving} @click=${this.back}>${t(hass, "cancel")}</button>`
          : nothing}
        <button class="filled" ?disabled=${this._saving || !hass.connected} @click=${this.save}>
          ${t(hass, "save")}
        </button>
      </div>
      <div class="content">
        ${hass.connected ? nothing : html`<div class="banner error">${t(hass, "disconnected")}</div>`}
        ${this._external
          ? html`<div class="banner warning">
              ${t(hass, "external_change")}<span class="spacer"></span>
              <button @click=${this.reloadFromLive}>${t(hass, "reload")}</button>
            </div>`
          : nothing}
        ${this._banner ? html`<div class="banner error">${this._banner}</div>` : nothing}
        <div class="columns">
          ${this.renderSchedule(draft, live)} ${this.renderValves(draft)}
        </div>
      </div>
    `;
  }

  private renderSchedule(draft: Draft, live: Zone | undefined): TemplateResult {
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
          @value-changed=${(ev: Event) => this.patch({ name: selectorValue<string>(ev) ?? "" })}
        ></ha-selector>
        ${this.error("name")}
        <ha-selector
          .hass=${hass}
          .selector=${{ icon: {} }}
          .label=${t(hass, "field_icon")}
          .value=${draft.icon ?? ""}
          @value-changed=${(ev: Event) => this.patch({ icon: selectorValue<string>(ev) || null })}
        ></ha-selector>
        <div class="muted small">${t(hass, "field_icon_help")}</div>
      </div>
      <div class="section">
        <div class="label">${t(hass, "rain")}</div>
        <ha-selector
          .hass=${hass}
          .selector=${{ boolean: {} }}
          .label=${t(hass, "rain_skip")}
          .value=${draft.rain_skip}
          @value-changed=${(ev: Event) => this.patch({ rain_skip: selectorValue<boolean>(ev) ?? false })}
        ></ha-selector>
        <div class="muted small">${t(hass, "rain_skip_help")}</div>
      </div>
      <div class="section">
        <div class="label">${t(hass, "mode")}</div>
        <div class="chips">
          <button
            class="chip ${draft.mode === "manual" ? "on" : ""}"
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
              html`<button class="chip on" @click=${() => this.removeTime(time)}>${time} ✕</button>`,
          )}
        </div>
        <div class="row add-time">
          <ha-selector
            .hass=${hass}
            .selector=${{ time: { no_second: true } }}
            .value=${this._newTime}
            @value-changed=${(ev: Event) => {
              this._newTime = selectorValue<string>(ev) ?? "";
            }}
          ></ha-selector>
          <button ?disabled=${!this._newTime} @click=${this.addTime}>${t(hass, "add_time")}</button>
        </div>
        ${this.error("start_times")}
        ${timeErrors.map(([path, message]) => {
          const index = Number(path.split(".")[1]);
          return html`<div class="error-text">${draft.start_times[index] ?? ""} ${message}</div>`;
        })}
        ${quietRange(this.snapshot.settings)
          ? html`<div class="muted small">
              ${t(hass, "quiet_zone_note", { range: quietRange(this.snapshot.settings) ?? "" })}
            </div>`
          : nothing}
      </div>
      <div class="section">
        <ha-selector
          .hass=${hass}
          .selector=${{ number: { min: 1, max: 20, mode: "box" } }}
          .label=${t(hass, "max_simultaneous")}
          .value=${draft.max_simultaneous}
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

  private renderValves(draft: Draft): TemplateResult {
    const hass = this.hass;
    return html`<div class="card valves">
      <div class="row">
        <h3>${t(hass, "valves")}</h3>
        <span class="muted small">${t(hass, "queue_order")}</span>
        <span class="spacer"></span>
        <button @click=${this.addValve}>${t(hass, "add_valve")}</button>
      </div>
      <div class="table">
        <div class="valve head muted small">
          <span></span><span>${t(hass, "col_name")}</span><span>${t(hass, "col_entity")}</span><span>${t(hass, "col_supply")}</span>
          <span>${t(hass, "col_minutes")}</span><span>${t(hass, "col_blocks")}</span><span></span>
        </div>
        ${draft.valves.length
          ? repeat(
              draft.valves,
              (valve) => valve.key,
              (valve, index) => this.renderValve(draft, valve, index),
            )
          : html`<div class="muted small empty">${t(hass, "no_valves")}</div>`}
      </div>
      <div class="muted small note">${t(hass, "picker_help")}</div>
    </div>`;
  }

  // solo configuración: el estado y los controles de cada válvula están en la lista de zonas
  private renderValve(draft: Draft, valve: DraftValve, index: number): TemplateResult {
    const hass = this.hass;
    const path = `valves.${index}`;
    const target = this._dragKey !== undefined && this._dragKey !== valve.key && this._overKey === valve.key;
    return html`<div
      class="valve ${this._dragKey === valve.key ? "dragging" : ""} ${target ? "drop-target" : ""}"
      data-key=${valve.key}
    >
      <span
        class="handle cell muted f-handle active"
        title=${t(hass, "drag")}
        @pointerdown=${(ev: PointerEvent) => {
          this.dragStart(ev, valve.key);
        }}
        @pointermove=${(ev: PointerEvent) => this.dragMove(ev)}
        @pointerup=${() => this.dragEnd()}
        @pointercancel=${() => {
          this._dragKey = undefined;
          this._overKey = undefined;
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
          @value-changed=${(ev: Event) => this.patchValve(valve.key, { name: selectorValue<string>(ev) ?? "" })}
        ></ha-selector>
        ${this.error(`${path}.name`)}
      </div>
      <div class="f-entity">
        <ha-selector
          .hass=${hass}
          .selector=${{ entity: { domain: "switch", exclude_entities: this.excluded(valve.key) } }}
          .value=${valve.entity_id || undefined}
          @value-changed=${(ev: Event) => this.entityChanged(valve.key, selectorValue<string>(ev) ?? "")}
        ></ha-selector>
        ${this.error(`${path}.entity_id`)}
      </div>
      <div class="f-supply">
        <ha-selector
          .hass=${hass}
          .selector=${{ entity: { domain: "binary_sensor", exclude_entities: this.excludedSupply(valve.key) } }}
          .label=${t(hass, "col_supply")}
          .value=${valve.supply_sensor || undefined}
          @value-changed=${(ev: Event) => this.patchValve(valve.key, { supply_sensor: selectorValue<string>(ev) || null })}
        ></ha-selector>
        ${this.error(`${path}.supply_sensor`)}
      </div>
      <div class="f-minutes">
        <ha-selector
          .hass=${hass}
          .selector=${{ number: { min: 1, max: 600, mode: "box" } }}
          .label=${t(hass, "valve_minutes")}
          .value=${valve.duration_min}
          @value-changed=${(ev: Event) =>
            this.patchValve(valve.key, { duration_min: Math.trunc(selectorValue<number>(ev) ?? 0) })}
        ></ha-selector>
        ${this.error(`${path}.duration_min`)}
      </div>
      <div class="cell f-blocks">${this.renderBlocks(draft, valve)} ${this.error(`${path}.start_times`)}</div>
      <div class="cell f-remove">
        <button
          class="icon remove"
          title=${t(hass, "remove_valve")}
          aria-label=${t(hass, "remove_valve")}
          @click=${() => this.removeValve(valve)}
        >
          ${svgIcon(TRASH_ICON)}
        </button>
      </div>
    </div>`;
  }

  private renderBlocks(draft: Draft, valve: DraftValve): TemplateResult {
    const hass = this.hass;
    if (!draft.start_times.length) return html`<span class="muted small">${t(hass, "add_times_first")}</span>`;
    return html`<div class="chips">
        ${draft.start_times.map(
          (time) =>
            html`<button
              class="chip ${valve.start_times.includes(time) ? "on" : ""}"
              @click=${() => this.toggleValveTime(valve.key, time)}
            >
              ${time}
            </button>`,
        )}
      </div>
      ${valve.start_times.length ? nothing : html`<div class="muted small">${t(hass, "manual_only")}</div>`}`;
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
        /* columnas elásticas con mínimo: nombre, entidad, minutos y bloques reparten el ancho sobrante */
        grid-template-columns: 24px minmax(140px, 1fr) minmax(180px, 1.5fr) minmax(160px, 1.2fr) minmax(88px, 110px) minmax(140px, 1fr) 32px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        /* suma de mínimos y huecos; por debajo de 820 px ya se apila */
        min-width: 812px;
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
      .valve.drop-target {
        background: var(--secondary-background-color);
        outline: 2px dashed var(--primary-color);
        outline-offset: -2px;
      }
      button.remove {
        /* 6 + 20 + 6 = 32px, el ancho de su columna; con el relleno común medía 36 y desbordaba la tabla */
        padding: 4px 6px;
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
        user-select: none;
      }
      .handle.active {
        cursor: grab;
        /* sin esto el navegador táctil desplaza la página en vez de mandar pointermove */
        touch-action: none;
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
      @container (max-width: 820px) {
        /* ancho estrecho: cada válvula en bloque apilado en vez de tabla con scroll lateral */
        .valve.head {
          display: none;
        }
        .valve {
          min-width: 0;
          grid-template-columns: 24px minmax(0, 1fr) minmax(72px, 96px) 32px;
          grid-template-areas:
            "handle name minutes remove"
            ". entity entity entity"
            ". supply supply supply"
            ". blocks blocks blocks";
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
        .f-supply {
          grid-area: supply;
        }
        .f-minutes {
          grid-area: minutes;
        }
        .f-blocks {
          grid-area: blocks;
        }
        .f-remove {
          grid-area: remove;
        }
        .valve .f-blocks {
          min-height: 36px;
        }
      }
    `,
  ];
}

define("irrigation-zone-editor", ZoneEditor);
