# Tarjeta de histórico de riego — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** tarjeta Lovelace `irrigation-history-card` que muestra, en una ventana de hasta 7 días, los encendidos reales de las válvulas agrupados por zona, en tres vistas: lista, línea de tiempo y totales.

**Arquitectura:** solo frontend. La tarjeta pide al recorder de HA (`history/history_during_period`) las transiciones de las switch de las válvulas; una función pura (`shared/valve-history.ts`) las convierte en intervalos y totales por zona usando el snapshot compartido; tres funciones de render (`card/history-views.ts`) pintan ese resultado. La ventana (relativa o rango) vive en `shared/time-window.ts` y se elige con un componente propio (`card/window-picker.ts`) que usan la tarjeta y su editor.

**Stack:** TypeScript 6.0.3, Lit 3.3.3, Vite 8.3.1, ESLint 10.11.0. HA 2026.9.

**Spec:** `docs/superpowers/specs/2026-09-29-history-card-design.md`.

## Restricciones globales

- **Sin tests.** Excepción explícita del usuario a TDD. Checks baratos:
  - por tarea, en `frontend/`: `npx tsc --noEmit` sin errores;
  - al final (Tarea 4), en `frontend/`: `npm run lint` (`--max-warnings 0`) y `npm run build` sin errores ni avisos.
- **El backend no se toca.** Sin ruff ni compileall.
- **El bundle** `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js` se regenera y se commitea solo en la Tarea 4.
- **No** levantar servidores ni abrir navegador. El usuario valida en su HA.
- **Idioma:** comentarios en español; identificadores, claves y ficheros en inglés; ficheros `kebab-case`.
- **Lit sin decoradores:** `static properties`, campos con `declare`, valores por defecto en el `constructor`, registro con `define(...)` de `shared/ha-components.ts`.
- **Textos:** solo vía `t(hass, key)`; toda clave nueva en `ES` y `EN` de `i18n.ts` (`EN` es `Record<Key, string>`: si falta una, `tsc` falla).
- **Sin duplicar:** el cálculo vive solo en `shared/time-window.ts` y `shared/valve-history.ts`; las vistas no calculan; `MAX_WINDOW_DAYS` se define una vez.
- **Rama:** `feat/history-card` desde `main`. Un commit por tarea. Sin push ni merge sin petición explícita. Sin worktrees.
- **Commits:** terminan con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01L9SnZJg8GM9XfNz6GPmnka
  ```

## Mapa de ficheros

| Fichero | Tarea | Qué |
|---|---|---|
| `frontend/src/shared/card-config.ts` | 1 (crear) | Configuración común de tarjetas: `parseCardZones`, `cardZoneIds`, `changeCardConfig`, `storeNotice`, `zonePicker`, `titleField`, `cardConfigStyles`. |
| `frontend/src/shared/ha-components.ts` | 1 (modificar) | `registerCard()` y el tipo global `window.customCards`. |
| `frontend/src/card/irrigation-card.ts` | 1 (modificar) | Usa `parseCardZones`, `cardZoneIds`, `storeNotice`, `registerCard`. |
| `frontend/src/card/card-editor.ts` | 1 (modificar) | Usa `zonePicker`, `titleField`, `changeCardConfig`. |
| `frontend/src/api.ts` | 2 (modificar) | `HistoryState`, `HistoryResponse`, `fetchValveHistory`. |
| `frontend/src/shared/time-window.ts` | 2 (crear) | Ventana: tipos, `resolveWindow`, `parseWindow`, conversión hora de HA ↔ instante, marcas del eje. |
| `frontend/src/shared/valve-history.ts` | 2 (crear) | `valveRuns`, `buildHistory` y sus tipos. |
| `frontend/src/i18n.ts` | 3 (modificar) | `formatDateTime`, `sameDay`, claves `history_*`. |
| `frontend/src/card/window-picker.ts` | 3 (crear) | `<irrigation-window-picker>`: chips de ventana, «Otra», «Rango». |
| `frontend/src/card/history-views.ts` | 3 (crear) | `viewChips`, `historyList`, `historyTimeline`, `historyTotals`, `historyStyles`. |
| `frontend/src/card/history-card.ts` | 4 (crear) | `<irrigation-history-card>`. |
| `frontend/src/card/history-editor.ts` | 4 (crear) | `<irrigation-history-card-editor>`. |
| `frontend/src/main.ts` | 4 (modificar) | Importa la tarjeta y su editor. |

---

### Tarea 1: Extraer la configuración común de tarjetas

Refactor sin cambio de comportamiento. Deja listo lo que la tarjeta de histórico reutiliza, para no copiarlo.

**Files:**
- Create: `frontend/src/shared/card-config.ts`
- Modify: `frontend/src/shared/ha-components.ts` (añadir al final)
- Modify: `frontend/src/card/irrigation-card.ts:1-12`, `:27-31`, `:60-67`, `:141-153`, `:338-348`
- Modify: `frontend/src/card/card-editor.ts` (entero)

**Interfaces:**
- Produces:
  - `parseCardZones(raw: unknown): string[]` — lanza `Error(t(undefined, "card_bad_zones"))` si no es lista de strings.
  - `cardZoneIds(configured: string[], zones: Zone[]): string[]`
  - `changeCardConfig<T extends { title?: string }>(host: HTMLElement, config: T, patch: Partial<T>): T`
  - `storeNotice(hass: Hass, state: StoreState): TemplateResult | undefined`
  - `zonePicker(hass: Hass, zones: Zone[], selected: string[], onChange: (zones: string[]) => void): TemplateResult`
  - `titleField(hass: Hass, title: string | undefined, onChange: (title: string) => void): TemplateResult`
  - `cardConfigStyles: CSSResult`
  - `registerCard(card: CustomCard): void` en `shared/ha-components.ts`

- [ ] **Paso 1: rama**

```bash
git switch -c feat/history-card
```

- [ ] **Paso 2: crear `frontend/src/shared/card-config.ts`**

```ts
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
```

- [ ] **Paso 3: `registerCard` en `frontend/src/shared/ha-components.ts`** (añadir al final del fichero)

```ts
export interface CustomCard {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
}

