import type { AlertConfig, AlertPriority, Settings } from "./api";
import type { Key } from "./i18n";

// copia de ALERT_TYPES (custom_components/irrigation_scheduler/alerts.py): mismo orden y valores

export type AlertLevel = "valve" | "zone" | "installation";

export interface AlertType {
  id: string;
  level: AlertLevel;
  priority: AlertPriority;
  allowed: AlertPriority[];
  name: Key;
  help: Key;
  // solo push: sin entidad event ni marca; la casilla «Histórico» va desmarcada y bloqueada
  pushOnly?: boolean;
}

const ALL: AlertPriority[] = ["critical", "high", "normal"];

export const ALERT_LEVELS: AlertLevel[] = ["valve", "zone", "installation"];

export const ALERT_TYPES: AlertType[] = [
  { id: "turn_on_failed", level: "valve", priority: "high", allowed: ALL, name: "alert_turn_on_failed", help: "alert_turn_on_failed_help" },
  // no baja de alta (decisión 7)
  { id: "turn_off_failed", level: "valve", priority: "critical", allowed: ["critical", "high"], name: "alert_turn_off_failed", help: "alert_turn_off_failed_help" },
  { id: "no_water", level: "valve", priority: "high", allowed: ALL, name: "alert_no_water", help: "alert_no_water_help" },
  { id: "overrun_restart", level: "valve", priority: "high", allowed: ALL, name: "alert_overrun_restart", help: "alert_overrun_restart_help" },
  { id: "overrun_running", level: "valve", priority: "high", allowed: ALL, name: "alert_overrun_running", help: "alert_overrun_running_help" },
  { id: "manual_overrun", level: "valve", priority: "high", allowed: ALL, name: "alert_manual_overrun", help: "alert_manual_overrun_help" },
  { id: "sensor_unavailable", level: "zone", priority: "normal", allowed: ALL, name: "alert_sensor_unavailable", help: "alert_sensor_unavailable_help" },
  { id: "rain_skipped", level: "zone", priority: "normal", allowed: ALL, name: "alert_rain_skipped", help: "alert_rain_skipped_help" },
  { id: "rain_source_unavailable", level: "installation", priority: "normal", allowed: ALL, name: "alert_rain_source_unavailable", help: "alert_rain_source_unavailable_help" },
  { id: "valve_switched", level: "valve", priority: "normal", allowed: ALL, name: "alert_valve_switched", help: "alert_valve_switched_help", pushOnly: true },
  { id: "restart_not_resumed", level: "valve", priority: "normal", allowed: ALL, name: "alert_restart_not_resumed", help: "alert_restart_not_resumed_help", pushOnly: true },
];

const DEFAULT_ALERT: AlertConfig = {
  push: true,
  targets: null,
  priority: null,
  show_in_history: true,
  voice: false,
  voice_targets: null,
};

/** Ajustes efectivos de un tipo: un ID ausente usa los valores por defecto. */
export function alertConfig(settings: Settings, id: string): AlertConfig {
  return { ...DEFAULT_ALERT, ...settings.alerts[id] };
}
