# Pop up de eventos en la línea de tiempo del histórico — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la «Línea de tiempo» de la tarjeta de histórico, un pop up sobre cada riego (con su origen y el tiempo real regado) y sobre cada alerta (con su icono y su hora).

**Architecture:** El backend guarda el origen de cada apertura (`Job.origin`, `OpenValve.origin`) y lo publica en un sensor enum por válvula, «Modo riego», que el recorder de HA graba. El snapshot publica los `entity_id` de ese sensor y de las entidades `event` de alertas. La tarjeta pide al recorder el historial de las switch, de los sensores y de los `event`, cruza cada encendido con el origen, pinta las alertas como marcas y muestra un pop up propio.

**Tech Stack:** Integración de HA 2026.9 (Python 3.14); tarjeta en Lit 3 + TypeScript (Vite).

**Spec:** `docs/superpowers/specs/2026-09-30-history-tooltip-design.md`

## Global Constraints

- **SIN tests** (excepción explícita del usuario a TDD). Gates:
  - backend, en la raíz: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`;
  - frontend, en `frontend/`: `npx tsc --noEmit`, `npm run lint` y `npm run build`.
- Nada de servidores, navegador ni plan de pruebas. El usuario valida en su HA 2026.9.
- No inventar: cita `archivo:línea`. Si el plan no cuadra con el código (las líneas movidas no cuentan: manda el nombre), PARAR y preguntar.
- Un commit por tarea, en español, con `git add` de ficheros concretos. Sin push, sin merge, sin worktrees.
- Los comentarios del código en español; identificadores, claves y ficheros en inglés. Lit sin decoradores.
- Textos de la tarjeta solo vía `t(hass, key)`, con la clave en `ES` y en `EN` de `frontend/src/i18n.ts`.
- Traducciones de entidades en `strings.json`, `translations/en.json` (igual que `strings.json`) y `translations/es.json`.
- El bundle `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js` se regenera y se commitea solo en la Tarea 5.
- Nombres de entidades (spec, «Renombrado» y «Sensor»):
  - `sensor.modo_riego_{nombre_disp}`, nombre visible «Modo riego» / «Irrigation mode»;
  - `event.alertas_riego_{nombre_disp}` (válvula), `event.alertas_riego_{zona}` (zona) y `event.alertas_riego_instalacion` (instalación), todos con nombre visible «Alertas riego» / «Irrigation alerts».
- `{nombre_disp}` es `slugify(device.name_by_user or device.name)` del dispositivo de la switch. Si la switch no tiene dispositivo, se usa el nombre de la válvula.
- Estados del sensor: `idle` · `scheduled` · `manual` · `external`. Textos ES: Parado · Programado · Manual · Externo. Textos EN: Idle · Scheduled · Manual · External.
- Riego sin origen conocido: título «Riego».

## Hechos verificados

- **`entity_id` propuesto.** Si la entidad fija `self.entity_id` antes de añadirse, HA lo usa como `suggested_object_id` (`.superpowers/ha/src/homeassistant/helpers/entity_platform.py:886-907`). En ese caso no le antepone el nombre del dispositivo (`helpers/entity_registry.py:1360`). Una entidad ya registrada conserva su `entity_id`.
- **Estado de una entidad `event`.** Es la hora del último evento en ISO (`components/event/__init__.py:198-202`). El tipo va en el atributo `event_type`.
- **`history/history_during_period`.** Acepta `include_start_time_state`, `significant_changes_only`, `minimal_response` y `no_attributes` (`components/history/websocket_api.py:98-105`). En formato comprimido, los atributos van en la clave `a` (`const.py:913`).
- **Iconos.** Existen en `@mdi/js` 7.4.47, que no está instalado en el proyecto. Los trazados de la Tarea 5 están copiados de su `mdi.js`.

---

### Task 1: Origen del riego en la ejecución (backend)

**Files:**
- Modify: `custom_components/irrigation_scheduler/const.py` (tras `STATUSES`)
- Modify: `custom_components/irrigation_scheduler/runtime.py` (`Job`, `OpenValve`, `RuntimeState.enqueue`)
- Modify: `custom_components/irrigation_scheduler/manager.py` (`__init__`, `_enqueue_block`, `_async_dispatch_locked`, `_async_open_job`, `_mark_open`, `async_run_zone`, `async_run_valve`, nuevo `valve_origin`)

**Interfaces:**
- Produces:
  - `const.ORIGIN_IDLE = "idle"`, `ORIGIN_SCHEDULED = "scheduled"`, `ORIGIN_MANUAL = "manual"`, `ORIGIN_EXTERNAL = "external"`, `ORIGINS = [ORIGIN_IDLE, ORIGIN_SCHEDULED, ORIGIN_MANUAL, ORIGIN_EXTERNAL]`.
  - `IrrigationManager.valve_origin(entity_id: str) -> str`: uno de `ORIGINS`.

- [ ] **Step 1: Constantes.** En `const.py`, después de `STATUSES = [...]`:

```python
# Origen del riego de una válvula: estados del sensor «Modo riego»
ORIGIN_IDLE = "idle"
ORIGIN_SCHEDULED = "scheduled"
ORIGIN_MANUAL = "manual"
ORIGIN_EXTERNAL = "external"
ORIGINS = [ORIGIN_IDLE, ORIGIN_SCHEDULED, ORIGIN_MANUAL, ORIGIN_EXTERNAL]
```

- [ ] **Step 2: `runtime.py`.** Añade el import (`const.py` no depende de HA, así que `runtime.py` sigue «Sin HA»):

```python
from .const import ORIGIN_MANUAL
```

`Job` gana el campo al final. El valor por defecto cubre los trabajos persistidos antes del cambio (`Job(**item)` en `RuntimeState.from_dict`):

```python
    # False en «regar válvula ahora»: solo respeta el límite global (03 §4)
    zone_limit: bool = True
    # scheduled o manual; los guardados antes de existir el campo se leen como manual
    origin: str = ORIGIN_MANUAL
```

`OpenValve` gana el campo al final, y lo lee y escribe:

```python
@dataclass
class OpenValve:
    entity_id: str
    zone_id: str
    started_at: datetime
    ends_at: datetime
    origin: str = ORIGIN_MANUAL

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "zone_id": self.zone_id,
            "started_at": self.started_at.isoformat(),
            "ends_at": self.ends_at.isoformat(),
            "origin": self.origin,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> OpenValve:
        return cls(
            entity_id=data["entity_id"],
            zone_id=data["zone_id"],
            started_at=datetime.fromisoformat(data["started_at"]),
            ends_at=datetime.fromisoformat(data["ends_at"]),
            origin=data.get("origin", ORIGIN_MANUAL),
        )
```

`RuntimeState.enqueue` exige el origen por nombre:

```python
    def enqueue(
        self, zone_id: str, entity_id: str, duration_s: int, *, origin: str, zone_limit: bool = True
    ) -> Job:
        job = Job(self.next_seq, zone_id, entity_id, duration_s, zone_limit, origin)
        self.next_seq += 1
        self.pending.append(job)
        return job