declare global {
  interface Window {
    customCards?: CustomCard[];
  }
}

/** Alta en el selector de tarjetas de Lovelace; el bundle puede cargarse más de una vez. */
export function registerCard(card: CustomCard): void {
  window.customCards ??= [];
  if (!window.customCards.some((item) => item.type === card.type)) window.customCards.push(card);
}
```

- [ ] **Paso 4: `frontend/src/card/irrigation-card.ts`**

Imports (líneas 1-12): sustituir la línea de `ha-components` y añadir `card-config`:

```ts
import { define, loadHaComponents, registerCard } from "../shared/ha-components";
import { cardZoneIds, parseCardZones, storeNotice } from "../shared/card-config";
```

Borrar el bloque `declare global { interface Window { customCards?: … } }` (líneas 27-31).

`setConfig` (líneas 60-67) queda:

```ts
  setConfig(config: CardConfig): void {
    // sin zonas elegidas (o sin la clave) se muestran todas
    this._config = { ...config, zones: parseCardZones(config?.zones) };
  }
```

En `render()` (líneas 141-153), sustituir el cálculo de `body` por:

```ts
    const { snapshot } = this.store.state;
    // configurar zonas exige admin, igual que el panel
    const admin = hass.user?.is_admin ?? false;
    let body: unknown = storeNotice(hass, this.store.state);
    if (!body && snapshot) {
      const zoneIds = cardZoneIds(config.zones, snapshot.zones);
      body = zoneIds.length
        ? zoneIds.map((zoneId) => this.renderZone(hass, snapshot, zoneId))
        : html`<div class="muted">${t(hass, "empty_list")}</div>`;
    }
```

El registro final (líneas 340-348) queda:

```ts
registerCard({
  type: CARD_TYPE,
  name: "Irrigation Scheduler",
  description: t(undefined, "card_description"),
  preview: true,
});
```

- [ ] **Paso 5: `frontend/src/card/card-editor.ts`** (fichero entero)

```ts
import { css, html, LitElement, nothing } from "lit";

import type { Hass } from "../api";
import { SnapshotController } from "../store";
import { cardConfigStyles, changeCardConfig, titleField, zonePicker } from "../shared/card-config";
import { define, loadHaComponents } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { CARD_TYPE, type CardConfig } from "./irrigation-card";

/** Editor visual de la tarjeta (mockup 04). */
export class CardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: CardConfig | undefined;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadHaComponents().then(() => this.requestUpdate());
  }

  setConfig(config: CardConfig): void {
    this._config = { ...config, zones: Array.isArray(config.zones) ? [...config.zones] : [] };
  }

  // nunca «update»: pisaría el método de ciclo de vida de LitElement
  private changeConfig(patch: Partial<CardConfig>): void {
    if (this._config) this._config = changeCardConfig(this, this._config, patch);
  }

  protected render() {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return nothing;
    const zones = this.store.state.snapshot?.zones ?? [];
    return html`
      ${zonePicker(hass, zones, config.zones, (next) => this.changeConfig({ zones: next }))}
      ${titleField(hass, config.title, (title) => this.changeConfig({ title }))}
    `;
  }

  static styles = [
    sharedStyles,
    cardConfigStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];
}

define(`${CARD_TYPE}-editor`, CardEditor);
```

- [ ] **Paso 6: check**

Run (en `frontend/`): `npx tsc --noEmit`
Expected: sin salida, código 0.

- [ ] **Paso 7: revisión inline**

- `card-editor.ts` ya no contiene `addZone` ni el `<select>` propio.
- `irrigation-card.ts` ya no declara `window.customCards` ni valida `zones` a mano.
- `grep -rn "not_loaded" frontend/src/card` → 0 resultados (el aviso vive en `shared/card-config.ts`).

- [ ] **Paso 8: commit**

```bash
git add frontend/src/shared/card-config.ts frontend/src/shared/ha-components.ts frontend/src/card/irrigation-card.ts frontend/src/card/card-editor.ts
git commit -F - <<'EOF'
refactor(card): configuración común de tarjetas en shared/card-config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L9SnZJg8GM9XfNz6GPmnka
EOF
```

---

### Tarea 2: Capa de datos — recorder, ventana e intervalos

**Files:**
- Modify: `frontend/src/api.ts` (añadir tras `TimeSpan`, línea 79, y al final)
- Create: `frontend/src/shared/time-window.ts`
- Create: `frontend/src/shared/valve-history.ts`

**Interfaces:**
- Consumes: `TimeSpan`, `Valve`, `Zone` de `api.ts`.
- Produces:
  - `api.ts`: `HistoryState { s: string; lu: number; lc?: number }`, `HistoryResponse = Record<string, HistoryState[]>`, `fetchValveHistory(hass, entityIds: string[], start: number, end: number): Promise<HistoryResponse>`.
  - `time-window.ts`: `MAX_WINDOW_DAYS`, `MAX_WINDOW_MS`, `WindowUnit`, `RelativeWindow`, `RangeWindow`, `TimeWindow`, `WindowRange { start: number; end: number }`, `DEFAULT_WINDOW`, `WINDOW_PRESETS`, `sameWindow(a, b)`, `maxAmount(unit)`, `parseWindow(raw)`, `resolveWindow(window, now)`, `localInputToIso(value, timeZone)`, `isoToLocalInput(ms, timeZone)`, `AxisTick { at: number; parts: "time" | "day" }`, `axisTicks(range, timeZone)`.
  - `valve-history.ts`: `ValveRun`, `ValveHistory`, `ZoneHistory`, `valveRuns(states, range)`, `buildHistory(history, zones, range)`.

- [ ] **Paso 1: `frontend/src/api.ts`**

Tras la interfaz `TimeSpan` (línea 79):

```ts
/** Estado comprimido de `history/history_during_period` con minimal_response: s = estado; lu/lc en s epoch. */
export interface HistoryState {
  s: string;
  lu: number;
  // solo si difiere de lu
  lc?: number;
}

