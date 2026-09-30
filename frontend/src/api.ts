// tipos mínimos de hass y llamadas a la API WebSocket de la integración (01-backend.md §2.2)

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: { friendly_name?: string; [key: string]: unknown };
  last_changed: string;
}

export interface MessageBase {
  type: string;
  [key: string]: unknown;
}

export interface Connection {
  subscribeMessage<T>(
    callback: (message: T) => void,
    message: MessageBase,
    options?: { resubscribe?: boolean },
  ): Promise<() => Promise<void>>;
}

export interface Hass {
  connection: Connection;
  connected: boolean;
  states: Record<string, HassEntity>;
  services: Record<string, Record<string, unknown>>;
  locale?: { language: string };
  language: string;
  config: { time_zone: string; unit_system?: { accumulated_precipitation?: string } };
  callWS<T>(message: MessageBase): Promise<T>;
}

export interface Valve {
  entity_id: string;
  name: string;
  duration_min: number;
  start_times: string[];
  enabled: boolean;
  // binary_sensor de suministro; on = falta agua
  supply_sensor: string | null;
}

export type Mode = "manual" | "auto";
export type SensorKind = "temperature" | "humidity" | "soil_moisture";

export interface ZoneConfig {
  // null o ausente = zona nueva
  zone_id?: string | null;
  name: string;
  enabled: boolean;
  mode: Mode;
  days: number[];
  start_times: string[];
  max_simultaneous: number;
  rain_skip: boolean;
  sensors: Record<SensorKind, string | null>;
  calc_method: string | null;
  valves: Valve[];
}

export interface SavedZone extends ZoneConfig {
  zone_id: string;
}

export type ZoneStatus = "idle" | "running" | "queued";

/** entity_id del sensor «Modo riego» y del event de alertas de una válvula; null si no está en el registro. */
export interface ValveEntities {
  mode: string | null;
  alerts: string | null;
}

/** Entidades que lee la tarjeta de histórico; `valves` va por entity_id de la switch. */
export interface ZoneEntities {
  alerts: string | null;
  valves: Record<string, ValveEntities>;
}

export interface Zone extends SavedZone {
  status: ZoneStatus;
  next_run: string | null;
  // lote en curso: primera apertura y fin estimado con la cola (null sin lote)
  batch_started_at: string | null;
  batch_ends_at: string | null;
  entities: ZoneEntities;
}

/** Intervalo con inicio y fin: una válvula abierta o el lote de una zona. */
export interface TimeSpan {
  started_at: string;
  ends_at: string;
}

/** Estado comprimido de `history/history_during_period` con minimal_response: s = estado; lu/lc en s epoch. */
export interface HistoryState {
  s: string;
  lu: number;
  // solo si difiere de lu
  lc?: number;
}

/** entity_id → estados en orden cronológico; una entidad sin datos puede faltar. */
export type HistoryResponse = Record<string, HistoryState[]>;

/** Estado comprimido con atributos (sin minimal_response): las entidades event llevan el tipo en `a.event_type`. */
export interface HistoryAttrState extends HistoryState {
  a?: Record<string, unknown>;
}

export type AlertHistoryResponse = Record<string, HistoryAttrState[]>;

export type AlertPriority = "critical" | "high" | "normal";

/** Ajustes de un tipo de alerta; espejo de AlertConfig (model.py). */
export interface AlertConfig {
  push: boolean;
  // null = todos los notify_targets
  targets: string[] | null;
  // null = la del catálogo
  priority: AlertPriority | null;
  show_in_history: boolean;
}

export interface Settings {
  global_max_valves: number | null;
  notify_targets: string[];
  rain_sensor: string | null;
  rain_past_hours: number;
  rain_past_threshold_mm: number;
  weather_entity: string | null;
  rain_forecast_hours: number;
  rain_forecast_threshold_mm: number;
  // solo los tipos editados alguna vez; el resto, valores por defecto
  alerts: Record<string, AlertConfig>;
}

export interface OpenValve {
  entity_id: string;
  zone_id: string;
  started_at: string;
  ends_at: string;
}

export interface PendingJob {
  seq: number;
  zone_id: string;
  entity_id: string;
  duration_s: number;
}

// válvula encendiéndose: la switch aún no ha confirmado (reintentos incluidos)
export interface OpeningValve {
  entity_id: string;
  zone_id: string;
}