```

Las construcciones de `OpenValve` en `estimate_batch_ends` (posicionales, 4 argumentos) no cambian.

- [ ] **Step 3: `manager.py`, llamadas a `enqueue`.** Importa `ORIGIN_EXTERNAL`, `ORIGIN_IDLE`, `ORIGIN_MANUAL` y `ORIGIN_SCHEDULED` desde `.const`, dentro del bloque `from .const import (...)`, en orden alfabético.
  - En `_enqueue_block`: `self.runtime.enqueue(zone.zone_id, valve.entity_id, valve.duration_min * 60, origin=ORIGIN_SCHEDULED)`.
  - En `async_run_zone`: `self.runtime.enqueue(zone_id, valve.entity_id, valve.duration_min * 60, origin=ORIGIN_MANUAL)`.
  - En `async_run_valve`: `self.runtime.enqueue(zone.zone_id, entity_id, duration_s, origin=ORIGIN_MANUAL, zone_limit=False)`.
  - Comprueba con `rg -n "enqueue\(" custom_components` que no hay más llamadas. Si aparece otra, PARA y pregunta.

- [ ] **Step 4: `manager.py`, origen en apertura.** En `__init__`, después de `self._opening_s: dict[str, int] = {}`:

```python
        # origen de cada válvula en apertura: el sensor «Modo riego» lo muestra antes del turn_on
        self._opening_origin: dict[str, str] = {}
```

En `_async_dispatch_locked`, junto a `self._opening_s[job.entity_id] = job.duration_s`:

```python
            self._opening_origin[job.entity_id] = job.origin
```

En `_async_open_job`, junto a `self._opening_s.pop(job.entity_id, None)`:

```python
            self._opening_origin.pop(job.entity_id, None)
```

En `_mark_open`, pasa el origen a `OpenValve`:

```python
        valve = OpenValve(
            job.entity_id,
            job.zone_id,
            started,
            started + timedelta(seconds=job.duration_s),
            job.origin,
        )
```

- [ ] **Step 5: `manager.py`, `valve_origin`.** Añádelo junto a `active_valves`, antes de `snapshot`:

```python
    def valve_origin(self, entity_id: str) -> str:
        """Origen del riego de una switch configurada; estado del sensor «Modo riego».

        Abierta o abriéndose por la integración: el origen de su trabajo. Encendida fuera de
        la gestión propia (a mano o tras un turn_off fallido): external. Si no, idle.
        """
        if valve := self.runtime.open_valves.get(entity_id):
            return valve.origin
        if origin := self._opening_origin.get(entity_id):
            return origin
        state = self.hass.states.get(entity_id)
        return ORIGIN_EXTERNAL if state is not None and state.state == STATE_ON else ORIGIN_IDLE
```

- [ ] **Step 6: Gates.** En la raíz del repo:

Run: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y ninguna salida de compileall.

- [ ] **Step 7: Commit**

```bash
git add custom_components/irrigation_scheduler/const.py custom_components/irrigation_scheduler/runtime.py custom_components/irrigation_scheduler/manager.py
git commit -m "feat(history): origen de cada riego en la cola y en las válvulas abiertas"
```

---

### Task 2: Sensor «Modo riego» y entidades «Alertas riego» (backend)

**Files:**
- Modify: `custom_components/irrigation_scheduler/entity.py` (nueva base `ValveEntity`, nuevo `configured_valves`)
- Modify: `custom_components/irrigation_scheduler/event.py`
- Modify: `custom_components/irrigation_scheduler/sensor.py`
- Modify: `custom_components/irrigation_scheduler/manager.py` (`_remove_valve_alerts` → `_remove_valve_entities`)
- Modify: `custom_components/irrigation_scheduler/strings.json`, `translations/en.json`, `translations/es.json`

**Interfaces:**
- Consumes: `IrrigationManager.valve_origin(entity_id) -> str` y `const.ORIGINS` (Task 1).
- Produces:
  - `unique_id` del sensor: `f"{zone_id}_valve_mode_{entity_id}"`, plataforma `sensor`;
  - `unique_id` del event de válvula, sin cambios: `f"{zone_id}_valve_alerts_{entity_id}"`;
  - zona: `f"{zone_id}_alerts"`; instalación: `f"{INSTALLATION_ID}_alerts"`;
  - `entity.configured_valves(manager) -> set[tuple[str, str]]`.

- [ ] **Step 1: `entity.py`.** Añade los imports:

```python
from homeassistant.helpers.device import async_entity_id_to_device
from homeassistant.util import slugify
```

Al final del fichero:

```python
def configured_valves(manager: IrrigationManager) -> set[tuple[str, str]]:
    """(zone_id, entity_id) de cada válvula configurada."""
    return {
        (zone_id, valve.entity_id)
        for zone_id, zone in manager.config.zones.items()
        for valve in zone.valves
    }


class ValveEntity(ZoneEntity):
    """Entidad de una válvula configurada, en el dispositivo de su switch (decisión 4).

    `object_prefix` es el entity_id propuesto sin sufijo, p. ej. «sensor.modo_riego».
    """

    def __init__(
        self, manager: IrrigationManager, zone_id: str, entity_id: str, key: str, object_prefix: str
    ) -> None:
        super().__init__(manager, zone_id, key)
        self._valve_id = entity_id
        # prefijo zone_id: borrar la zona la borra también (manager._remove_zone_entities)
        self._attr_unique_id = f"{zone_id}_{key}_{entity_id}"
        zone = manager.config.zones[zone_id]
        name = next((v.name for v in zone.valves if v.entity_id == entity_id), entity_id)
        # en el dispositivo de la switch; si no tiene, en el de la zona (decisión 4).
        # Con device_info None la plataforma usa device_entry (entity_platform.py)
        if device := async_entity_id_to_device(manager.hass, entity_id):
            self._attr_device_info = None
            self.device_entry = device
            name = device.name_by_user or device.name or name
        # entity_id propuesto: HA no le antepone el dispositivo (entity_registry.py:1360).
        # Solo vale al crearla; una entidad ya registrada conserva el suyo
        self.entity_id = f"{object_prefix}_{slugify(name)}"

    @property
    def available(self) -> bool:
        zone = self.zone
        return zone is not None and any(v.entity_id == self._valve_id for v in zone.valves)
```

- [ ] **Step 2: `event.py`.** Imports: `from homeassistant.util import slugify` y `from .entity import InstallationEntity, ValveEntity, ZoneEntity, configured_valves`. Borra el import de `async_entity_id_to_device`, que ya no se usa aquí.

En `async_setup_entry`, `sync_valves` calcula `current = configured_valves(manager)` en lugar del set por comprensión. El resto no cambia.

Sustituye `ValveAlertsEvent`, `ZoneAlertsEvent` e `InstallationAlertsEvent` por:

```python
class ValveAlertsEvent(AlertsEvent, ValveEntity):
    _level = LEVEL_VALVE

    def __init__(self, manager: IrrigationManager, zone_id: str, entity_id: str) -> None:
        super().__init__(manager, zone_id, entity_id, "valve_alerts", "event.alertas_riego")
        self._attr_event_types = alert_types(LEVEL_VALVE)

    def _matches(self, alert: Alert) -> bool:
        return alert.zone_id == self._zone_id and alert.entity_id == self._valve_id