/** entity_id → estados en orden cronológico; una entidad sin datos puede faltar. */
export type HistoryResponse = Record<string, HistoryState[]>;
```

Al final del fichero:

```ts
/** Transiciones de las switch en [start, end] (ms epoch), del recorder de HA. Incluye el estado vigente en start. */
export const fetchValveHistory = (hass: Hass, entityIds: string[], start: number, end: number) =>
  hass.callWS<HistoryResponse>({
    type: "history/history_during_period",
    entity_ids: entityIds,
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    minimal_response: true,
    no_attributes: true,
  });
```

- [ ] **Paso 2: crear `frontend/src/shared/time-window.ts`**

```ts
// ventana de tiempo del histórico: relativa hasta ahora o rango fijo, siempre ≤ MAX_WINDOW_DAYS

export const MAX_WINDOW_DAYS = 7;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const MAX_WINDOW_MS = MAX_WINDOW_DAYS * DAY_MS;

export type WindowUnit = "hours" | "days";
export interface RelativeWindow {
  kind: "relative";
  amount: number;
  unit: WindowUnit;
}
export interface RangeWindow {
  kind: "range";
  // ISO UTC
  start: string;
  end: string;
}
export type TimeWindow = RelativeWindow | RangeWindow;

/** Ventana ya resuelta, en ms epoch. */
export interface WindowRange {
  start: number;
  end: number;
}

export const DEFAULT_WINDOW: RelativeWindow = { kind: "relative", amount: 24, unit: "hours" };

export const WINDOW_PRESETS: RelativeWindow[] = [
  { kind: "relative", amount: 6, unit: "hours" },
  DEFAULT_WINDOW,
  { kind: "relative", amount: 3, unit: "days" },
  { kind: "relative", amount: MAX_WINDOW_DAYS, unit: "days" },
];

export function sameWindow(a: RelativeWindow, b: RelativeWindow): boolean {
  return a.amount === b.amount && a.unit === b.unit;
}

/** Máximo de `amount` para una unidad sin pasar de MAX_WINDOW_DAYS. */
export function maxAmount(unit: WindowUnit): number {
  return unit === "days" ? MAX_WINDOW_DAYS : MAX_WINDOW_DAYS * 24;
}

/** `window` de la configuración de la tarjeta; cualquier valor inválido → 24 h. */
export function parseWindow(raw: unknown): RelativeWindow {
  const { amount, unit } = (raw ?? {}) as { amount?: unknown; unit?: unknown };
  if (unit !== "hours" && unit !== "days") return DEFAULT_WINDOW;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > maxAmount(unit)) {
    return DEFAULT_WINDOW;
  }
  return { kind: "relative", amount, unit };
}

/** Inicio y fin efectivos: duración ≤ 7 d, inicio ≥ now − 7 d, fin ≤ now. Si no hay rango válido, 24 h. */
export function resolveWindow(window: TimeWindow, now: number): WindowRange {
  if (window.kind === "relative") {
    const length = window.amount * (window.unit === "days" ? DAY_MS : HOUR_MS);
    const span = length > 0 ? Math.min(length, MAX_WINDOW_MS) : HOUR_MS * DEFAULT_WINDOW.amount;
    return { start: now - span, end: now };
  }
  const end = Math.min(Date.parse(window.end), now);
  const start = Math.max(Date.parse(window.start), now - MAX_WINDOW_MS, end - MAX_WINDOW_MS);
  // NaN (fecha ilegible) falla la comparación y cae en la ventana por defecto
  if (!(start < end)) return resolveWindow(DEFAULT_WINDOW, now);
  return { start, end };
}

/** Hora de pared − UTC (ms) de la zona horaria en ese instante. */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wall - Math.floor(ms / 1000) * 1000;
}

/** «2026-09-29T07:00» de un input datetime-local, leído en la zona de HA → ISO UTC. */
export function localInputToIso(value: string, timeZone: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // dos pasadas: el desfase puede cambiar justo en el salto de horario
  const guess = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(guess, timeZone)).toISOString();
}

/** Instante → «2026-09-29T07:00» en la zona de HA, para un input datetime-local. */
export function isoToLocalInput(ms: number, timeZone: string): string {
  return new Date(ms + zoneOffset(ms, timeZone)).toISOString().slice(0, 16);
}

export interface AxisTick {
  at: number;
  parts: "time" | "day";
}

const HOUR_STEPS = [1, 2, 3, 6, 12];
const MAX_TICKS = 6;

/** Marcas del eje: horas redondas si la ventana es ≤ 24 h, medianoches si es mayor; en hora de HA. */
export function axisTicks(range: WindowRange, timeZone: string): AxisTick[] {
  const span = range.end - range.start;
  const byDay = span > DAY_MS;
  const stepHours = byDay ? 24 : (HOUR_STEPS.find((step) => span / (step * HOUR_MS) <= MAX_TICKS) ?? 12);
  const step = stepHours * HOUR_MS;
  // se alinea en hora de pared: las medianoches y horas redondas son las locales, no las de UTC
  const offset = zoneOffset(range.start, timeZone);
  const ticks: AxisTick[] = [];
  for (let wall = Math.ceil((range.start + offset) / step) * step; wall - offset <= range.end; wall += step) {
    ticks.push({ at: wall - offset, parts: byDay ? "day" : "time" });
  }
  return ticks;
}
```

- [ ] **Paso 3: crear `frontend/src/shared/valve-history.ts`**

```ts
import type { HistoryResponse, HistoryState, TimeSpan, Valve, Zone } from "../api";
import type { WindowRange } from "./time-window";