// válvula con su sensor de suministro en on
export interface NoWater {
  entity_id: string;
  zone_id: string;
}

export interface ManualOn {
  entity_id: string;
  zone_id: string;
  since: string;
}

export interface Snapshot {
  settings: Settings;
  zones: Zone[];
  open_valves: OpenValve[];
  pending: PendingJob[];
  opening: OpeningValve[];
  manual_on: ManualOn[];
  no_water: NoWater[];
  // event de alertas de la instalación; null si no está en el registro
  installation_alerts: string | null;
}

export interface Issue {
  rule: string;
  path: (string | number)[];
}

const DOMAIN = "irrigation_scheduler";
export const SUBSCRIBE = `${DOMAIN}/subscribe`;

export const listSnapshot = (hass: Hass) => hass.callWS<Snapshot>({ type: `${DOMAIN}/list` });

export function saveZone(hass: Hass, zone: ZoneConfig) {
  // payload explícito: el esquema del backend rechaza claves de más (status, next_run, key…)
  const payload: ZoneConfig = {
    zone_id: zone.zone_id ?? null,
    name: zone.name,
    enabled: zone.enabled,
    mode: zone.mode,
    days: zone.days,
    start_times: zone.start_times,
    max_simultaneous: zone.max_simultaneous,
    rain_skip: zone.rain_skip,
    sensors: zone.sensors,
    calc_method: zone.calc_method,
    valves: zone.valves.map((valve) => ({
      entity_id: valve.entity_id,
      name: valve.name,
      duration_min: valve.duration_min,
      start_times: valve.start_times,
      enabled: valve.enabled,
      supply_sensor: valve.supply_sensor,
    })),
  };
  return hass.callWS<{ zone: SavedZone | null; errors: Issue[] }>({
    type: `${DOMAIN}/save_zone`,
    zone: payload,
  });
}

export const deleteZone = (hass: Hass, zoneId: string) =>
  hass.callWS<null>({ type: `${DOMAIN}/delete_zone`, zone_id: zoneId });

export function saveSettings(hass: Hass, settings: Settings) {
  const payload: Settings = {
    global_max_valves: settings.global_max_valves,
    notify_targets: settings.notify_targets,
    rain_sensor: settings.rain_sensor,
    rain_past_hours: settings.rain_past_hours,
    rain_past_threshold_mm: settings.rain_past_threshold_mm,
    weather_entity: settings.weather_entity,
    rain_forecast_hours: settings.rain_forecast_hours,
    rain_forecast_threshold_mm: settings.rain_forecast_threshold_mm,
    alerts: settings.alerts,
  };
  return hass.callWS<{ settings: Settings | null; errors: Issue[] }>({
    type: `${DOMAIN}/save_settings`,
    settings: payload,
  });
}

export const runZone = (hass: Hass, zoneId: string) =>
  hass.callWS<null>({ type: `${DOMAIN}/run_zone`, zone_id: zoneId });

export const runValve = (hass: Hass, entityId: string) =>
  hass.callWS<null>({ type: `${DOMAIN}/run_valve`, entity_id: entityId });

// sin zona: pausar todo
export const stop = (hass: Hass, zoneId?: string) =>
  hass.callWS<null>({ type: `${DOMAIN}/stop`, ...(zoneId ? { zone_id: zoneId } : {}) });

export const pauseValve = (hass: Hass, entityId: string) =>
  hass.callWS<null>({ type: `${DOMAIN}/pause_valve`, entity_id: entityId });

export const setValveEnabled = (hass: Hass, entityId: string, enabled: boolean) =>
  hass.callWS<null>({ type: `${DOMAIN}/set_valve_enabled`, entity_id: entityId, enabled });

export const setZoneEnabled = (hass: Hass, zoneId: string, enabled: boolean) =>
  hass.callWS<null>({ type: `${DOMAIN}/set_zone_enabled`, zone_id: zoneId, enabled });

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

// alertas: con atributos, sin el estado previo a la ventana y con cada evento aunque solo cambie un atributo
export const fetchAlertHistory = (hass: Hass, entityIds: string[], start: number, end: number) =>
  hass.callWS<AlertHistoryResponse>({
    type: "history/history_during_period",
    entity_ids: entityIds,
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    include_start_time_state: false,
    significant_changes_only: false,
  });