class ZoneAlertsEvent(AlertsEvent, ZoneEntity):
    _level = LEVEL_ZONE

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "alerts")
        self._attr_event_types = alert_types(LEVEL_ZONE)
        # entity_id propuesto; una entidad ya registrada conserva el suyo
        self.entity_id = f"event.alertas_riego_{slugify(manager.config.zones[zone_id].name)}"

    def _matches(self, alert: Alert) -> bool:
        return alert.zone_id == self._zone_id


class InstallationAlertsEvent(AlertsEvent, InstallationEntity):
    _level = LEVEL_INSTALLATION

    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "alerts")
        self._attr_event_types = alert_types(LEVEL_INSTALLATION)
        # entity_id propuesto; una entidad ya registrada conserva el suyo
        self.entity_id = "event.alertas_riego_instalacion"

    def _matches(self, alert: Alert) -> bool:
        return True
```

`AlertsEvent` va antes que `ValveEntity` en la herencia: su `_signals` manda, igual que hoy con `ZoneEntity`. El nombre ya no lleva `{valve}`, así que no hay `translation_placeholders`.

- [ ] **Step 3: `sensor.py`.** Imports: `from .const import ORIGINS, SIGNAL_CONFIG, SIGNAL_ZONE_ADDED, STATUSES` y `from .entity import InstallationEntity, ValveEntity, ZoneEntity, configured_valves`.

En `async_setup_entry`, antes de `# claves de los sensores de lluvia que ya existen`:

```python
    # (zone_id, entity_id) de las válvulas que ya tienen sensor «Modo riego»
    valves_known: set[tuple[str, str]] = set()

    @callback
    def sync_valves() -> None:
        current = configured_valves(manager)
        # las quitadas las borra el manager del registro; aquí solo se olvidan
        valves_known.intersection_update(current)
        new = sorted(current - valves_known)
        valves_known.update(new)
        if new:
            async_add_entities([ValveModeSensor(manager, zone_id, entity_id) for zone_id, entity_id in new])
```

Al final de `async_setup_entry`:

```python
    sync_valves()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync_valves))
```

Después de `ZoneStatusSensor`:

```python
class ValveModeSensor(ValveEntity, SensorEntity):
    """Origen del riego de la válvula; el recorder lo guarda para la tarjeta de histórico."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = ORIGINS

    def __init__(self, manager: IrrigationManager, zone_id: str, entity_id: str) -> None:
        super().__init__(manager, zone_id, entity_id, "valve_mode", "sensor.modo_riego")

    @property
    def native_value(self) -> str:
        return self._manager.valve_origin(self._valve_id)
```

Se repinta con `SIGNAL_STATE`, la señal por defecto de `IrrigationEntity`. `SIGNAL_STATE` salta en cada cambio de la switch (`manager._async_valve_state_changed`) y en cada `_async_persist`.

- [ ] **Step 4: `manager.py`, borrado.** Renombra `_remove_valve_alerts` a `_remove_valve_entities` y actualiza su única llamada, en `async_save_zone`. Borra el event y el sensor de cada válvula que sale:

```python
    def _remove_valve_entities(self, zone_id: str, entity_ids: set[str]) -> None:
        """Quita el event y el sensor «Modo riego» de las válvulas que salen de la zona (decisión 4)."""
        entities = er.async_get(self.hass)
        for entity_id in entity_ids:
            for domain, key in (("event", "valve_alerts"), ("sensor", "valve_mode")):
                unique_id = f"{zone_id}_{key}_{entity_id}"
                if registry_id := entities.async_get_entity_id(domain, DOMAIN, unique_id):
                    self._remove_entity(registry_id)
```

- [ ] **Step 5: Traducciones.**
  - `strings.json` y `translations/en.json`:
    - `entity.event.alerts.name`: `"Irrigation alerts"`;
    - `entity.event.valve_alerts.name`: `"Irrigation alerts"`;
    - en `entity.sensor`, tras `"rain_forecast"`:

```json
      "valve_mode": {
        "name": "Irrigation mode",
        "state": { "idle": "Idle", "scheduled": "Scheduled", "manual": "Manual", "external": "External" }
      }
```

  - `translations/es.json`:
    - `entity.event.alerts.name`: `"Alertas riego"`;
    - `entity.event.valve_alerts.name`: `"Alertas riego"`;
    - en `entity.sensor`, tras `"rain_forecast"`:

```json
      "valve_mode": {
        "name": "Modo riego",
        "state": { "idle": "Parado", "scheduled": "Programado", "manual": "Manual", "external": "Externo" }
      }
```

  - Cuida la coma tras la entrada `rain_forecast` y comprueba que los tres JSON cargan:

Run: `py -3.14 -c "import json,sys;[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]" custom_components/irrigation_scheduler/strings.json custom_components/irrigation_scheduler/translations/en.json custom_components/irrigation_scheduler/translations/es.json`
Expected: sin salida.

- [ ] **Step 6: Gates.**

Run: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y ninguna salida de compileall.

- [ ] **Step 7: Commit**

```bash
git add custom_components/irrigation_scheduler/entity.py custom_components/irrigation_scheduler/event.py custom_components/irrigation_scheduler/sensor.py custom_components/irrigation_scheduler/manager.py custom_components/irrigation_scheduler/strings.json custom_components/irrigation_scheduler/translations/en.json custom_components/irrigation_scheduler/translations/es.json
git commit -m "feat(history): sensor «Modo riego» por válvula y entidades «Alertas riego»"
```

---

### Task 3: Entidades del histórico en el snapshot (backend + tipos)

**Files:**
- Modify: `custom_components/irrigation_scheduler/manager.py` (`snapshot` y un helper nuevo)
- Modify: `frontend/src/api.ts` (`Zone`, `Snapshot` y dos interfaces nuevas)

**Interfaces:**
- Consumes: los `unique_id` de la Task 2.
- Produces:
  - por zona en el snapshot, `"entities": {"alerts": str | None, "valves": {switch_entity_id: {"mode": str | None, "alerts": str | None}}}`;
  - en la raíz, `"installation_alerts": str | None`;
  - en TS: `ValveEntities`, `ZoneEntities`, `Zone.entities`, `Snapshot.installation_alerts`.

- [ ] **Step 1: Helper en `manager.py`.** Añádelo antes de `snapshot` (`er`, `DOMAIN` e `INSTALLATION_ID` ya están importados; compruébalo con `rg`):