// encendidos reales de las válvulas: tiempo real = apagado real − encendido real (recorder de HA)

/** Un encendido, ya recortado a la ventana. */
export interface ValveRun extends TimeSpan {
  seconds: number;
  // sin apagado dentro de la ventana: sigue encendida al final
  ongoing: boolean;
  // ya estaba encendida al empezar la ventana
  startsBefore: boolean;
}

export interface ValveHistory {
  valve: Valve;
  // del más reciente al más antiguo
  runs: ValveRun[];
  seconds: number;
}

export interface ZoneHistory {
  zone: Zone;
  // todas las válvulas de la zona, también sin encendidos
  valves: ValveHistory[];
  seconds: number;
  count: number;
}

const ON = "on";

/** Encendidos de una switch en la ventana. Termina en el primer estado ≠ on (off, unavailable, unknown). */
export function valveRuns(states: HistoryState[], range: WindowRange): ValveRun[] {
  const runs: ValveRun[] = [];
  let onSince: number | undefined;
  const close = (at: number, ongoing: boolean) => {
    if (onSince === undefined) return;
    const start = Math.max(onSince, range.start);
    const end = Math.min(at, range.end);
    if (end > start) {
      runs.push({
        started_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        seconds: (end - start) / 1000,
        ongoing,
        // HA fecha el estado vigente en start_time con start_time: «≤» lo detecta
        startsBefore: onSince <= range.start,
      });
    }
    onSince = undefined;
  };
  for (const state of states) {
    const at = (state.lc ?? state.lu) * 1000;
    if (state.s === ON) onSince ??= at;
    else close(at, false);
  }
  close(range.end, true);
  return runs.reverse();
}

const total = (items: { seconds: number }[]) => items.reduce((sum, item) => sum + item.seconds, 0);

/** Histórico por zona en el orden recibido; las válvulas, en el orden de la configuración. */
export function buildHistory(history: HistoryResponse, zones: Zone[], range: WindowRange): ZoneHistory[] {
  return zones.map((zone) => {
    const valves = zone.valves.map((valve) => {
      const runs = valveRuns(history[valve.entity_id] ?? [], range);
      return { valve, runs, seconds: total(runs) };
    });
    const count = valves.reduce((sum, item) => sum + item.runs.length, 0);
    return { zone, valves, seconds: total(valves), count };
  });
}
```

- [ ] **Paso 4: check**

Run (en `frontend/`): `npx tsc --noEmit`
Expected: sin salida, código 0.

- [ ] **Paso 5: revisión inline**

- `MAX_WINDOW_DAYS` aparece definido solo en `time-window.ts`.
- `valve-history.ts` y `time-window.ts` no importan `lit` ni `i18n`.

- [ ] **Paso 6: commit**

```bash
git add frontend/src/api.ts frontend/src/shared/time-window.ts frontend/src/shared/valve-history.ts
git commit -F - <<'EOF'
feat(history): consulta al recorder, ventana de tiempo e intervalos de encendido

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L9SnZJg8GM9XfNz6GPmnka
EOF
```

---

### Tarea 3: Textos, selector de ventana y vistas

**Files:**
- Modify: `frontend/src/i18n.ts` (claves en `ES` y `EN`; `formatNextRun` y funciones nuevas)
- Create: `frontend/src/card/window-picker.ts`
- Create: `frontend/src/card/history-views.ts`

**Interfaces:**
- Consumes: todo lo producido en la Tarea 2; `CHEVRON_DOWN`, `CHEVRON_UP`, `svgIcon`, `fireEvent` de `shared/controls.ts`; `formatDuration` de `i18n.ts`.
- Produces:
  - `i18n.ts`: `DateTimeParts = "time" | "day" | "full"`, `formatDateTime(hass, ms, parts = "full")`, `sameDay(hass, a, b)`.
  - `<irrigation-window-picker .hass .window allow-range>` que emite `window-changed` con `detail: { window: TimeWindow }`.
  - `history-views.ts`: `HistoryView = "list" | "timeline" | "totals"`, `HISTORY_VIEWS`, `viewChips(hass, current, onPick)`, `historyList(hass, history, expanded, toggle, live)`, `historyTimeline(hass, history, range, live)`, `historyTotals(hass, history)`, `historyStyles`.

- [ ] **Paso 1: claves en `frontend/src/i18n.ts`**

En `ES`, tras `card_title` (línea 135):

```ts
  history_description: "Encendidos reales de las válvulas por zona.",
  history_view_list: "Lista",
  history_view_timeline: "Línea de tiempo",
  history_view_totals: "Totales",
  history_hours: "{n} h",
  history_days: "{n} d",
  history_custom: "Otra…",
  history_range: "Rango…",
  history_unit_hours: "horas",
  history_unit_days: "días",
  history_from: "Desde",
  history_to: "Hasta",
  history_empty: "Sin riegos en la ventana",
  history_unavailable: "Histórico no disponible",
  history_ongoing: "en curso",
  history_runs_one: "1 encendido",
  history_runs: "{n} encendidos",
  history_card_view: "Vista inicial",
  history_card_window: "Ventana inicial",
  history_card_help: "Datos del recorder de HA. Las switch excluidas del recorder aparecen sin riegos.",
```

En `EN`, tras `card_title` (línea 270):

```ts
  history_description: "Actual valve runs by zone.",
  history_view_list: "List",
  history_view_timeline: "Timeline",
  history_view_totals: "Totals",
  history_hours: "{n} h",
  history_days: "{n} d",
  history_custom: "Other…",
  history_range: "Range…",
  history_unit_hours: "hours",
  history_unit_days: "days",
  history_from: "From",
  history_to: "To",
  history_empty: "No runs in this window",
  history_unavailable: "History unavailable",
  history_ongoing: "ongoing",
  history_runs_one: "1 run",
  history_runs: "{n} runs",
  history_card_view: "Initial view",
  history_card_window: "Initial window",
  history_card_help: "Data from the HA recorder. Switches excluded from the recorder show no runs.",
