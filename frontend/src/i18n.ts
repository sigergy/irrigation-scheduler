import type { Hass, Issue } from "./api";

// textos ES/EN (02 §6); cualquier idioma distinto de es → inglés

const ES = {
  title: "Riego",
  tab_zones: "Zonas",
  tab_settings: "Ajustes",
  pause_all: "Pausar todo",
  status_running: "Regando",
  status_queued: "En cola",
  status_idle: "Programada",
  status_stopped: "Detenida",
  status_manual: "Regando (manual)",
  action_run: "Regar",
  action_resume: "Reactivar",
  action_pause: "Pausar",
  action_stop: "Detener",
  zone_run: "Regar zona",
  zone_resume: "Reactivar zona",
  zone_pause: "Pausar zona",
  zone_stop: "Detener zona",
  disconnected: "Sin conexión con HA",
  not_loaded: "Irrigation Scheduler no está configurado",
  load_error: "No se ha podido cargar el estado del riego. Se reintenta cada 30 s.",
  loading: "Cargando…",
  command_failed: "No se ha podido ejecutar la orden",
  every_day: "Todos los días",
  no_times: "Sin horas",
  valves_one: "1 válvula",
  valves_count: "{n} válvulas",
  today: "Hoy {time}",
  tomorrow: "Mañana {time}",
  remaining: "quedan {time}",
  minutes_short: "{n} min",
  add_zone: "＋ Zona",
  empty_list: "Aún no hay zonas.",
  zone_not_found: "Zona no encontrada",
  new_zone: "Zona nueva",
  back: "Volver",
  cancel: "Cancelar",
  confirm_remove: "Quitar",
  confirm_delete_action: "Borrar",
  confirm_leave_action: "Salir",
  confirm_discard_action: "Descartar",
  save: "Guardar",
  delete_zone: "🗑 Borrar zona",
  confirm_leave: "Hay cambios sin guardar. ¿Salir sin guardar?",
  confirm_delete: "¿Borrar la zona «{name}»? Se apagan sus válvulas abiertas.",
  confirm_discard_settings: "Hay cambios sin guardar en Ajustes. ¿Descartarlos?",
  saved: "Zona guardada",
  not_saved: "No se ha guardado: revisa los campos marcados.",
  external_change: "Esta zona ha cambiado fuera del editor.",
  reload: "Recargar",
  zone_deleted: "La zona se ha borrado.",
  read_only: "Solo lectura: editar requiere ser administrador.",
  field_name: "Nombre",
  rain: "Lluvia",
  rain_skip: "Omitir por lluvia",
  rain_skip_help: "Si llueve lo configurado en Ajustes › Lluvia, esta zona no riega en sus bloques.",
  mode: "Modo",
  mode_manual: "Manual",
  mode_auto: "Auto",
  auto_help: "Auto requiere un método de cálculo (fase 6).",
  days: "Días",
  start_times: "Bloques de inicio",
  add_time: "＋ Hora",
  max_simultaneous: "Válvulas a la vez en la zona",
  next_run: "Próximo riego: {when}",
  valves: "Válvulas",
  queue_order: "el orden es el orden de cola",
  add_valve: "＋ Añadir",
  col_name: "Nombre",
  col_entity: "Entidad",
  col_minutes: "Minutos",
  col_blocks: "Bloques",
  col_status: "Estado",
  valve_name: "Nombre",
  valve_minutes: "Min",
  manual_only: "Solo manual",
  add_times_first: "Añade horas a la zona",
  remove_valve: "Quitar válvula",
  new_valve: "sin nombre",
  confirm_remove_valve: "¿Quitar la válvula «{name}» de la zona? El cambio se aplica al guardar.",
  drag: "Arrastrar para ordenar",
  picker_help: "El selector de switch oculta las ya usadas en cualquier zona.",
  status_after_save: "Estado y botones ▶ ⏸ ■ aparecen tras el primer guardado.",
  no_valves: "Sin válvulas.",
  rule_name: "Pon un nombre",
  rule_V1: "Elige una entidad switch",
  rule_V2: "Al menos 1 minuto",
  rule_V3: "Bloque que no es de la zona",
  rule_V4: "Elige al menos un día",
  rule_V5: "Añade al menos una hora de inicio",
  rule_V6: "Hora repetida",
  rule_V7: "Esta switch ya está en otra válvula",
  rule_V8: "Auto requiere un método de cálculo",
  rule_V9: "Debe ser 1 o más",
  rule_V12: "Pon un nombre a la válvula",
  rule_time: "Hora no válida",
  rule_entity: "Entidad no válida",
  rule_notify: "Destino no válido",
  rule_hours_24: "Entre 1 y 24",
  rule_hours_48: "Entre 1 y 48",
  rule_positive: "Debe ser mayor que 0",
  rule_unknown: "Valor no válido",
  concurrency: "Simultaneidad",
  limit_global: "Limitar válvulas abiertas en toda la instalación",
  global_max: "Máximo global",
  global_off_help: "Desactivado = sin límite global.",
  notifications: "Notificaciones",
  notifications_help: "Avisos de fallos de válvula. Solo servicios notify.mobile_app_*.",
  add_target: "＋ Destino",
  no_targets: "No hay dispositivos móviles con la app de HA.",
  rain_help:
    "Solo en las zonas con «Omitir por lluvia». Un bloque no riega si se cumple cualquiera de las dos condiciones. La orden manual siempre riega.",
  rain_past: "Lluvia ya caída",
  rain_sensor: "Pluviómetro: sensor de lluvia acumulada en mm (opcional)",
  rain_past_hours: "Mirar las últimas… (horas, 1–24)",
  rain_past_threshold: "No regar si han caído al menos… (mm)",
  rain_past_rule: "No riega si han caído {mm} mm o más en las últimas {hours} horas.",
  rain_forecast: "Lluvia prevista",
  weather_entity: "Previsión: entidad weather (opcional)",
  rain_forecast_hours: "Mirar las próximas… (horas, 1–48)",
  rain_forecast_threshold: "No regar si se prevén al menos… (mm)",
  rain_forecast_rule: "No riega si se prevén {mm} mm o más en las próximas {hours} horas.",
  settings_saved: "Ajustes guardados",
  settings_not_saved: "No se han guardado los ajustes: revisa los campos marcados.",
  card_description: "Estado y control de las zonas de riego.",
  card_no_zones: "Elige al menos una zona en el editor de la tarjeta.",
  card_zones: "Zonas",
  card_order_help: "El orden de los chips es el orden en la tarjeta.",
  card_title: "Título (opcional)",
};