```python
    def _registry_id(self, domain: str, unique_id: str) -> str | None:
        """entity_id de una entidad propia en el registro; None si aún no existe."""
        return er.async_get(self.hass).async_get_entity_id(domain, DOMAIN, unique_id)

    def _history_entities(self, zone: Zone) -> dict[str, Any]:
        """Entidades que lee la tarjeta de histórico: event de la zona; sensor y event por válvula."""
        return {
            "alerts": self._registry_id("event", f"{zone.zone_id}_alerts"),
            "valves": {
                valve.entity_id: {
                    "mode": self._registry_id("sensor", f"{zone.zone_id}_valve_mode_{valve.entity_id}"),
                    "alerts": self._registry_id("event", f"{zone.zone_id}_valve_alerts_{valve.entity_id}"),
                }
                for valve in zone.valves
            },
        }
```

- [ ] **Step 2: `snapshot`.** En el dict de cada zona, tras `"batch_ends_at": ...`:

```python
                    # entity_id que pide la tarjeta de histórico al recorder
                    "entities": self._history_entities(zone),
```

En el dict devuelto, tras `"manual_on": [...]`:

```python
            "installation_alerts": self._registry_id("event", f"{INSTALLATION_ID}_alerts"),
```

- [ ] **Step 3: `api.ts`.** Antes de `export interface Zone extends SavedZone`:

```ts
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
```

En `Zone`, tras `batch_ends_at: string | null;`:

```ts
  entities: ZoneEntities;
```

En `Snapshot`, tras `manual_on: ManualOn[];`:

```ts
  // event de alertas de la instalación; null si no está en el registro
  installation_alerts: string | null;
```

- [ ] **Step 4: Gates.**

Run (raíz): `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`
Run (`frontend/`): `npx tsc --noEmit`
Expected: sin errores. Si `tsc` falla porque algún sitio construye un `Zone` o un `Snapshot` literal, PARA y pregunta.

- [ ] **Step 5: Commit**

```bash
git add custom_components/irrigation_scheduler/manager.py frontend/src/api.ts
git commit -m "feat(history): el snapshot publica las entidades de origen y de alertas"
```

---

### Task 4: Datos del histórico: origen de cada riego y marcas de alerta (frontend)

**Files:**
- Modify: `frontend/src/api.ts` (tipos y `fetchAlertHistory`)
- Modify: `frontend/src/shared/valve-history.ts` (origen)
- Create: `frontend/src/shared/history-marks.ts`
- Modify: `frontend/src/card/history-card.ts` (dos consultas)

**Interfaces:**
- Consumes: `Zone.entities` y `Snapshot.installation_alerts` (Task 3).
- Produces:
  - `api.ts`: `HistoryAttrState`, `AlertHistoryResponse` y `fetchAlertHistory(hass, entityIds, start, end): Promise<AlertHistoryResponse>`;
  - `valve-history.ts`: `type RunOrigin = "scheduled" | "manual" | "external"`, `ValveRun.origin?: RunOrigin` y `runOrigin(run, states, range)`;
  - `history-marks.ts`: `AlertMark {type: AlertType; at: number}`, `ZoneMarks {zone: AlertMark[]; valves: Record<string, AlertMark[]>}`, `HistoryMarks {installation: AlertMark[]; zones: Record<string, ZoneMarks>}`, `buildMarks(...)` y `alertEntityIds(...)`;
  - `HistoryCard._alerts: AlertHistoryResponse`.

- [ ] **Step 1: `api.ts`.** Tras `export type HistoryResponse = ...`:

```ts
/** Estado comprimido con atributos (sin minimal_response): las entidades event llevan el tipo en `a.event_type`. */
export interface HistoryAttrState extends HistoryState {
  a?: Record<string, unknown>;
}

export type AlertHistoryResponse = Record<string, HistoryAttrState[]>;
```

Tras `fetchValveHistory`:

```ts
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
```

- [ ] **Step 2: `valve-history.ts`.** Tras los imports:

```ts
/** Origen de un riego según el sensor «Modo riego»; undefined = sin dato (anterior a la versión con sensor). */
export type RunOrigin = "scheduled" | "manual" | "external";
const ORIGINS: string[] = ["scheduled", "manual", "external"];
```

En `ValveRun`, tras `startsBefore: boolean;`:

```ts
  origin?: RunOrigin;
```

Tras `valveRuns`:

```ts
/** Origen de un encendido: el primer estado del sensor «Modo riego» ≠ idle que se solapa con él. */
export function runOrigin(run: TimeSpan, states: HistoryState[], range: WindowRange): RunOrigin | undefined {
  const start = Date.parse(run.started_at);
  const end = Date.parse(run.ends_at);
  for (let i = 0; i < states.length; i++) {
    const from = (states[i].lc ?? states[i].lu) * 1000;
    const next = states[i + 1];
    const to = next ? (next.lc ?? next.lu) * 1000 : range.end;
    if (ORIGINS.includes(states[i].s) && from < end && to > start) return states[i].s as RunOrigin;
  }
  return undefined;
}
```

En `buildHistory`, sustituye el cálculo de `runs`:

```ts
    const valves = zone.valves.map((valve) => {
      const modeId = zone.entities.valves[valve.entity_id]?.mode;
      const modeStates = modeId ? (history[modeId] ?? []) : [];
      const runs = valveRuns(history[valve.entity_id] ?? [], range).map((run) => ({
        ...run,
        origin: runOrigin(run, modeStates, range),
      }));
      return { valve, runs, seconds: total(runs) };
    });
```

- [ ] **Step 3: Crea `shared/history-marks.ts`:**

```ts
import type { AlertHistoryResponse, HistoryAttrState, Settings, Zone } from "../api";
import { ALERT_TYPES, alertConfig, type AlertType } from "../alerts";
import type { WindowRange } from "./time-window";

// marcas de alerta del histórico: una por evento de las entidades event (docs/alerts/spec.md §0.1)

export interface AlertMark {
  type: AlertType;
  // ms epoch
  at: number;
}

export interface ZoneMarks {
  zone: AlertMark[];
  // por entity_id de la switch
  valves: Record<string, AlertMark[]>;
}

export interface HistoryMarks {
  installation: AlertMark[];
  zones: Record<string, ZoneMarks>;
}

/** Alertas de una entidad event en la ventana; solo los tipos con «mostrar en histórico». */
function alertMarks(states: HistoryAttrState[], settings: Settings, range: WindowRange): AlertMark[] {
  const marks: AlertMark[] = [];
  for (const state of states) {
    // el estado de una entidad event es la hora del evento en ISO; unavailable/unknown dan NaN
    const at = Date.parse(state.s);
    const type = ALERT_TYPES.find((item) => item.id === state.a?.event_type);
    if (!type || Number.isNaN(at) || at < range.start || at > range.end) continue;
    if (alertConfig(settings, type.id).show_in_history) marks.push({ type, at });
  }
  return marks;
}

/** Marcas por nivel: instalación, zona y válvula. */
export function buildMarks(
  history: AlertHistoryResponse,
  zones: Zone[],
  installationId: string | null,
  settings: Settings,
  range: WindowRange,
): HistoryMarks {
  const of = (entityId: string | null | undefined) =>
    entityId ? alertMarks(history[entityId] ?? [], settings, range) : [];
  return {
    installation: of(installationId),
    zones: Object.fromEntries(
      zones.map((zone) => [
        zone.zone_id,
        {
          zone: of(zone.entities.alerts),
          valves: Object.fromEntries(
            zone.valves.map((valve) => [valve.entity_id, of(zone.entities.valves[valve.entity_id]?.alerts)]),
          ),
        },
      ]),
    ),
  };
}

/** entity_id de las entidades event de las zonas y de la instalación, sin nulos. */
export function alertEntityIds(zones: Zone[], installationId: string | null): string[] {
  const ids = [
    installationId,
    ...zones.flatMap((zone) => [
      zone.entities.alerts,
      ...zone.valves.map((valve) => zone.entities.valves[valve.entity_id]?.alerts),
    ]),
  ];
  return ids.filter((id): id is string => Boolean(id));
}
```