```

- [ ] **Paso 2: formateo de fecha y hora en `frontend/src/i18n.ts`**

Sustituir `formatNextRun` entero por esto (mismo resultado; comparte los formateadores con `formatDateTime`):

```ts
function timeText(date: Date, timeZone: string, locale: Lang): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    date,
  );
}

function weekdayText(date: Date, timeZone: string, locale: Lang): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(date);
}

/** «Hoy 20:00», «Mañana 08:00» o «sáb 09:30», en la zona horaria de HA. */
export function formatNextRun(hass: Hass, iso: string | null): string {
  if (!iso) return "—";
  const timeZone = hass.config.time_zone;
  const locale = langOf(hass);
  const date = new Date(iso);
  const time = timeText(date, timeZone, locale);
  const now = new Date();
  if (dayKey(date, timeZone) === dayKey(now, timeZone)) return t(hass, "today", { time });
  if (dayKey(date, timeZone) === dayKey(new Date(now.getTime() + 86_400_000), timeZone)) {
    return t(hass, "tomorrow", { time });
  }
  return `${weekdayText(date, timeZone, locale)} ${time}`;
}

export type DateTimeParts = "time" | "day" | "full";

/** «07:00», «lun 29» o «lun 29 07:00», en la zona horaria de HA. */
export function formatDateTime(hass: Hass, ms: number, parts: DateTimeParts = "full"): string {
  const timeZone = hass.config.time_zone;
  const locale = langOf(hass);
  const date = new Date(ms);
  const time = timeText(date, timeZone, locale);
  if (parts === "time") return time;
  const dayOfMonth = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric" }).format(date);
  const day = `${weekdayText(date, timeZone, locale)} ${dayOfMonth}`;
  return parts === "day" ? day : `${day} ${time}`;
}