export type Key = keyof typeof ES;

const EN: Record<Key, string> = {
  title: "Irrigation",
  tab_zones: "Zones",
  tab_settings: "Settings",
  pause_all: "Pause all",
  status_running: "Watering",
  status_queued: "Queued",
  status_idle: "Scheduled",
  status_stopped: "Stopped",
  status_manual: "Watering (manual)",
  action_run: "Water",
  action_resume: "Re-enable",
  action_pause: "Pause",
  action_stop: "Stop",
  zone_run: "Water zone",
  zone_resume: "Re-enable zone",
  zone_pause: "Pause zone",
  zone_stop: "Stop zone",
  disconnected: "No connection to HA",
  not_loaded: "Irrigation Scheduler is not configured",
  load_error: "Could not load the irrigation state. Retrying every 30 s.",
  loading: "Loading…",
  command_failed: "The command could not be run",
  every_day: "Every day",
  no_times: "No times",
  valves_one: "1 valve",
  valves_count: "{n} valves",
  today: "Today {time}",
  tomorrow: "Tomorrow {time}",
  remaining: "{time} left",
  minutes_short: "{n} min",
  add_zone: "＋ Zone",
  empty_list: "No zones yet.",
  zone_not_found: "Zone not found",
  new_zone: "New zone",
  back: "Back",
  cancel: "Cancel",
  confirm_remove: "Remove",
  confirm_delete_action: "Delete",
  confirm_leave_action: "Leave",
  confirm_discard_action: "Discard",
  save: "Save",
  delete_zone: "🗑 Delete zone",
  confirm_leave: "There are unsaved changes. Leave without saving?",
  confirm_delete: "Delete zone «{name}»? Its open valves are turned off.",
  confirm_discard_settings: "There are unsaved changes in Settings. Discard them?",
  saved: "Zone saved",
  not_saved: "Not saved: check the highlighted fields.",
  external_change: "This zone changed outside the editor.",
  reload: "Reload",
  zone_deleted: "The zone was deleted.",
  read_only: "Read only: editing requires an administrator.",
  field_name: "Name",
  rain: "Rain",
  rain_skip: "Skip on rain",
  rain_skip_help: "If it rains as configured in Settings › Rain, this zone does not water in its blocks.",
  mode: "Mode",
  mode_manual: "Manual",
  mode_auto: "Auto",
  auto_help: "Auto requires a calculation method (phase 6).",
  days: "Days",
  start_times: "Start blocks",
  add_time: "＋ Time",
  max_simultaneous: "Valves at once in the zone",
  next_run: "Next run: {when}",
  valves: "Valves",
  queue_order: "order is queue order",
  add_valve: "＋ Add",
  col_name: "Name",
  col_entity: "Entity",
  col_minutes: "Minutes",
  col_blocks: "Blocks",
  col_status: "Status",
  valve_name: "Name",
  valve_minutes: "Min",
  manual_only: "Manual only",
  add_times_first: "Add times to the zone",
  remove_valve: "Remove valve",
  new_valve: "unnamed",
  confirm_remove_valve: "Remove valve «{name}» from the zone? The change applies on save.",
  drag: "Drag to reorder",
  picker_help: "The switch picker hides switches already used in any zone.",
  status_after_save: "Status and ▶ ⏸ ■ buttons appear after the first save.",
  no_valves: "No valves.",
  rule_name: "Enter a name",
  rule_V1: "Choose a switch entity",
  rule_V2: "At least 1 minute",
  rule_V3: "Block not in the zone",
  rule_V4: "Pick at least one day",
  rule_V5: "Add at least one start time",
  rule_V6: "Duplicate time",
  rule_V7: "This switch is already used by another valve",
  rule_V8: "Auto requires a calculation method",
  rule_V9: "Must be 1 or more",
  rule_V12: "Name the valve",
  rule_time: "Invalid time",
  rule_entity: "Invalid entity",
  rule_notify: "Invalid target",
  rule_hours_24: "Between 1 and 24",
  rule_hours_48: "Between 1 and 48",
  rule_positive: "Must be greater than 0",
  rule_unknown: "Invalid value",
  concurrency: "Concurrency",
  limit_global: "Limit open valves across the whole installation",
  global_max: "Global maximum",
  global_off_help: "Off = no global limit.",
  notifications: "Notifications",
  notifications_help: "Valve failure alerts. Only notify.mobile_app_* services.",
  add_target: "＋ Target",
  no_targets: "No mobile devices with the HA app.",
  rain_help:
    "Only for zones with «Skip on rain». A block does not water if either condition is met. A manual command always waters.",
  rain_past: "Rain already fallen",
  rain_sensor: "Rain gauge: accumulated rain sensor in mm (optional)",
  rain_past_hours: "Look back over the last… (hours, 1–24)",
  rain_past_threshold: "Don't water if at least this fell… (mm)",
  rain_past_rule: "Does not water if {mm} mm or more fell in the last {hours} hours.",
  rain_forecast: "Forecast rain",
  weather_entity: "Forecast: weather entity (optional)",
  rain_forecast_hours: "Look ahead over the next… (hours, 1–48)",
  rain_forecast_threshold: "Don't water if at least this is forecast… (mm)",
  rain_forecast_rule: "Does not water if {mm} mm or more is forecast in the next {hours} hours.",
  settings_saved: "Settings saved",
  settings_not_saved: "Settings not saved: check the highlighted fields.",
  card_description: "Status and control of irrigation zones.",
  card_no_zones: "Pick at least one zone in the card editor.",
  card_zones: "Zones",
  card_order_help: "Chip order is the order in the card.",
  card_title: "Title (optional)",
};