- [ ] **Step 4: `history-card.ts`, consultas.**
  - Imports: añade `fetchAlertHistory` y `type AlertHistoryResponse` al import de `../api`, y `import { alertEntityIds } from "../shared/history-marks";`.
  - `static properties`: añade `_alerts: { state: true },`.
  - Campo: `declare _alerts: AlertHistoryResponse;` con el comentario `// alertas de las entidades event; {} si no hay o si falla su consulta`.
  - Constructor: `this._alerts = {};`.
  - Sustituye `updated`, `scheduleReload` y `load` por:

```ts
  protected updated(): void {
    const snapshot = this.store.state.snapshot;
    if (!this.hass || !this._config || !snapshot) return;
    const zones = this.zones(snapshot);
    // switch y su sensor «Modo riego»: mismo formato mínimo
    const entityIds = zones.flatMap((zone) =>
      zone.valves.flatMap((valve) => {
        const mode = zone.entities.valves[valve.entity_id]?.mode;
        return mode ? [valve.entity_id, mode] : [valve.entity_id];
      }),
    );
    const alertIds = alertEntityIds(zones, snapshot.installation_alerts);
    const key = `${entityIds.join(",")}|${alertIds.join(",")}|${JSON.stringify(this._window)}`;
    if (key !== this.fetchKey) {
      this.fetchKey = key;
      this.lastSnapshot = snapshot;
      void this.load(entityIds, alertIds, true);
      return;
    }
    if (snapshot !== this.lastSnapshot) {
      this.lastSnapshot = snapshot;
      // un rango fijo es pasado: no cambia
      if (this._window.kind === "relative") this.scheduleReload(entityIds, alertIds);
    }
  }

  private scheduleReload(entityIds: string[], alertIds: string[]): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(entityIds, alertIds, false), RELOAD_DEBOUNCE_MS);
  }

  /** `reset`: vacía lo mostrado mientras carga (cambio de ventana o de zonas). */
  private async load(entityIds: string[], alertIds: string[], reset: boolean): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    window.clearTimeout(this.reloadTimer);
    const seq = ++this.seq;
    if (reset) this._history = undefined;
    const range = resolveWindow(this._window, Date.now());
    try {
      const [history, alerts] = await Promise.all([
        entityIds.length ? fetchValveHistory(hass, entityIds, range.start, range.end) : Promise.resolve<HistoryResponse>({}),
        // si fallan las alertas se pintan los riegos igual, sin marcas ni error (spec, «Datos»)
        alertIds.length
          ? fetchAlertHistory(hass, alertIds, range.start, range.end).catch((): AlertHistoryResponse => ({}))
          : Promise.resolve<AlertHistoryResponse>({}),
      ]);
      if (seq !== this.seq) return;
      this._history = history;
      this._alerts = alerts;
      this._error = false;
    } catch {
      if (seq === this.seq) this._error = true;
    }
  }
```

- [ ] **Step 5: Gates.** En `frontend/`:

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores ni avisos nuevos. `buildMarks` aún no tiene consumidor (lo usa la Task 5); `tsc` no avisa de exports sin usar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api.ts frontend/src/shared/valve-history.ts frontend/src/shared/history-marks.ts frontend/src/card/history-card.ts
git commit -m "feat(history): la tarjeta lee el origen de cada riego y las alertas del recorder"
```

---

### Task 5: Pop up y marcas en la línea de tiempo (frontend + bundle)

**Files:**
- Create: `frontend/src/card/history-tip.ts`
- Create: `frontend/src/shared/alert-icons.ts`
- Modify: `frontend/src/card/history-views.ts` (`historyTimeline`, estilos)
- Modify: `frontend/src/card/history-card.ts` (estado del pop up, marcas)
- Modify: `frontend/src/i18n.ts` (claves nuevas en ES y EN)
- Rebuild: `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`

**Interfaces:**
- Consumes:
  - `buildMarks`, `HistoryMarks` y `AlertMark` (Task 4);
  - `ValveRun.origin` y `RunOrigin` (Task 4);
  - `svgIcon(path)` (`shared/controls.ts:74`);
  - `AlertType.name: Key` (`alerts.ts`).
- Produces: `historyTimeline(hass, history, marks, range, live, onTip)`.

- [ ] **Step 1: Claves i18n.** En `ES`, tras `history_card_help`:

```ts
  history_run: "Riego",
  history_run_scheduled: "Riego programado",
  history_run_manual: "Riego manual",
  history_run_external: "Riego externo",
  history_watered: "Tiempo regado: {time}",
  history_before_window: "Desde antes de la ventana",
  history_installation: "Instalación",
```

En `EN`, tras `history_card_help`:

```ts
  history_run: "Irrigation",
  history_run_scheduled: "Scheduled irrigation",
  history_run_manual: "Manual irrigation",
  history_run_external: "External irrigation",
  history_watered: "Watered: {time}",
  history_before_window: "Started before this window",
  history_installation: "Installation",
```

- [ ] **Step 2: Crea `shared/alert-icons.ts`** (trazados de `@mdi/js` 7.4.47):

```ts
// icono mdi (@mdi/js 7.4.47) y color de cada tipo de alerta en la línea de tiempo del histórico.
// Rojo: la válvula hace lo contrario de lo pedido; naranja: resuelto o solo aviso; azul: omisión por lluvia
export type MarkColor = "error" | "warning" | "info";

export interface MarkStyle {
  icon: string;
  color: MarkColor;
}

// mdi:timer-alert-outline, compartido por los dos tiempos excedidos
const TIMER_ALERT =
  "M9 8H11V14H9V8M13 1H7V3H13V1M17.03 7.39C18.26 8.93 19 10.88 19 13C19 17.97 15 22 10 22C5.03 22 1 17.97 1 13S5.03 4 10 4C12.12 4 14.07 4.74 15.62 6L17.04 4.56C17.55 5 18 5.46 18.45 5.97L17.03 7.39M17 13C17 9.13 13.87 6 10 6S3 9.13 3 13 6.13 20 10 20 17 16.87 17 13M21 7V13H23V7H21M21 17H23V15H21V17Z";