/** Mismo día de calendario en la zona horaria de HA. */
export function sameDay(hass: Hass, a: number, b: number): boolean {
  const timeZone = hass.config.time_zone;
  return dayKey(new Date(a), timeZone) === dayKey(new Date(b), timeZone);
}
```

- [ ] **Paso 3: crear `frontend/src/card/window-picker.ts`**

```ts
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
```

- [ ] **Paso 4: crear `frontend/src/card/history-views.ts`**

```ts
import { css, html, nothing, svg, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";

import type { Hass } from "../api";
import { formatDateTime, formatDuration, sameDay, t, type Key } from "../i18n";
import { CHEVRON_DOWN, CHEVRON_UP, svgIcon } from "../shared/controls";
import { axisTicks, type WindowRange } from "../shared/time-window";
import type { ValveHistory, ValveRun, ZoneHistory } from "../shared/valve-history";

// vistas del histórico: solo pintan ZoneHistory[]; el cálculo está en shared/valve-history.ts

export type HistoryView = "list" | "timeline" | "totals";
export const HISTORY_VIEWS: HistoryView[] = ["list", "timeline", "totals"];

const VIEW_KEYS: Record<HistoryView, Key> = {
  list: "history_view_list",
  timeline: "history_view_timeline",
  totals: "history_view_totals",
};

// ancho mínimo de barra en % del eje: un riego de segundos sigue viéndose (~2 px en una tarjeta estrecha)
const MIN_BAR = 0.6;

/** Chips de vista: en la tarjeta cambian la vista activa; en el editor, la inicial. */
export function viewChips(hass: Hass, current: HistoryView, onPick: (view: HistoryView) => void): TemplateResult {
  return html`<div class="chips">
    ${HISTORY_VIEWS.map(
      (view) =>
        html`<button class="chip ${view === current ? "on" : ""}" @click=${() => onPick(view)}>
          ${t(hass, VIEW_KEYS[view])}
        </button>`,
    )}
  </div>`;
}

const runsText = (hass: Hass, count: number) =>
  count === 1 ? t(hass, "history_runs_one") : t(hass, "history_runs", { n: count });

const emptyZone = (hass: Hass) => html`<div class="muted small empty">${t(hass, "history_empty")}</div>`;

const withRuns = (valves: ValveHistory[]) => valves.filter((item) => item.runs.length);

/** «← lun 29 07:00 → 07:29»; «→ en curso» si sigue encendida en una ventana que acaba ahora. */
function runText(hass: Hass, run: ValveRun, live: boolean): string {
  const start = Date.parse(run.started_at);
  const end = Date.parse(run.ends_at);
  const from = `${run.startsBefore ? "← " : ""}${formatDateTime(hass, start)}`;
  if (run.ongoing && live) return `${from} → ${t(hass, "history_ongoing")}`;
  const to = formatDateTime(hass, end, sameDay(hass, start, end) ? "time" : "full");
  // sigue encendida después del fin de un rango fijo
  return `${from} → ${to}${run.ongoing ? " →" : ""}`;
}

/** Zonas plegables con cada encendido, del más reciente al más antiguo. */
export function historyList(
  hass: Hass,
  history: ZoneHistory[],
  expanded: Set<string>,
  toggle: (zoneId: string) => void,
  live: boolean,
): TemplateResult {
  const valveBlock = ({ valve, runs }: ValveHistory) => html`<div class="h-valve">
    <div class="h-valve-name">${valve.name}</div>
    ${runs.map(
      (run) =>
        html`<div class="h-run small">
          <span>${runText(hass, run, live)}</span><span class="muted">${formatDuration(run.seconds)}</span>
        </div>`,
    )}
  </div>`;
  return html`${history.map(({ zone, valves, seconds, count }) => {
    const open = expanded.has(zone.zone_id);
    let body: unknown = nothing;
    if (open) body = count ? withRuns(valves).map(valveBlock) : emptyZone(hass);
    return html`<div class="h-zone">
      <button class="h-zone-row" aria-expanded=${open ? "true" : "false"} @click=${() => toggle(zone.zone_id)}>
        ${svgIcon(open ? CHEVRON_UP : CHEVRON_DOWN)}
        <span class="h-name">${zone.name}</span>
        <span class="small muted">${count} · ${formatDuration(seconds)}</span>
      </button>
      ${body}
    </div>`;
  })}`;
}

const position = (range: WindowRange, ms: number) => ((ms - range.start) / (range.end - range.start)) * 100;

/** Una fila por válvula con encendidos: barras sobre el eje de la ventana, sin scroll horizontal. */
export function historyTimeline(hass: Hass, history: ZoneHistory[], range: WindowRange, live: boolean): TemplateResult {
  const ticks = axisTicks(range, hass.config.time_zone);
  const bars = (runs: ValveRun[]) =>
    runs.map((run) => {
      const x = position(range, Date.parse(run.started_at));
      const width = Math.max(MIN_BAR, position(range, Date.parse(run.ends_at)) - x);
      return svg`<rect class=${run.ongoing ? "ongoing" : ""} x=${x} y="0" width=${width} height="10">
        <title>${runText(hass, run, live)} · ${formatDuration(run.seconds)}</title>
      </rect>`;
    });
  const grid = ticks.map((tick) => {
    const x = position(range, tick.at);
    return svg`<line x1=${x} x2=${x} y1="0" y2="10"></line>`;
  });
  const row = ({ valve, runs }: ValveHistory) => html`<div class="tl-row">
    <span class="tl-label small">${valve.name}</span>
    <svg class="tl-bars" viewBox="0 0 100 10" preserveAspectRatio="none">${grid}${bars(runs)}</svg>
  </div>`;
  return html`<div class="tl-row tl-axis">
      <span></span>
      <div class="tl-track">
        ${ticks.map(
          (tick) =>
            html`<span class="tl-tick small muted" style=${styleMap({ left: `${position(range, tick.at)}%` })}>
              ${formatDateTime(hass, tick.at, tick.parts)}
            </span>`,
        )}
      </div>
    </div>
    ${history.map(
      ({ zone, valves, count }) =>
        html`<div class="tl-zone">${zone.name}</div>
          ${count ? withRuns(valves).map(row) : emptyZone(hass)}`,
    )}`;
}

/** Recuento y tiempo total por zona y por válvula; muestra también las válvulas sin encendidos. */
export function historyTotals(hass: Hass, history: ZoneHistory[]): TemplateResult {
  return html`<div class="totals">
    ${history.map(
      ({ zone, valves, seconds, count }) =>
        html`<span class="t-zone">${zone.name}</span>
          <span class="t-zone">${runsText(hass, count)}</span>
          <span class="t-zone t-time">${formatDuration(seconds)}</span>
          ${valves.map(
            (item) =>
              html`<span class="t-valve">${item.valve.name}</span>
                <span class="muted">${item.runs.length}</span>
                <span class="t-time">${formatDuration(item.seconds)}</span>`,
          )}`,
    )}
  </div>`;
}

export const historyStyles = css`
  .empty {
    padding: 4px 0 8px 28px;
  }
  .h-zone + .h-zone {
    border-top: 1px solid var(--divider-color);
  }
  button.h-zone-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 0;
    border: none;
    border-radius: 0;
    text-align: left;
    color: var(--primary-text-color);
  }
  .h-name {
    flex: 1;
    min-width: 0;
    font-weight: 500;
  }
  .h-valve {
    padding: 0 0 8px 28px;
  }
  .h-run {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 0;
  }
  .tl-row {
    display: grid;
    grid-template-columns: minmax(0, 35%) 1fr;
    gap: 8px;
    align-items: center;
    padding: 2px 0;
  }
  .tl-track {
    position: relative;
    height: 1.4em;
  }
  .tl-tick {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .tl-zone {
    font-weight: 500;
    margin-top: 8px;
  }
  .tl-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tl-bars {
    display: block;
    width: 100%;
    height: 12px;
    border-radius: 2px;
    background: var(--secondary-background-color);
  }
  .tl-bars rect {
    fill: var(--primary-color);
  }
  .tl-bars rect.ongoing {
    fill: var(--accent-color);
  }
  .tl-bars line {
    stroke: var(--divider-color);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .totals {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 4px 12px;
  }
  .t-zone {
    font-weight: 500;
    margin-top: 8px;
  }
  .t-valve {
    padding-left: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .t-time {
    text-align: right;
  }
`;
```

- [ ] **Paso 5: check**

Run (en `frontend/`): `npx tsc --noEmit`
Expected: sin salida, código 0.

- [ ] **Paso 6: revisión inline**

- `history-views.ts` no suma segundos ni recorta intervalos: solo lee `seconds`, `count` y `runs`.
- `window-picker.ts` no calcula límites propios: usa `maxAmount`, `MAX_WINDOW_MS` y `resolveWindow`.
- `formatNextRun` devuelve lo mismo que antes (hoy/mañana/`weekday time`).

- [ ] **Paso 7: commit**

```bash
git add frontend/src/i18n.ts frontend/src/card/window-picker.ts frontend/src/card/history-views.ts
git commit -F - <<'EOF'
feat(history): selector de ventana, vistas lista/línea de tiempo/totales y textos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L9SnZJg8GM9XfNz6GPmnka
EOF
```

---

### Tarea 4: Tarjeta, editor, registro y bundle

**Files:**
- Create: `frontend/src/card/history-card.ts`
- Create: `frontend/src/card/history-editor.ts`
- Modify: `frontend/src/main.ts`
- Regenerate: `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`

**Interfaces:**
- Consumes: Tareas 1-3 (`cardZoneIds`, `parseCardZones`, `storeNotice`, `changeCardConfig`, `zonePicker`, `titleField`, `cardConfigStyles`, `registerCard`, `fetchValveHistory`, `HistoryResponse`, `parseWindow`, `resolveWindow`, `TimeWindow`, `WindowUnit`, `buildHistory`, `viewChips`, `historyList`, `historyTimeline`, `historyTotals`, `historyStyles`, `HISTORY_VIEWS`, `HistoryView`, `<irrigation-window-picker>`).
- Produces: `HISTORY_CARD_TYPE = "irrigation-history-card"`, `HistoryCardConfig`, elementos `irrigation-history-card` e `irrigation-history-card-editor`.

- [ ] **Paso 1: crear `frontend/src/card/history-card.ts`**

```ts
import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { fetchValveHistory, type Hass, type HistoryResponse, type Snapshot, type Zone } from "../api";
import { t } from "../i18n";
import { SnapshotController, TickController } from "../store";
import { cardZoneIds, parseCardZones, storeNotice } from "../shared/card-config";
import { define, registerCard } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { parseWindow, resolveWindow, type TimeWindow, type WindowUnit } from "../shared/time-window";
import { buildHistory } from "../shared/valve-history";
import {
  HISTORY_VIEWS,
  historyList,
  historyStyles,
  historyTimeline,
  historyTotals,
  viewChips,
  type HistoryView,
} from "./history-views";
import "./window-picker";

export const HISTORY_CARD_TYPE = "irrigation-history-card";
// el snapshot llega en cada cambio de válvula: una ráfaga se agrupa en una sola consulta
const RELOAD_DEBOUNCE_MS = 2000;

export interface HistoryCardConfig {
  type: string;
  zones: string[];
  title?: string;
  // iniciales: después mandan los chips de la tarjeta
  view?: HistoryView;
  window?: { amount: number; unit: WindowUnit };
}

/** Histórico de encendidos reales por zona, desde el recorder de HA. */
export class HistoryCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _view: { state: true },
    _window: { state: true },
    _history: { state: true },
    _error: { state: true },
    _expanded: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: HistoryCardConfig | undefined;
  declare _view: HistoryView;
  declare _window: TimeWindow;
  // undefined = cargando
  declare _history: HistoryResponse | undefined;
  declare _error: boolean;
  // se sustituye por un Set nuevo en cada cambio para que Lit lo detecte
  declare _expanded: Set<string>;

  private readonly store = new SnapshotController(this);
  // consulta vigente: entidades + ventana; si cambia, se vuelve a pedir
  private fetchKey?: string;
  private lastSnapshot?: Snapshot;
  // descarta respuestas de consultas anteriores a la vigente
  private seq = 0;
  private reloadTimer?: number;

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
    this._view = "list";
    this._window = parseWindow(undefined);
    this._history = undefined;
    this._error = false;
    this._expanded = new Set();
    // las duraciones «en curso» avanzan sin volver a consultar
    new TickController(this);
  }

  setConfig(config: HistoryCardConfig): void {
    this._config = { ...config, zones: parseCardZones(config?.zones) };
    this._view = HISTORY_VIEWS.includes(config?.view as HistoryView) ? (config.view as HistoryView) : "list";
    this._window = parseWindow(config?.window);
  }

  getCardSize(): number {
    return 4;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(`${HISTORY_CARD_TYPE}-editor`);
  }

  static getStubConfig(): HistoryCardConfig {
    return { type: `custom:${HISTORY_CARD_TYPE}`, zones: [] };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.reloadTimer);
    // al volver al DOM se consulta de nuevo
    this.fetchKey = undefined;
  }

  /** Zonas elegidas que existen, en el orden de la tarjeta; una que ya no existe se omite. */
  private zones(snapshot: Snapshot): Zone[] {
    return cardZoneIds(this._config?.zones ?? [], snapshot.zones).flatMap((zoneId) =>
      snapshot.zones.filter((zone) => zone.zone_id === zoneId),
    );
  }

  protected updated(): void {
    const snapshot = this.store.state.snapshot;
    if (!this.hass || !this._config || !snapshot) return;
    const entityIds = this.zones(snapshot).flatMap((zone) => zone.valves.map((valve) => valve.entity_id));
    const key = `${entityIds.join(",")}|${JSON.stringify(this._window)}`;
    if (key !== this.fetchKey) {
      this.fetchKey = key;
      this.lastSnapshot = snapshot;
      void this.load(entityIds, true);
      return;
    }
    if (snapshot !== this.lastSnapshot) {
      this.lastSnapshot = snapshot;
      // un rango fijo es pasado: no cambia
      if (this._window.kind === "relative") this.scheduleReload(entityIds);
    }
  }

  private scheduleReload(entityIds: string[]): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(entityIds, false), RELOAD_DEBOUNCE_MS);
  }

  /** `reset`: vacía lo mostrado mientras carga (cambio de ventana o de zonas). */
  private async load(entityIds: string[], reset: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    window.clearTimeout(this.reloadTimer);
    const seq = ++this.seq;
    if (reset) this._history = undefined;
    const range = resolveWindow(this._window, Date.now());
    try {
      const history = entityIds.length ? await fetchValveHistory(hass, entityIds, range.start, range.end) : {};
      if (seq !== this.seq) return;
      this._history = history;
      this._error = false;
    } catch {
      if (seq === this.seq) this._error = true;
    }
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
    const { snapshot } = this.store.state;
    const body = storeNotice(hass, this.store.state) ?? (snapshot ? this.renderHistory(hass, snapshot) : nothing);
    return html`<ha-card .header=${config.title}>
      <div class="card-content">
        ${snapshot && !hass.connected ? html`<div class="banner error">${t(hass, "disconnected")}</div>` : nothing}
        ${viewChips(hass, this._view, (view) => {
          this._view = view;
        })}
        <irrigation-window-picker
          allow-range
          .hass=${hass}
          .window=${this._window}
          @window-changed=${(ev: CustomEvent<{ window: TimeWindow }>) => {
            this._window = ev.detail.window;
          }}
        ></irrigation-window-picker>
        <div class="view">${body}</div>
      </div>
    </ha-card>`;
  }

  private renderHistory(hass: Hass, snapshot: Snapshot): TemplateResult {
    if (this._error) return html`<div class="muted">${t(hass, "history_unavailable")}</div>`;
    if (!this._history) return html`<div class="muted">${t(hass, "loading")}</div>`;
    const zones = this.zones(snapshot);
    if (!zones.length) return html`<div class="muted">${t(hass, "empty_list")}</div>`;
    const range = resolveWindow(this._window, Date.now());
    const history = buildHistory(this._history, zones, range);
    const live = this._window.kind === "relative";
    switch (this._view) {
      case "list":
        return historyList(hass, history, this._expanded, (zoneId) => this.toggle(zoneId), live);
      case "timeline":
        return historyTimeline(hass, history, range, live);
      case "totals":
        return historyTotals(hass, history);
    }
  }

  static styles = [
    sharedStyles,
    historyStyles,
    css`
      .card-content {
        padding: 0 16px 8px;
      }
      ha-card:not([header]) .card-content {
        padding-top: 8px;
      }
      irrigation-window-picker {
        margin: 8px 0;
      }
      .view {
        border-top: 1px solid var(--divider-color);
        padding-top: 8px;
      }
    `,
  ];
}

