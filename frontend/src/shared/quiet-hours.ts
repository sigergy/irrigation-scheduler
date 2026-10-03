import type { Hass, Settings } from "../api";
import { t } from "../i18n";

// espejo de domain/schedule.py (in_quiet_hours, quiet_end_after): misma franja, hora de reloj de HA

const DAY_MIN = 24 * 60;

/** Minuto del día de un «HH:MM»; null si no tiene ese formato. */
export function minutesOf(value: string | null): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
}

/** (inicio, fin) en minutos, con fin > inicio si cruza medianoche; null = sin franja. */
function quietWindow(settings: Settings): [number, number] | null {
  const start = minutesOf(settings.quiet_start);
  const end = minutesOf(settings.quiet_end);
  if (start === null || end === null || start === end) return null;
  return [start, end > start ? end : end + DAY_MIN];
}

/** Hay franja silenciosa configurada y válida. */
export function quietActive(settings: Settings): boolean {
  return quietWindow(settings) !== null;
}

/** «23:00–07:00» si hay franja; null si no. */
export function quietRange(settings: Settings): string | null {
  return quietActive(settings) ? `${settings.quiet_start}–${settings.quiet_end}` : null;
}

/** Minuto del día de `date` en la zona horaria de HA. */
function minuteOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return pick("hour") * 60 + pick("minute");
}

/** La hora de reloj de `date` cae en [inicio, fin), contando el cruce de medianoche. */
export function inQuietHours(settings: Settings, date: Date, timeZone: string): boolean {
  const window = quietWindow(settings);
  if (!window) return false;
  const [start, end] = window;
  const now = minuteOfDay(date, timeZone);
  return (start <= now && now < end) || (start <= now + DAY_MIN && now + DAY_MIN < end);
}

/** «HH:MM» en que acaba la franja si `date` está dentro de ella; null si no. */
export function quietEndIfInside(settings: Settings, date: Date, timeZone: string): string | null {
  return inQuietHours(settings, date, timeZone) ? settings.quiet_end : null;
}

/** Aviso del riego manual: dentro de la franja la orden espera a su fin. Se evalúa al pulsar. */
export function quietNotice(settings: Settings): (hass: Hass) => string | null {
  return (hass) => {
    const end = quietEndIfInside(settings, new Date(), hass.config.time_zone);
    return end ? t(hass, "quiet_manual_notice", { time: end }) : null;
  };
}