export const ALERT_MARKS: Record<string, MarkStyle> = {
  // mdi:water-off
  turn_on_failed: {
    icon: "M20.84 22.73L16.29 18.18C15.2 19.3 13.69 20 12 20C8.69 20 6 17.31 6 14C6 12.67 6.67 11.03 7.55 9.44L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M18 14C18 10 12 3.25 12 3.25S10.84 4.55 9.55 6.35L17.95 14.75C18 14.5 18 14.25 18 14Z",
    color: "error",
  },
  // mdi:water-alert
  turn_off_failed: {
    icon: "M10 3.25C10 3.25 16 10 16 14C16 17.31 13.31 20 10 20S4 17.31 4 14C4 10 10 3.25 10 3.25M20 7V13H18V7H20M18 17H20V15H18V17Z",
    color: "error",
  },
  overrun_restart: { icon: TIMER_ALERT, color: "warning" },
  overrun_running: { icon: TIMER_ALERT, color: "warning" },
  // mdi:hand-back-right-outline
  manual_overrun: {
    icon: "M21 7C21 5.62 19.88 4.5 18.5 4.5C18.33 4.5 18.16 4.5 18 4.55V4C18 2.62 16.88 1.5 15.5 1.5C15.27 1.5 15.04 1.53 14.83 1.59C14.46 .66 13.56 0 12.5 0C11.27 0 10.25 .89 10.04 2.06C9.87 2 9.69 2 9.5 2C8.12 2 7 3.12 7 4.5V10.39C6.66 10.08 6.24 9.85 5.78 9.73L5 9.5C4.18 9.29 3.31 9.61 2.82 10.35C2.44 10.92 2.42 11.66 2.67 12.3L5.23 18.73C6.5 21.91 9.57 24 13 24C17.42 24 21 20.42 21 16V7M19 16C19 19.31 16.31 22 13 22C10.39 22 8.05 20.41 7.09 18L4.5 11.45L5 11.59C5.5 11.71 5.85 12.05 6 12.5L7 15H9V4.5C9 4.22 9.22 4 9.5 4S10 4.22 10 4.5V12H12V2.5C12 2.22 12.22 2 12.5 2S13 2.22 13 2.5V12H15V4C15 3.72 15.22 3.5 15.5 3.5S16 3.72 16 4V12H18V7C18 6.72 18.22 6.5 18.5 6.5S19 6.72 19 7V16Z",
    color: "warning",
  },
  // mdi:access-point-network-off
  sensor_unavailable: {
    icon: "M14.83,13.83C15.55,13.11 16,12.11 16,11C16,9.89 15.55,8.89 14.83,8.17L16.24,6.76C17.33,7.85 18,9.35 18,11C18,12.65 17.33,14.15 16.24,15.24L14.83,13.83M14,11A2,2 0 0,0 12,9C11.4,9 10.87,9.27 10.5,9.68L13.32,12.5C13.73,12.13 14,11.6 14,11M17.66,16.66L19.07,18.07C20.88,16.26 22,13.76 22,11C22,8.24 20.88,5.74 19.07,3.93L17.66,5.34C19.11,6.78 20,8.79 20,11C20,13.22 19.11,15.22 17.66,16.66M22,21.18V20H20.82L22,21.18M20.27,22L21,22.73L19.73,24L17.73,22H15A1,1 0 0,1 14,23H10A1,1 0 0,1 9,22H2V20H9A1,1 0 0,1 10,19H11V15.27L8.34,12.61C8.54,13.07 8.82,13.5 9.17,13.83L7.76,15.24C6.67,14.15 6,12.65 6,11C6,10.77 6,10.54 6.04,10.31L4.37,8.64C4.14,9.39 4,10.18 4,11C4,13.22 4.89,15.22 6.34,16.66L4.93,18.07C3.12,16.26 2,13.76 2,11C2,9.61 2.29,8.28 2.81,7.08L1,5.27L2.28,4L3.7,5.42L5.15,6.87L6.63,8.35V8.35L8.17,9.9L10.28,12L11,12.71L18.27,20H18.28L20.28,22H20.27M15.73,20L13,17.27V19H14A1,1 0 0,1 15,20H15.73Z",
    color: "warning",
  },
  // mdi:weather-pouring
  rain_skipped: {
    icon: "M9,12C9.53,12.14 9.85,12.69 9.71,13.22L8.41,18.05C8.27,18.59 7.72,18.9 7.19,18.76C6.65,18.62 6.34,18.07 6.5,17.54L7.78,12.71C7.92,12.17 8.47,11.86 9,12M13,12C13.53,12.14 13.85,12.69 13.71,13.22L11.64,20.95C11.5,21.5 10.95,21.8 10.41,21.66C9.88,21.5 9.56,20.97 9.7,20.43L11.78,12.71C11.92,12.17 12.47,11.86 13,12M17,12C17.53,12.14 17.85,12.69 17.71,13.22L16.41,18.05C16.27,18.59 15.72,18.9 15.19,18.76C14.65,18.62 14.34,18.07 14.5,17.54L15.78,12.71C15.92,12.17 16.47,11.86 17,12M17,10V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.43 4,15.6 3.5,15.32V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12C23,13.5 22.2,14.77 21,15.46V15.46C20.5,15.73 19.91,15.57 19.63,15.09C19.36,14.61 19.5,14 20,13.72V13.73C20.6,13.39 21,12.74 21,12A2,2 0 0,0 19,10H17Z",
    color: "info",
  },
  // mdi:weather-cloudy-alert
  rain_source_unavailable: {
    icon: "M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13M13,12H11V8H13V12M13,16H11V14H13",
    color: "warning",
  },
};
```

Copia los trazados tal cual; están verificados contra `@mdi/js` 7.4.47.

- [ ] **Step 3: Crea `card/history-tip.ts`:**

```ts
import { css, html, nothing, type TemplateResult } from "lit";

// pop up de la línea de tiempo: uno por tarjeta, anclado a la barra o marca que lo abrió

export interface Tip {
  title: string;
  lines: string[];
}

/** Lo llaman las vistas: con `tip` lo abre sobre `target`; sin él, lo cierra si es de `target`. */
export type TipHandler = (target: Element, tip?: Tip) => void;

// separación entre el pop up y su ancla, en px
const GAP = 6;

export function renderTip(tip: Tip | undefined): TemplateResult | typeof nothing {
  if (!tip) return nothing;
  return html`<div class="tip" role="tooltip">
    <div class="tip-title">${tip.title}</div>
    ${tip.lines.map((line) => html`<div class="small">${line}</div>`)}
  </div>`;
}