define(HISTORY_CARD_TYPE, HistoryCard);

registerCard({
  type: HISTORY_CARD_TYPE,
  name: "Irrigation Scheduler History",
  description: t(undefined, "history_description"),
  preview: true,
});
```

- [ ] **Paso 2: crear `frontend/src/card/history-editor.ts`**

```ts
import { css, html, LitElement, nothing } from "lit";

import type { Hass } from "../api";
import { t } from "../i18n";
import { SnapshotController } from "../store";
import { cardConfigStyles, changeCardConfig, titleField, zonePicker } from "../shared/card-config";
import { define, loadHaComponents } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { parseWindow, type TimeWindow } from "../shared/time-window";
import { HISTORY_CARD_TYPE, type HistoryCardConfig } from "./history-card";
import { viewChips } from "./history-views";
import "./window-picker";

/** Editor visual de la tarjeta de histórico. */
export class HistoryEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  declare hass: Hass | undefined;
  declare _config: HistoryCardConfig | undefined;

  private readonly store = new SnapshotController(this);

  constructor() {
    super();
    this.hass = undefined;
    this._config = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadHaComponents().then(() => this.requestUpdate());
  }

  setConfig(config: HistoryCardConfig): void {
    this._config = { ...config, zones: Array.isArray(config.zones) ? [...config.zones] : [] };
  }

  // nunca «update»: pisaría el método de ciclo de vida de LitElement
  private changeConfig(patch: Partial<HistoryCardConfig>): void {
    if (this._config) this._config = changeCardConfig(this, this._config, patch);
  }

  protected render() {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return nothing;
    const zones = this.store.state.snapshot?.zones ?? [];
    return html`
      ${zonePicker(hass, zones, config.zones, (next) => this.changeConfig({ zones: next }))}
      <div class="section">
        <div class="label">${t(hass, "history_card_view")}</div>
        ${viewChips(hass, config.view ?? "list", (view) => this.changeConfig({ view }))}
      </div>
      <div class="section">
        <div class="label">${t(hass, "history_card_window")}</div>
        <irrigation-window-picker
          .hass=${hass}
          .window=${parseWindow(config.window)}
          @window-changed=${(ev: CustomEvent<{ window: TimeWindow }>) => {
            const window = ev.detail.window;
            // sin allow-range solo llegan ventanas relativas; el rango no se guarda en la configuración
            if (window.kind === "relative") this.changeConfig({ window: { amount: window.amount, unit: window.unit } });
          }}
        ></irrigation-window-picker>
      </div>
      ${titleField(hass, config.title, (title) => this.changeConfig({ title }))}
      <div class="muted small help">${t(hass, "history_card_help")}</div>
    `;
  }

  static styles = [
    sharedStyles,
    cardConfigStyles,
    css`
      :host {
        display: block;
      }
      .help {
        margin-top: 8px;
      }
    `,
  ];
}