type Lang = "es" | "en";

function langOf(hass?: Hass): Lang {
  // sin hass (setConfig de la tarjeta): el idioma del documento
  const language = hass?.locale?.language ?? hass?.language ?? document.documentElement.lang;
  return language?.startsWith("es") ? "es" : "en";
}

export function t(hass: Hass | undefined, key: Key, vars: Record<string, string | number> = {}): string {
  const text = langOf(hass) === "es" ? ES[key] : EN[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function dayLetters(hass: Hass): string[] {
  return langOf(hass) === "es" ? ["L", "M", "X", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
}

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

/** «Hoy 20:00», «Mañana 08:00» o «sáb 09:30», en la zona horaria de HA. */
export function formatNextRun(hass: Hass, iso: string | null): string {
  if (!iso) return "—";
  const timeZone = hass.config.time_zone;
  const locale = langOf(hass);
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    date,
  );
  const now = new Date();
  if (dayKey(date, timeZone) === dayKey(now, timeZone)) return t(hass, "today", { time });
  if (dayKey(date, timeZone) === dayKey(new Date(now.getTime() + 86_400_000), timeZone)) {
    return t(hass, "tomorrow", { time });
  }
  const day = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(date);
  return `${day} ${time}`;
}

/** 372 → «6:12»; 3725 → «1:02:05». */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** Texto de un error de validación del backend para mostrarlo bajo su campo. */
export function ruleMessage(hass: Hass, issue: Issue): string {
  if (issue.rule === "V10" || issue.rule === "V11") {
    const field = String(issue.path[issue.path.length - 1]);
    if (field.endsWith("_hours")) return t(hass, issue.rule === "V10" ? "rule_hours_24" : "rule_hours_48");
    return t(hass, "rule_positive");
  }
  const key = `rule_${issue.rule}`;
  return key in ES ? t(hass, key as Key) : t(hass, "rule_unknown");
}

/** errors[] del backend → mensaje por campo, con la ruta unida por puntos («valves.2.name»). */
export function issueMap(hass: Hass, issues: Issue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) map[issue.path.join(".")] ??= ruleMessage(hass, issue);
  return map;
}