/** Tras pintar: encima del ancla, o debajo si no cabe; siempre dentro del ancho del contenedor. */
export function placeTip(el: HTMLElement, target: Element, container: HTMLElement): void {
  const box = target.getBoundingClientRect();
  const base = container.getBoundingClientRect();
  const width = el.offsetWidth;
  const center = box.left + box.width / 2 - base.left;
  const left = Math.min(Math.max(center - width / 2, 0), Math.max(container.clientWidth - width, 0));
  const above = box.top - base.top - GAP - el.offsetHeight;
  el.style.left = `${left}px`;
  el.style.top = `${above >= 0 ? above : box.bottom - base.top + GAP}px`;
}

/** Ratón: abre al entrar y cierra al salir. Táctil y teclado: abre al pulsar. */
export function tipEvents(onTip: TipHandler, tip: Tip) {
  return {
    enter: (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") onTip(ev.currentTarget as Element, tip);
    },
    leave: (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") onTip(ev.currentTarget as Element);
    },
    click: (ev: Event) => {
      // la tarjeta cierra el pop up con cualquier otro clic
      ev.stopPropagation();
      onTip(ev.currentTarget as Element, tip);
    },
  };
}

export const tipStyles = css`
  .tip {
    position: absolute;
    z-index: 2;
    max-width: 240px;
    padding: 6px 10px;
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.25));
    pointer-events: none;
  }
  .tip-title {
    font-weight: 500;
  }
`;
```

- [ ] **Step 4: `history-views.ts`, imports.**

```ts
import { ALERT_MARKS } from "../shared/alert-icons";
import type { AlertMark, HistoryMarks } from "../shared/history-marks";
import type { RunOrigin, ValveHistory, ValveRun, ZoneHistory } from "../shared/valve-history";
import { tipEvents, type Tip, type TipHandler } from "./history-tip";
```

Sustituyen al import actual de `valve-history`. Añade `svgIcon` al import de `../shared/controls`.

- [ ] **Step 5: `history-views.ts`, textos del pop up.** Tras `runText`:

```ts
const ORIGIN_TITLES: Record<RunOrigin, Key> = {
  scheduled: "history_run_scheduled",
  manual: "history_run_manual",
  external: "history_run_external",
};

/** Riego: título por origen («Riego» sin dato), horas y tiempo real regado. */
function runTip(hass: Hass, run: ValveRun, live: boolean): Tip {
  const lines = [runText(hass, run, live), t(hass, "history_watered", { time: formatDuration(run.seconds) })];
  if (run.startsBefore) lines.push(t(hass, "history_before_window"));
  return { title: t(hass, run.origin ? ORIGIN_TITLES[run.origin] : "history_run"), lines };
}