define(`${HISTORY_CARD_TYPE}-editor`, HistoryEditor);
```

- [ ] **Paso 3: `frontend/src/main.ts`** (fichero entero)

```ts
// entrada del bundle: panel lateral y tarjetas Lovelace
import "./panel/irrigation-panel";
import "./card/irrigation-card";
import "./card/card-editor";
import "./card/history-card";
import "./card/history-editor";
```

- [ ] **Paso 4: checks finales** (en `frontend/`)

Run: `npx tsc --noEmit`
Expected: sin salida, código 0.

Run: `npm run lint`
Expected: sin errores ni avisos.

Run: `npm run build`
Expected: termina sin errores ni avisos y reescribe `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`.

- [ ] **Paso 5: revisión inline**

- `history-card.ts` no recorta intervalos ni suma tiempos: llama a `buildHistory`.
- `grep -rn "MAX_WINDOW_DAYS = " frontend/src` → un solo resultado (`shared/time-window.ts`).
- `grep -rn "customCards" frontend/src` → solo en `shared/ha-components.ts`.
- El rango absoluto nunca llega a `changeConfig` del editor.

- [ ] **Paso 6: commit**

```bash
git add frontend/src/card/history-card.ts frontend/src/card/history-editor.ts frontend/src/main.ts custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js
git commit -F - <<'EOF'
feat(history): tarjeta Lovelace de histórico de riego con su editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01L9SnZJg8GM9XfNz6GPmnka
EOF
```

---

## Validación en HA (usuario)

Añadir la tarjeta «Irrigation Scheduler History»; cambiar de vista; probar 6 h, 24 h, 3 d, 7 d, «Otra» y «Rango»; ver un riego en curso; encender una válvula a mano desde HA y comprobar que aparece.
