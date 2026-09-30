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
const DAY_STEPS = [1, 2, 3];
// sin ancho medido: 7 etiquetas, lo que cabe en escritorio
export const DEFAULT_MAX_LABELS = 7;

/**
 * Marcas del eje: horas redondas si la ventana es ≤ 24 h, medianoches si es mayor; en hora de HA.
 * El paso es el menor que deja como mucho `maxLabels` etiquetas; si ninguno basta, el mayor.
 */
export function axisTicks(range: WindowRange, timeZone: string, maxLabels = DEFAULT_MAX_LABELS): AxisTick[] {
  const span = range.end - range.start;
  const byDay = span > DAY_MS;
  const [steps, unit] = byDay ? [DAY_STEPS, DAY_MS] : [HOUR_STEPS, HOUR_MS];
  // n intervalos dan hasta n + 1 etiquetas
  const intervals = Math.max(1, maxLabels - 1);
  const step = (steps.find((item) => span / (item * unit) <= intervals) ?? steps[steps.length - 1]) * unit;
  // se alinea en hora de pared: las medianoches y horas redondas son las locales, no las de UTC
  const offset = zoneOffset(range.start, timeZone);
  const ticks: AxisTick[] = [];
  for (let wall = Math.ceil((range.start + offset) / step) * step; wall - offset <= range.end; wall += step) {
    ticks.push({ at: wall - offset, parts: byDay ? "day" : "time" });
  }
  return ticks;
}

export interface AxisDay {
  at: number;
  // posición en el eje, de 0 a 1
  x: number;
  // true: medianoche local (lleva raya); false: fecha del inicio de la ventana
  midnight: boolean;
}

// separación mínima (fracción del eje) entre la fecha del inicio y la primera medianoche
const DAY_LABEL_GAP = 0.15;

/** Fechas del eje en ventanas ≤ 24 h: la del inicio y la de cada medianoche; en las mayores ya van en las marcas. */
export function axisDays(range: WindowRange, timeZone: string): AxisDay[] {
  const span = range.end - range.start;
  if (span > DAY_MS) return [];
  // misma alineación en hora de pared que axisTicks
  const offset = zoneOffset(range.start, timeZone);
  const days: AxisDay[] = [];
  for (let wall = Math.ceil((range.start + offset) / DAY_MS) * DAY_MS; wall - offset <= range.end; wall += DAY_MS) {
    days.push({ at: wall - offset, x: (wall - offset - range.start) / span, midnight: true });
  }
  // la fecha del inicio se omite si la primera medianoche está tan cerca que se solaparían
  if (!days.length || days[0].x >= DAY_LABEL_GAP) days.unshift({ at: range.start, x: 0, midnight: false });
  return days;
}