const markTip = (hass: Hass, mark: AlertMark): Tip => ({
  title: t(hass, mark.type.name),
  lines: [formatDateTime(hass, mark.at)],
});
```

- [ ] **Step 6: `history-views.ts`, `historyTimeline`.** Sustitúyela entera:

```ts
/** Una fila por válvula con encendidos o alertas: barras y marcas sobre el eje de la ventana, sin scroll horizontal. */
export function historyTimeline(
  hass: Hass,
  history: ZoneHistory[],
  marks: HistoryMarks,
  range: WindowRange,
  live: boolean,
  onTip: TipHandler,
): TemplateResult {
  const ticks = axisTicks(range, hass.config.time_zone);
  const bars = (runs: ValveRun[]) =>
    runs.map((run) => {
      const x = position(range, Date.parse(run.started_at));
      const width = Math.max(MIN_BAR, position(range, Date.parse(run.ends_at)) - x);
      const on = tipEvents(onTip, runTip(hass, run, live));
      return svg`<rect class=${run.ongoing ? "ongoing" : ""} x=${x} y="0" width=${width} height="10"
        @pointerenter=${on.enter} @pointerleave=${on.leave} @click=${on.click}></rect>`;
    });
  const markButtons = (items: AlertMark[]) =>
    items.map((mark) => {
      const style = ALERT_MARKS[mark.type.id];
      const on = tipEvents(onTip, markTip(hass, mark));
      return html`<button
        class="tl-mark ${style.color}"
        style=${styleMap({ left: `${position(range, mark.at)}%` })}
        aria-label=${t(hass, mark.type.name)}
        @pointerenter=${on.enter}
        @pointerleave=${on.leave}
        @click=${on.click}
      >
        ${svgIcon(style.icon)}
      </button>`;
    });
  const grid = ticks.map((tick) => {
    const x = position(range, tick.at);
    return svg`<line x1=${x} x2=${x} y1="0" y2="10"></line>`;
  });
  const row = (label: string, runs: ValveRun[], items: AlertMark[], extra = "") => html`<div class="tl-row ${extra}">
    <span class="tl-label small">${label}</span>
    <div class="tl-lane">
      <svg class="tl-bars" viewBox="0 0 100 10" preserveAspectRatio="none">${grid}${bars(runs)}</svg>
      ${markButtons(items)}
    </div>
  </div>`;
  const zoneBlock = ({ zone, valves }: ZoneHistory) => {
    const zoneMarks = marks.zones[zone.zone_id];
    const valveMarks = (item: ValveHistory) => zoneMarks?.valves[item.valve.entity_id] ?? [];
    const shown = valves.filter((item) => item.runs.length || valveMarks(item).length);
    // la fila de la zona solo lleva pista si tiene alertas de zona
    const title = zoneMarks?.zone.length
      ? row(zone.name, [], zoneMarks.zone, "tl-zone")
      : html`<div class="tl-zone">${zone.name}</div>`;
    return html`${title}
      ${shown.length ? shown.map((item) => row(item.valve.name, item.runs, valveMarks(item))) : emptyZone(hass)}`;
  };
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
    ${marks.installation.length ? row(t(hass, "history_installation"), [], marks.installation, "tl-zone") : nothing}
    ${history.map(zoneBlock)}`;
}
```

Se quita el `<title>` nativo de cada `rect` (spec, «Pop up»). `withRuns` lo siguen usando `historyList`; no lo borres.

- [ ] **Step 7: `history-views.ts`, estilos.** En `historyStyles`, tras la regla `.tl-bars line { ... }`:

```css
  .tl-lane {
    position: relative;
  }
  .tl-bars rect {
    cursor: pointer;
  }
  button.tl-mark {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    min-width: 0;
    min-height: 0;
    padding: 2px;
    border: none;
    border-radius: 50%;
    background: var(--card-background-color);
    line-height: 0;
  }
  button.tl-mark .svg-icon {
    width: 16px;
    height: 16px;
  }
  button.tl-mark.error {
    color: var(--error-color);
  }
  button.tl-mark.warning {
    color: var(--warning-color);
  }
  button.tl-mark.info {
    color: var(--info-color);
  }
```

La regla `.tl-zone` actual (`font-weight: 500; margin-top: 8px;`) vale tanto para el título suelto como para la fila con pista.

- [ ] **Step 8: `history-card.ts`, pop up y marcas.**
  - Imports: `import { buildMarks } from "../shared/history-marks";` e `import { placeTip, renderTip, tipStyles, type Tip } from "./history-tip";`.
  - `static properties`: añade `_tip: { state: true },`.
  - Campos:

```ts
  // pop up abierto en la línea de tiempo y la barra o marca que lo abrió
  declare _tip: Tip | undefined;
  private tipTarget?: Element;
```

  - Constructor: `this._tip = undefined;`.
  - Métodos nuevos:

```ts
  private readonly onTip = (target: Element, tip?: Tip): void => {
    if (tip) {
      this.tipTarget = target;
      this._tip = tip;
    } else if (target === this.tipTarget) this.closeTip();
  };

  private closeTip(): void {
    this._tip = undefined;
    this.tipTarget = undefined;
  }

  // un toque fuera de la tarjeta cierra el pop up
  private readonly onWindowClick = (ev: Event): void => {
    if (this._tip && !ev.composedPath().includes(this)) this.closeTip();
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("click", this.onWindowClick);
  }
```

  - En `disconnectedCallback`, tras `super.disconnectedCallback();`: `window.removeEventListener("click", this.onWindowClick);` y `this.closeTip();`.
  - Al principio de `updated()`, antes de `const snapshot = ...`:

```ts
    this.positionTip();
```

  Y el método:

```ts
  /** Coloca el pop up junto a su ancla; si el ancla ya no está en el DOM, lo cierra. */
  private positionTip(): void {
    if (!this._tip || !this.tipTarget) return;
    if (!this.tipTarget.isConnected) {
      this.closeTip();
      return;
    }
    const el = this.renderRoot.querySelector<HTMLElement>(".tip");
    const container = this.renderRoot.querySelector<HTMLElement>(".card-content");
    if (el && container) placeTip(el, this.tipTarget, container);
  }
```

  - En `render()`:
    - `ha-card` pasa a `<ha-card .header=${config.title} @click=${() => this.closeTip()}>`;
    - el callback de `viewChips` cierra el pop up: `(view) => { this._view = view; this.closeTip(); }`;
    - tras `<div class="view">${body}</div>`, añade `${renderTip(this._tip)}`.
  - En `renderHistory`, el caso `"timeline"`:

```ts
      case "timeline": {
        const marks = buildMarks(this._alerts, zones, snapshot.installation_alerts, snapshot.settings, range);
        return historyTimeline(hass, history, marks, range, live, this.onTip);
      }
```

  - `static styles`: añade `tipStyles` tras `historyStyles`. En la regla `.card-content` añade `position: relative;`.

- [ ] **Step 9: Gates y bundle.** En `frontend/`:

Run: `npx tsc --noEmit`, `npm run lint` y `npm run build`
Expected: sin errores. `npm run build` escribe `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`. Comprueba con `git status --short` que el bundle cambió.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/i18n.ts frontend/src/shared/alert-icons.ts frontend/src/card/history-tip.ts frontend/src/card/history-views.ts frontend/src/card/history-card.ts custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js
git commit -m "feat(history): pop up con origen y tiempo regado, y marcas de alerta en la línea de tiempo"
```

---

### Task 6: Documentación (README para HACS y alertas)

**Files:**
- Modify: `README.md` (sección «Entidades» y sección nueva «Tarjeta de histórico», tras «Tarjeta Lovelace»)
- Modify: `docs/alerts/README.md` (tabla «Niveles»)

- [ ] **Step 1: `README.md`, «Entidades».** Antes de `**Por zona:**`, añade:

```markdown
**Por válvula** (en el dispositivo de su switch; si no tiene, en el de la zona):

| Entidad | Tipo | entity_id | Función |
|---|---|---|---|
| Modo riego | `sensor` | `sensor.modo_riego_<dispositivo>` | Origen del riego en curso: `idle` (Parado) · `scheduled` (Programado) · `manual` (Manual) · `external` (Externo, encendida fuera de la integración) |
| Alertas riego | `event` | `event.alertas_riego_<dispositivo>` | Alertas de la válvula: no enciende, no apaga, tiempos excedidos |
```

En la tabla «Por zona», añade la fila `| Alertas riego | \`event\` | Alertas de la zona: sensor caído, riego omitido por lluvia (\`event.alertas_riego_<zona>\`) |`.

En «Globales», añade `| Alertas riego | \`event\` | Fuente de lluvia no disponible (\`event.alertas_riego_instalacion\`) |`.

Tras las tablas, añade la nota: `El entity_id se fija al crear la entidad. Las entidades creadas por versiones anteriores conservan el suyo; renómbralo en HA si quieres el nuevo.`

- [ ] **Step 2: `README.md`, sección «Tarjeta de histórico».** Tras la sección «Tarjeta Lovelace»:

```markdown
## Tarjeta de histórico

- En el panel de control: **Añadir tarjeta → Irrigation Scheduler History**.
- Encendidos reales de las válvulas, leídos del recorder de HA. Vistas: Lista, Línea de tiempo y Totales.
- En la **Línea de tiempo**, al pasar el ratón (o tocar en el móvil) por un riego o una marca se abre un pop up:
  - riego: «Riego programado», «Riego manual» o «Riego externo», horas y **tiempo regado** real. Los riegos anteriores al sensor «Modo riego» salen como «Riego»;
  - alerta: su nombre y la hora.
- Las marcas de alerta, en la fila de su nivel. Solo aparecen los tipos con «Mostrar en histórico» activo en los ajustes de alertas:

| Alerta | Icono | Color | Fila |
|---|---|---|---|
| La válvula no enciende | `mdi:water-off` | Rojo | Válvula |
| La válvula no apaga | `mdi:water-alert` | Rojo | Válvula |
| Tiempo excedido con HA parado | `mdi:timer-alert-outline` | Naranja | Válvula |
| Tiempo excedido con HA en marcha | `mdi:timer-alert-outline` | Naranja | Válvula |
| Encendida a mano demasiado tiempo | `mdi:hand-back-right-outline` | Naranja | Válvula |
| Sensor de zona caído | `mdi:access-point-network-off` | Naranja | Zona |
| Riego omitido por lluvia | `mdi:weather-pouring` | Azul | Zona |
| Fuente de lluvia no disponible | `mdi:weather-cloudy-alert` | Naranja | Instalación |

Los colores siguen el tema de HA (`--error-color`, `--warning-color`, `--info-color`).
```

- [ ] **Step 3: `docs/alerts/README.md`.** Tras la tabla «Niveles», añade:

```markdown
Las tres entidades se llaman «Alertas riego». entity_id al crearlas: `event.alertas_riego_<dispositivo>` (válvula),
`event.alertas_riego_<zona>` (zona) y `event.alertas_riego_instalacion` (instalación). Las creadas antes conservan el suyo.
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/alerts/README.md
git commit -m "docs: sensor «Modo riego», «Alertas riego» y marcas de la tarjeta de histórico"
```
