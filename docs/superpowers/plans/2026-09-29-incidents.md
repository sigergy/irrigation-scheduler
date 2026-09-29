# Registro de incidencias y «Errores y avisos» — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans, tarea a tarea. Los pasos usan checkbox (`- [ ]`).

**Objetivo:** cada incidencia queda registrada en una entidad `event` de su nivel (válvula, zona o instalación), y el push de cada tipo se configura desde un apartado nuevo «Errores y avisos» en Ajustes.

**Arquitectura:**
- Un catálogo puro en `alerts.py` con los 8 tipos: nivel, prioridad por defecto y prioridades admitidas. También resuelve destinos y prioridad desde `Settings.alerts`.
- El manager concentra toda incidencia en `_async_alert`, que hace tres cosas:
  - emite la señal `SIGNAL_ALERT` hacia las entidades `event`;
  - mantiene el evento de bus;
  - envía el push según la configuración.
- La plataforma `event` crea una entidad por instalación, por zona y por válvula. La de válvula cuelga del dispositivo de la switch.
- El panel tiene una tarjeta nueva, `alert-settings.ts`, que edita `Settings.alerts`.
- Borrar una zona pasa a apagar primero y borrar después.

**Stack:** Python (integración HA 2026.9), Lit 3 + TypeScript (Vite).

**Spec:**
- `docs/superpowers/specs/2026-09-29-incidents-design.md`, decisiones 1–12, «Modelo de datos» e «Interfaz».
- `docs/alerts/spec.md` §0–§6.
- La fase 5 (lluvia) tiene plan aparte. Aquí solo se declaran `rain_skipped` y `rain_source_unavailable` en el catálogo, la entidad y los ajustes. Quien las dispara es la fase 5.

## Restricciones globales

- **Sin tests.** Es una excepción explícita del usuario a TDD. Checks baratos por tarea:
  - backend, en la raíz: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`, sin errores;
  - frontend, en `frontend/`: `npx tsc --noEmit` sin errores;
  - al final (Tarea 6), en `frontend/`: `npm run lint` (`--max-warnings 0`) y `npm run build` sin errores ni avisos.
- **El bundle** `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js` se regenera y se commitea solo en la Tarea 6.
- **No** levantar servidores ni abrir navegador. El usuario valida en su HA 2026.9.
- **HA no está instalado aquí.** Las APIs marcadas con **VERIFICAR** se han escrito de memoria. El usuario las comprueba en su HA; si una firma no cuadra, el implementador para y avisa, sin inventar.
- **Idioma:** comentarios en español; identificadores, claves y ficheros en inglés; ficheros `kebab-case` en el frontend y `snake_case` en Python.
- **Lit sin decoradores:**
  - `static properties`;
  - campos con `declare`;
  - valores por defecto en el `constructor`;
  - registro con `define(...)` de `shared/ha-components.ts`.
- **Textos del panel:** solo vía `t(hass, key)`. Toda clave nueva va en `ES` y `EN` de `i18n.ts`; `EN` es `Record<Key, string>`, así que si falta una `tsc` falla.
- **Traducciones de entidades:** toda clave nueva va en `strings.json`, `translations/en.json` (igual que `strings.json`) y `translations/es.json`.
- **La configuración no silencia el registro** (decisión 8). La entidad `event` y el evento de bus se emiten siempre; `Settings.alerts` solo decide el push.
- **Eventos de bus:** mismo nombre y mismas claves que hoy (decisión 9, `const.py:50-52`).
- **Rama:** `feat/incidents`, desde `main`. Un commit por tarea. La fase 5 sigue en esta misma rama (1 y 2 salen juntos). Sin push ni merge sin petición explícita. Sin worktrees.
- **Commits:** terminan con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018gD1ErwCGgsTydWAqHb61p
  ```

## Mapa de ficheros

Rutas de backend relativas a `custom_components/irrigation_scheduler/`.

| Fichero | Tarea | Qué |
|---|---|---|
| `alerts.py` | 1 (crear) | Catálogo `ALERT_TYPES`, `Alert`, `alert_types`, `alert_config`, `alert_priority`, `push_targets`. Sin HA. |
| `model.py` | 1 | `AlertConfig`, `Settings.alerts`. |
| `validation.py` | 1 | Reglas `alert`, `alert_priority` y `notify` en `alerts`. |
| `websocket.py` | 1, 4 | `ALERT_SCHEMA` en `SETTINGS_SCHEMA`; `_async_run` traduce `ZoneDeleteError`. |
| `notify.py` | 1 | Clave `overrun` → `overrun_restart`. |
| `const.py` | 1, 4 | `SIGNAL_ALERT`; códigos `ZONE_DELETE_BUSY` y `ZONE_DELETE_VALVES_ON`. |
| `manager.py` | 2, 3, 4 | `_async_alert` sustituye a `_async_push`; borrado de entidades de válvula; borrado de zona seguro. |
| `entity.py` | 3 | `IrrigationEntity._signals`. |
| `event.py` | 3 (crear) | Plataforma `event`: `ValveAlertsEvent`, `ZoneAlertsEvent`, `InstallationAlertsEvent`. |
| `__init__.py` | 3 | `Platform.EVENT` en `PLATFORMS`. |
| `strings.json`, `translations/en.json`, `translations/es.json` | 3, 4 | `entity.event.*`, excepción `zone_delete`. |
| `frontend/src/shared/confirm-dialog.ts` | 4 | Opción `single` y `alertDialog()`. |
| `frontend/src/panel/zone-editor.ts` | 4 | Modal al fallar el borrado. |
| `frontend/src/api.ts` | 5 | `AlertPriority`, `AlertConfig`, `Settings.alerts`, `saveSettings`. |
| `frontend/src/alerts.ts` | 5 (crear) | Copia del catálogo para el panel y `alertConfig()`. |
| `frontend/src/panel/notify-targets.ts` | 5 (crear) | `NOTIFY_PREFIX`, `PHONE_ICON`, `targetName`, sacados de `settings-view.ts`. |
| `frontend/src/panel/alert-settings.ts` | 5 (crear) | Tarjeta «Errores y avisos». |
| `frontend/src/panel/settings-view.ts` | 5 | Integra la tarjeta; `alerts` en copia y huella. |
| `frontend/src/i18n.ts` | 4, 5 | Textos nuevos. |
| `docs/alerts/spec.md`, `docs/alerts/README.md` | 6 | Estado «implementada» y datos definitivos. |

---

### Tarea 1: Catálogo, modelo, validación y esquema WS

Base pura sin cambio de comportamiento visible: nadie lee aún `Settings.alerts`.

**Files:**
- Create: `custom_components/irrigation_scheduler/alerts.py`
- Modify: `custom_components/irrigation_scheduler/model.py:96-116`
- Modify: `custom_components/irrigation_scheduler/validation.py:9-10`, `:92-121`
- Modify: `custom_components/irrigation_scheduler/websocket.py:14`, `:43-54`
- Modify: `custom_components/irrigation_scheduler/notify.py:34`, `:51`
- Modify: `custom_components/irrigation_scheduler/const.py:46-48`

**Interfaces:**
- Produces:
  - `model.AlertConfig(push: bool = True, targets: list[str] | None = None, priority: str | None = None, show_in_history: bool = True)` con `AlertConfig.from_dict(data) -> AlertConfig`.
  - `Settings.alerts: dict[str, AlertConfig]` (por defecto `{}`).
  - `alerts.LEVEL_VALVE = "valve"`, `LEVEL_ZONE = "zone"`, `LEVEL_INSTALLATION = "installation"`, `PRIORITIES`.
  - `alerts.ALERT_TYPES: dict[str, AlertType]`, donde `AlertType(level, priority, allowed)`.
  - `alerts.Alert(alert_id: str, zone_id: str | None, entity_id: str | None, data: dict[str, Any])`.
  - `alerts.alert_types(level: str) -> list[str]`.
  - `alerts.alert_config(settings, alert_id) -> AlertConfig`.
  - `alerts.alert_priority(settings, alert_id) -> str`.
  - `alerts.push_targets(settings, alert_id) -> list[str]`.
  - `const.SIGNAL_ALERT`.
  - Clave de push `overrun_restart` en `notify.MESSAGES`.

- [ ] **Paso 1: rama**

```bash
git switch -c feat/incidents
```

- [ ] **Paso 2: `SIGNAL_ALERT` en `const.py`**, tras `SIGNAL_ZONE_ADDED` (`const.py:48`):

```python
# incidencia hacia las entidades event (docs/alerts/spec.md §0.1)
SIGNAL_ALERT = f"{DOMAIN}_alert"
```

- [ ] **Paso 3: `AlertConfig` y `Settings.alerts` en `model.py`.** Insertar antes de `class Settings` (`model.py:97`):

```python
@dataclass
class AlertConfig:
    """Ajustes de un tipo de alerta (2026-09-29-incidents-design.md, «Modelo de datos»)."""

    push: bool = True
    # None = todos los notify_targets, también los que se añadan después
    targets: list[str] | None = None
    # None = la del catálogo (alerts.py)
    priority: str | None = None
    show_in_history: bool = True

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AlertConfig:
        known = {f.name for f in fields(cls)}
        return cls(**{key: value for key, value in data.items() if key in known})
```

En `Settings`, campo nuevo al final (tras `rain_forecast_threshold_mm`, `model.py:106`):

```python
    # clave = ID de alerta; un ID ausente usa los valores por defecto
    alerts: dict[str, AlertConfig] = field(default_factory=dict)
```

Y `Settings.from_dict` pasa a ser:

```python
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Settings:
        known = {f.name for f in fields(cls)}
        values = {key: value for key, value in data.items() if key in known}
        values["alerts"] = {
            alert_id: AlertConfig.from_dict(config)
            for alert_id, config in (data.get("alerts") or {}).items()
        }
        return cls(**values)
```

`to_dict` no cambia: `asdict` ya convierte los `AlertConfig` anidados en dict.

- [ ] **Paso 4: crear `alerts.py`**

```python
"""Catálogo de alertas y resolución del push (docs/alerts/README.md). Sin dependencias de HA."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .const import PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_NORMAL
from .model import AlertConfig, Settings

LEVEL_VALVE = "valve"
LEVEL_ZONE = "zone"
LEVEL_INSTALLATION = "installation"

PRIORITIES = (PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_NORMAL)


@dataclass(frozen=True)
class AlertType:
    level: str
    # prioridad por defecto del push
    priority: str
    # prioridades que admite el ajuste; turn_off_failed no baja de alta (decisión 7)
    allowed: tuple[str, ...] = PRIORITIES


# mismo orden que la tabla de docs/alerts/README.md y que la interfaz (frontend/src/alerts.ts)
ALERT_TYPES: dict[str, AlertType] = {
    "turn_on_failed": AlertType(LEVEL_VALVE, PRIORITY_HIGH),
    "turn_off_failed": AlertType(
        LEVEL_VALVE, PRIORITY_CRITICAL, (PRIORITY_CRITICAL, PRIORITY_HIGH)
    ),
    "overrun_restart": AlertType(LEVEL_VALVE, PRIORITY_HIGH),
    "overrun_running": AlertType(LEVEL_VALVE, PRIORITY_HIGH),
    "manual_overrun": AlertType(LEVEL_VALVE, PRIORITY_HIGH),
    "sensor_unavailable": AlertType(LEVEL_ZONE, PRIORITY_NORMAL),
    "rain_skipped": AlertType(LEVEL_ZONE, PRIORITY_NORMAL),
    "rain_source_unavailable": AlertType(LEVEL_INSTALLATION, PRIORITY_NORMAL),
}


@dataclass(frozen=True)
class Alert:
    """Una incidencia para las entidades event. En las de válvula, `entity_id` es la switch."""

    alert_id: str
    zone_id: str | None
    entity_id: str | None
    # atributos del disparo: los mismos datos que el evento de bus (spec §0.3)
    data: dict[str, Any] = field(default_factory=dict)


def alert_types(level: str) -> list[str]:
    """IDs de un nivel, en orden de catálogo: los event_types de su entidad."""
    return [alert_id for alert_id, alert in ALERT_TYPES.items() if alert.level == level]


def alert_config(settings: Settings, alert_id: str) -> AlertConfig:
    # ID ausente: valores por defecto; sin migración para tipos nuevos
    return settings.alerts.get(alert_id) or AlertConfig()


def alert_priority(settings: Settings, alert_id: str) -> str:
    return alert_config(settings, alert_id).priority or ALERT_TYPES[alert_id].priority


def push_targets(settings: Settings, alert_id: str) -> list[str]:
    """Móviles del push; vacío con el push apagado. Solo los que siguen en notify_targets."""
    config = alert_config(settings, alert_id)
    if not config.push:
        return []
    if config.targets is None:
        return list(settings.notify_targets)
    return [target for target in settings.notify_targets if target in config.targets]
```

- [ ] **Paso 5: validación en `validation.py`.**
  - Import nuevo, tras `from .const import ...` (`validation.py:9`):
    ```python
    from .alerts import ALERT_TYPES
    ```
  - En `validate_settings`, antes de `return issues` (`validation.py:121`):

```python
    for alert_id, alert in settings.alerts.items():
        if alert_id not in ALERT_TYPES:
            issues.append(Issue("alert", ("alerts", alert_id)))
            continue
        # turn_off_failed no admite normal (decisión 7)
        if alert.priority is not None and alert.priority not in ALERT_TYPES[alert_id].allowed:
            issues.append(Issue("alert_priority", ("alerts", alert_id, "priority")))
        for index, target in enumerate(alert.targets or []):
            if not target.startswith(NOTIFY_PREFIX):
                issues.append(Issue("notify", ("alerts", alert_id, "targets", index)))
```

- [ ] **Paso 6: esquema WS en `websocket.py`.**
  - Import nuevo, junto a `from .const import ...` (`websocket.py:14`):
    ```python
    from .alerts import ALERT_TYPES, PRIORITIES
    ```
  - Antes de `SETTINGS_SCHEMA` (`websocket.py:43`):

```python
ALERT_SCHEMA = vol.Schema(
    {
        vol.Required("push"): bool,
        vol.Required("targets"): vol.Any(None, [str]),
        vol.Required("priority"): vol.Any(None, vol.In(PRIORITIES)),
        vol.Required("show_in_history"): bool,
    }
)
```

  - En `SETTINGS_SCHEMA`, clave nueva tras `rain_forecast_threshold_mm`. Una clave fuera del catálogo no pasa `vol.In` y se rechaza:

```python
        vol.Optional("alerts"): {vol.In(list(ALERT_TYPES)): ALERT_SCHEMA},
```

- [ ] **Paso 7: `notify.py`.** Renombrar la clave `"overrun"` a `"overrun_restart"` en `es` (`notify.py:34`) y en `en` (`notify.py:51`). Los textos no cambian. Ahora la clave de push coincide con el ID de alerta.

- [ ] **Paso 8: comprobar que nadie más usa la clave vieja**

Run: `graft grep "\"overrun\""` (o `rg -n '"overrun"' custom_components`)
Expected: solo `manager.py:133`, que se cambia en la Tarea 2. El gate de esta tarea no lo detecta: es un string.

- [ ] **Paso 9: gates**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y compileall sin salida.

- [ ] **Paso 10: commit**

```bash
git add custom_components/irrigation_scheduler/alerts.py custom_components/irrigation_scheduler/model.py custom_components/irrigation_scheduler/validation.py custom_components/irrigation_scheduler/websocket.py custom_components/irrigation_scheduler/notify.py custom_components/irrigation_scheduler/const.py
git commit -m "feat(alerts): catálogo de alertas y ajustes por tipo en Settings.alerts"
```

---

### Tarea 2: `_async_alert` en el manager

Toda incidencia pasa por un solo punto. Resultado visible: el push respeta `Settings.alerts`, y la señal `SIGNAL_ALERT` sale aunque todavía no la escuche nadie.

**Files:**
- Modify: `custom_components/irrigation_scheduler/manager.py:29-49`, `:120-147`, `:149-185`, `:236-251`, `:378-409`

**Interfaces:**
- Consumes: `Alert`, `alert_priority`, `push_targets` (Tarea 1), `SIGNAL_ALERT`, `notify.async_push(hass, targets, kind, priority, **fields)`.
- Produces:
  ```python
  IrrigationManager._async_alert(
      alert_id: str, zone_id: str | None, entity_id: str | None,
      event_type: str, data: dict[str, Any], *, push: bool = True, **push_fields: str,
  ) -> None
  ```
  La fase 5 la usa para `rain_skipped` y `rain_source_unavailable`. `rain_skipped` la llama con
  `push=False` por cada bloque omitido y envía aparte un único push por lote, con
  `alerts.push_targets` y `alert_priority` (`05-rain-skip.md` §7.1, §8.20).

- [ ] **Paso 1: imports.**
  - En `from .const import (...)` (`manager.py:29-47`):
    - añadir `SIGNAL_ALERT`;
    - quitar `PRIORITY_CRITICAL`, `PRIORITY_HIGH` y `PRIORITY_NORMAL`, que quedan sin uso (ruff F401 lo confirma en el paso 7).
  - Tras `from .model import ...` (`manager.py:48`):

```python
from .alerts import Alert, alert_priority, push_targets
```

- [ ] **Paso 2: sustituir `_async_push` (`manager.py:393-409`) por `_async_alert`**

```python
    async def _async_alert(
        self,
        alert_id: str,
        zone_id: str | None,
        entity_id: str | None,
        event_type: str,
        data: dict[str, Any],
        *,
        push: bool = True,
        **push_fields: str,
    ) -> None:
        """Registra una incidencia (docs/alerts/spec.md §0.1).

        Entidad event y evento de bus siempre (decisión 8); el push, según Settings.alerts.
        `push=False`: quien llama agrupa el push (rain_skipped, un push por lote).
        """
        async_dispatcher_send(self.hass, SIGNAL_ALERT, Alert(alert_id, zone_id, entity_id, data))
        self.hass.bus.async_fire(event_type, data)
        settings = self.config.settings
        if not push or not (targets := push_targets(settings, alert_id)):
            return
        zone = self.config.zones.get(zone_id) if zone_id else None
        valve = (
            next((v for v in zone.valves if v.entity_id == entity_id), None) if zone else None
        )
        state = self.hass.states.get(entity_id) if entity_id else None
        # válvula: su nombre propio (V12); sensor u otra entidad: su nombre en HA
        entity = valve.name if valve else state.name if state else entity_id or ""
        await async_push(
            self.hass,
            targets,
            alert_id,
            alert_priority(settings, alert_id),
            zone=zone.name if zone else zone_id or "",
            entity=entity,
            **push_fields,
        )
```

- [ ] **Paso 3: `_async_recover` (`manager.py:129-133`).** El `async_fire` y el `_async_push` pasan a ser:

```python
                    await self._async_alert(
                        "overrun_restart",
                        valve.zone_id,
                        valve.entity_id,
                        EVENT_VALVE_OVERRUN,
                        {"zone_id": valve.zone_id, "entity_id": valve.entity_id},
                    )
```

- [ ] **Paso 4: `_async_heartbeat` (`manager.py:174-185`).** Los dos bucles pasan a ser:

```python
        for zone_id, entity_id in overdue:
            await self._async_alert(
                "overrun_running",
                zone_id,
                entity_id,
                EVENT_VALVE_OVERRUN,
                {"zone_id": zone_id, "entity_id": entity_id},
            )
        for zone_id, entity_id, minutes in manual:
            await self._async_alert(
                "manual_overrun",
                zone_id,
                entity_id,
                EVENT_VALVE_OVERRUN,
                {"zone_id": zone_id, "entity_id": entity_id, "manual": True},
                minutes=str(minutes),
            )
```

- [ ] **Paso 5: `_async_sensor_changed` (`manager.py:245-251`)**

```python
        await self._async_alert(
            "sensor_unavailable",
            zone_id,
            new_state.entity_id,
            EVENT_SENSOR_UNAVAILABLE,
            {"zone_id": zone_id, "entity_id": new_state.entity_id, "state": new_state.state},
            state=new_state.state,
        )
```

Actualizar su docstring (`manager.py:237`):
`"""Alerta sensor_unavailable al pasar un sensor de zona a unavailable/unknown (03 §7.2)."""`

- [ ] **Paso 6: `_async_valve_error` (`manager.py:378-391`)**

```python
    async def _async_valve_error(self, zone_id: str, entity_id: str, turning_on: bool) -> None:
        """La switch no responde tras los reintentos (03 §6)."""
        alert_id = "turn_on_failed" if turning_on else "turn_off_failed"
        await self._async_alert(
            alert_id,
            zone_id,
            entity_id,
            EVENT_VALVE_ERROR,
            {
                "zone_id": zone_id,
                "entity_id": entity_id,
                "action": "turn_on" if turning_on else "turn_off",
                # la configurada: mismas claves que antes, el valor sigue al ajuste
                "priority": alert_priority(self.config.settings, alert_id),
            },
        )
```

- [ ] **Paso 7: no queda ninguna llamada vieja**

Run: `rg -n "_async_push|bus.async_fire" custom_components/irrigation_scheduler/manager.py`
Expected: una sola línea, `self.hass.bus.async_fire(event_type, data)`, dentro de `_async_alert`.

- [ ] **Paso 8: gates**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y compileall sin salida.

- [ ] **Paso 9: commit**

```bash
git add custom_components/irrigation_scheduler/manager.py
git commit -m "feat(alerts): toda incidencia pasa por _async_alert y el push sigue Settings.alerts"
```

---

### Tarea 3: Plataforma `event` en tres niveles

**Files:**
- Create: `custom_components/irrigation_scheduler/event.py`
- Modify: `custom_components/irrigation_scheduler/entity.py:14-25`
- Modify: `custom_components/irrigation_scheduler/__init__.py:26`
- Modify: `custom_components/irrigation_scheduler/manager.py:449-482`, `:546-553`
- Modify: `custom_components/irrigation_scheduler/strings.json`, `translations/en.json`, `translations/es.json` (bloque `entity`)

**Interfaces:**
- Consumes: `Alert`, `ALERT_TYPES`, `alert_types`, `LEVEL_*` (Tarea 1); `SIGNAL_ALERT` enviada por `_async_alert` (Tarea 2).
- Produces:
  - unique_id `f"{zone_id}_alerts"` (zona), `"installation_alerts"` (instalación) y `f"{zone_id}_valve_alerts_{entity_id}"` (válvula);
  - translation_keys `alerts` y `valve_alerts`;
  - `IrrigationManager._remove_entity(registry_entity_id: str) -> None`.

  La tarjeta de histórico (subproyecto 3) localizará las entidades por estos unique_id.

**APIs de HA — VERIFICAR contra 2026.9:**
- `homeassistant.components.event.EventEntity`: `_attr_event_types`, `_trigger_event(event_type, event_attributes)` y, después, `async_write_ha_state()`.
- Traducciones de tipos en `entity.event.<key>.state_attributes.event_type.state.<tipo>`.
- `homeassistant.helpers.device.async_device_info_to_link_from_entity(hass, entity_id_or_uuid) -> DeviceInfo | None`.
- `Entity._attr_translation_placeholders`, para `{valve}` en el nombre.
- `er.async_entries_for_device(registry, device_id, include_disabled_entities=True)`.
- `dr.DeviceRegistry.async_update_device(device_id, remove_config_entry_id=...)`.

- [ ] **Paso 1: señales configurables en `IrrigationEntity` (`entity.py:14-25`).** Las entidades `event` no cambian con el estado del riego. No deben reescribirse en cada `SIGNAL_STATE`.

```python
class IrrigationEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    # señales que repintan la entidad
    _signals: tuple[str, ...] = (SIGNAL_STATE, SIGNAL_CONFIG)

    def __init__(self, manager: IrrigationManager) -> None:
        self._manager = manager

    async def async_added_to_hass(self) -> None:
        for signal in self._signals:
            self.async_on_remove(
                async_dispatcher_connect(self.hass, signal, self.async_write_ha_state)
            )
```

- [ ] **Paso 2: crear `event.py`**

```python
"""Entidades event: registro de incidencias por válvula, zona e instalación.

docs/alerts/spec.md §0.1; decisiones 2-5 de 2026-09-29-incidents-design.md.
"""

from __future__ import annotations

from homeassistant.components.event import EventEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device import async_device_info_to_link_from_entity
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .alerts import (
    ALERT_TYPES,
    LEVEL_INSTALLATION,
    LEVEL_VALVE,
    LEVEL_ZONE,
    Alert,
    alert_types,
)
from .const import SIGNAL_ALERT, SIGNAL_CONFIG, SIGNAL_ZONE_ADDED
from .entity import InstallationEntity, ZoneEntity
from .manager import IrrigationConfigEntry, IrrigationManager


async def async_setup_entry(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    manager = entry.runtime_data
    # (zone_id, entity_id) de las válvulas que ya tienen entidad
    known: set[tuple[str, str]] = set()

    @callback
    def sync_valves() -> None:
        current = {
            (zone_id, valve.entity_id)
            for zone_id, zone in manager.config.zones.items()
            for valve in zone.valves
        }
        # las quitadas las borra el manager del registro; aquí solo se olvidan
        known.intersection_update(current)
        new = sorted(current - known)
        known.update(new)
        if new:
            async_add_entities(
                [ValveAlertsEvent(manager, zone_id, entity_id) for zone_id, entity_id in new]
            )

    @callback
    def add_zone(zone_id: str) -> None:
        # sus válvulas llegan con el SIGNAL_CONFIG que sigue al alta (manager.py:477-481)
        async_add_entities([ZoneAlertsEvent(manager, zone_id)])

    async_add_entities(
        [InstallationAlertsEvent(manager)]
        + [ZoneAlertsEvent(manager, zone_id) for zone_id in manager.config.zones]
    )
    sync_valves()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_ZONE_ADDED, add_zone))
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_CONFIG, sync_valves))


class AlertsEvent(EventEntity):
    """Base: dispara el tipo recibido por SIGNAL_ALERT si es de su nivel y le toca.

    Va antes que ZoneEntity o InstallationEntity en la herencia: su `_signals` manda.
    """

    _level: str
    # solo la configuración cambia su disponibilidad
    _signals = (SIGNAL_CONFIG,)

    def _matches(self, alert: Alert) -> bool:
        raise NotImplementedError

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_ALERT, self._async_handle_alert)
        )

    @callback
    def _async_handle_alert(self, alert: Alert) -> None:
        if ALERT_TYPES[alert.alert_id].level != self._level or not self._matches(alert):
            return
        self._trigger_event(alert.alert_id, alert.data)
        self.async_write_ha_state()


class ValveAlertsEvent(AlertsEvent, ZoneEntity):
    _level = LEVEL_VALVE

    def __init__(self, manager: IrrigationManager, zone_id: str, entity_id: str) -> None:
        super().__init__(manager, zone_id, "valve_alerts")
        self._valve_id = entity_id
        # prefijo zone_id: borrar la zona la borra también (manager._remove_zone_entities)
        self._attr_unique_id = f"{zone_id}_valve_alerts_{entity_id}"
        self._attr_event_types = alert_types(LEVEL_VALVE)
        zone = manager.config.zones[zone_id]
        name = next((v.name for v in zone.valves if v.entity_id == entity_id), entity_id)
        self._attr_translation_placeholders = {"valve": name}
        # en el dispositivo de la switch; si no tiene, en el de la zona (decisión 4)
        if device := async_device_info_to_link_from_entity(manager.hass, entity_id):
            self._attr_device_info = device

    @property
    def available(self) -> bool:
        zone = self.zone
        return zone is not None and any(v.entity_id == self._valve_id for v in zone.valves)

    def _matches(self, alert: Alert) -> bool:
        return alert.zone_id == self._zone_id and alert.entity_id == self._valve_id


class ZoneAlertsEvent(AlertsEvent, ZoneEntity):
    _level = LEVEL_ZONE

    def __init__(self, manager: IrrigationManager, zone_id: str) -> None:
        super().__init__(manager, zone_id, "alerts")
        self._attr_event_types = alert_types(LEVEL_ZONE)

    def _matches(self, alert: Alert) -> bool:
        return alert.zone_id == self._zone_id


class InstallationAlertsEvent(AlertsEvent, InstallationEntity):
    _level = LEVEL_INSTALLATION

    def __init__(self, manager: IrrigationManager) -> None:
        super().__init__(manager, "alerts")
        self._attr_event_types = alert_types(LEVEL_INSTALLATION)

    def _matches(self, alert: Alert) -> bool:
        return True
```

Nota para el implementador:
- `super().__init__(manager, ...)` en `ValveAlertsEvent` resuelve por la MRO: `AlertsEvent` → `EventEntity` no define `__init__` (VERIFICAR), así que llega a `ZoneEntity.__init__`.
- Si `EventEntity` sí define un `__init__` incompatible, parar y avisar.

- [ ] **Paso 3: `Platform.EVENT` en `__init__.py:26`**

```python
PLATFORMS = [Platform.BUTTON, Platform.EVENT, Platform.SELECT, Platform.SENSOR, Platform.SWITCH]
```

- [ ] **Paso 4: borrado de entidades en `manager.py`.** Sustituir `_remove_zone_entities` (`manager.py:546-553`) por:

```python
    def _remove_zone_entities(self, zone_id: str) -> None:
        entities = er.async_get(self.hass)
        for entry in er.async_entries_for_config_entry(entities, self.entry_id):
            if entry.unique_id.startswith(f"{zone_id}_"):
                self._remove_entity(entry.entity_id)
        devices = dr.async_get(self.hass)
        if device := devices.async_get_device(identifiers={(DOMAIN, zone_id)}):
            devices.async_remove_device(device.id)

    def _remove_valve_alerts(self, zone_id: str, entity_ids: set[str]) -> None:
        """Quita la entidad event de las válvulas que salen de la zona (decisión 4)."""
        entities = er.async_get(self.hass)
        for entity_id in entity_ids:
            unique_id = f"{zone_id}_valve_alerts_{entity_id}"
            if registry_id := entities.async_get_entity_id("event", DOMAIN, unique_id):
                self._remove_entity(registry_id)

    def _remove_entity(self, registry_id: str) -> None:
        """Borra la entidad y suelta un dispositivo ajeno que se quede sin entidades nuestras."""
        entities = er.async_get(self.hass)
        if (entry := entities.async_get(registry_id)) is None:
            return
        entities.async_remove(registry_id)
        if entry.device_id is None:
            return
        remaining = er.async_entries_for_device(
            entities, entry.device_id, include_disabled_entities=True
        )
        if any(item.config_entry_id == self.entry_id for item in remaining):
            return
        devices = dr.async_get(self.hass)
        device = devices.async_get(entry.device_id)
        # los dispositivos propios (zona, instalación) se gestionan aparte
        if device and not any(domain == DOMAIN for domain, _id in device.identifiers):
            devices.async_update_device(device.id, remove_config_entry_id=self.entry_id)
```

- [ ] **Paso 5: `async_save_zone` quita las entidades de válvulas eliminadas (`manager.py:462-481`).**
  - Dentro del `async with self._lock:`, antes de `self.config.zones[zone.zone_id] = zone`:

```python
            previous = self.config.zones.get(zone.zone_id)
            kept = {valve.entity_id for valve in zone.valves}
            removed = {v.entity_id for v in previous.valves} - kept if previous else set()
```

  - Borrar la línea `kept = {...}` que ya había dentro (`manager.py:466`).
  - Tras `if self._started: self._track_zone(zone)`:

```python
        self._remove_valve_alerts(zone.zone_id, removed)
```

- [ ] **Paso 6: traducciones.** En `strings.json` y `translations/en.json`, dentro de `"entity"`, añadir la clave `"event"` (orden alfabético: tras `"button"`):

```json
    "event": {
      "alerts": {
        "name": "Alerts",
        "state_attributes": {
          "event_type": {
            "state": {
              "turn_on_failed": "Did not turn on",
              "turn_off_failed": "Did not turn off",
              "overrun_restart": "Time exceeded while HA was down",
              "overrun_running": "Time exceeded",
              "manual_overrun": "Turned on manually too long",
              "sensor_unavailable": "Sensor unavailable",
              "rain_skipped": "Skipped due to rain",
              "rain_source_unavailable": "Rain source unavailable"
            }
          }
        }
      },
      "valve_alerts": {
        "name": "{valve} alerts",
        "state_attributes": {
          "event_type": {
            "state": {
              "turn_on_failed": "Did not turn on",
              "turn_off_failed": "Did not turn off",
              "overrun_restart": "Time exceeded while HA was down",
              "overrun_running": "Time exceeded",
              "manual_overrun": "Turned on manually too long"
            }
          }
        }
      }
    },
```

En `translations/es.json`, la misma estructura con estos textos:

| Clave | Texto |
|---|---|
| `alerts.name` | `Alertas` |
| `valve_alerts.name` | `Alertas {valve}` |
| `turn_on_failed` | `No enciende` |
| `turn_off_failed` | `No apaga` |
| `overrun_restart` | `Tiempo excedido con HA parado` |
| `overrun_running` | `Tiempo excedido` |
| `manual_overrun` | `Encendida a mano demasiado tiempo` |
| `sensor_unavailable` | `Sensor no disponible` |
| `rain_skipped` | `Omitido por lluvia` |
| `rain_source_unavailable` | `Fuente de lluvia no disponible` |

- [ ] **Paso 7: JSON válido**

Run: `py -3.14 -c "import json,sys;[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]" custom_components/irrigation_scheduler/strings.json custom_components/irrigation_scheduler/translations/en.json custom_components/irrigation_scheduler/translations/es.json`
Expected: sin salida.

- [ ] **Paso 8: gates**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y compileall sin salida.

- [ ] **Paso 9: commit**

```bash
git add custom_components/irrigation_scheduler/event.py custom_components/irrigation_scheduler/entity.py custom_components/irrigation_scheduler/__init__.py custom_components/irrigation_scheduler/manager.py custom_components/irrigation_scheduler/strings.json custom_components/irrigation_scheduler/translations
git commit -m "feat(alerts): entidades event de válvula, zona e instalación"
```

---

### Tarea 4: Borrar una zona apaga primero y borra después

Decisión 11 y `docs/alerts/spec.md` §2.

**Files:**
- Modify: `custom_components/irrigation_scheduler/const.py` (tras `SIGNAL_ALERT`)
- Modify: `custom_components/irrigation_scheduler/manager.py:342-376`, `:484-505`, `:588-618`
- Modify: `custom_components/irrigation_scheduler/websocket.py:90-99`
- Modify: `frontend/src/shared/confirm-dialog.ts`
- Modify: `frontend/src/panel/zone-editor.ts:411-429`
- Modify: `frontend/src/i18n.ts` (ES y EN)

**Interfaces:**
- Consumes: `_async_valve_error` → `turn_off_failed` en la entidad `event` de la válvula (Tareas 2 y 3).
- Produces:
  - `const.ZONE_DELETE_BUSY = "zone_busy"` y `const.ZONE_DELETE_VALVES_ON = "valves_not_off"`;
  - `manager.ZoneDeleteError(reason: str, valves: list[str])`;
  - error WS con `code` = `reason` y `message` = nombres de válvula separados por coma;
  - `_async_finish_close` y `_async_close_manual` devuelven `bool`;
  - `_async_pause` devuelve `list[str]` con las switch que no apagaron;
  - `alertDialog(hass, text): Promise<void>` en `shared/confirm-dialog.ts`.

- [ ] **Paso 1: códigos en `const.py`**, tras `SIGNAL_ALERT`:

```python
# códigos WS de un borrado de zona que no sigue (docs/alerts/spec.md §2)
ZONE_DELETE_BUSY = "zone_busy"
ZONE_DELETE_VALVES_ON = "valves_not_off"
```

- [ ] **Paso 2: los cierres devuelven si apagaron.**
  - `_async_finish_close` (`manager.py:342`):
    - la firma pasa a `-> bool`;
    - al final, tras el `if not ok and valve is not None: ...`, añadir `return ok`.
  - `_async_close_manual` (`manager.py:369`):
    - la firma pasa a `-> bool`;
    - al final, añadir `return ok`.
  - Los demás llamadores ignoran el valor, así que nada más cambia.

- [ ] **Paso 3: `_async_pause` devuelve los fallos (`manager.py:588-618`).**
  - La firma pasa a `-> list[str]`.
  - Docstring, añadir: `Devuelve las switch que no apagaron; su turn_off_failed ya ha saltado.`
  - Sustituir el `await asyncio.gather(...)` final por:

```python
        results = await asyncio.gather(
            *(self._async_finish_close(entity_id) for entity_id in closing),
            *(self._async_close_manual(zone_id, entity_id) for zone_id, entity_id in manual),
        )
        entity_ids = [*closing, *(entity_id for _zone_id, entity_id in manual)]
        return [entity_id for entity_id, ok in zip(entity_ids, results, strict=True) if not ok]
```

`async_stop` y `async_pause_valve` siguen devolviendo `None`: hacen `await` sin usar el valor.

- [ ] **Paso 4: `ZoneDeleteError` en `manager.py`.**
  - Import: `from homeassistant.exceptions import HomeAssistantError, ServiceValidationError` (`manager.py:16`).
  - En `from .const import (...)`, añadir `ZONE_DELETE_BUSY` y `ZONE_DELETE_VALVES_ON`.
  - Tras `ZONE_OPTIONS` (`manager.py:58`):

```python
class ZoneDeleteError(HomeAssistantError):
    """El borrado de zona no sigue. `reason`: código WS; `valves`: nombres afectados."""

    def __init__(self, reason: str, valves: list[str]) -> None:
        super().__init__(reason)
        self.reason = reason
        self.valves = valves
```

- [ ] **Paso 5: nuevo `async_delete_zone` (`manager.py:484-505`)**

```python
    async def async_delete_zone(self, zone_id: str) -> None:
        """Detiene la zona y la borra solo si todo apagó (docs/alerts/spec.md §2)."""
        zone = self._get_zone(zone_id)
        names = {valve.entity_id: valve.name for valve in zone.valves}
        failed = await self._async_pause(lambda job_zone, _entity: job_zone == zone_id)
        if failed:
            # la zona se queda: la entidad event de cada válvula ya tiene su turn_off_failed
            raise ZoneDeleteError(ZONE_DELETE_VALVES_ON, [names.get(e, e) for e in failed])
        async with self._lock:
            # una apertura en curso o un bloque disparado durante el apagado
            busy = [e for e, valve in self.runtime.open_valves.items() if valve.zone_id == zone_id]
            busy += [e for e, opening_zone in self._opening.items() if opening_zone == zone_id]
            if busy:
                raise ZoneDeleteError(ZONE_DELETE_BUSY, [names.get(e, e) for e in busy])
            self.runtime.pending = [job for job in self.runtime.pending if job.zone_id != zone_id]
            del self.config.zones[zone_id]
            await self._store.async_save_config(self.config)
            await self._async_persist()
            await self._async_dispatch_locked()
        self._untrack_zone(zone_id)
        self._remove_zone_entities(zone_id)
        async_dispatcher_send(self.hass, SIGNAL_CONFIG)
```

- [ ] **Paso 6: WS traduce el error (`websocket.py:90-99`).**
  - Import: `from .manager import IrrigationManager, ZoneDeleteError`.
  - En `_async_run`, tras el `except ServiceValidationError`:

```python
    except ZoneDeleteError as err:
        # el panel compone el texto en su idioma con el código y las válvulas
        connection.send_error(msg_id, err.reason, ", ".join(err.valves))
        return
```

- [ ] **Paso 7: gates de backend**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y compileall sin salida.

- [ ] **Paso 8: diálogo de aviso en `shared/confirm-dialog.ts`.**
  - Import: `import { css, html, LitElement, nothing } from "lit";`.
  - En `ConfirmOptions`:

```ts
  /** solo el botón de confirmar: aviso sin elección */
  single?: boolean;
```

  - En `render()`:
    - desestructurar `single`;
    - el botón de cancelar pasa a `${single ? nothing : html`<button @click=${() => this.close(false)}>${t(this.hass, "cancel")}</button>`}`.
  - Al final del fichero:

```ts
/** Aviso modal con un solo botón. */
export async function alertDialog(hass: Hass | undefined, text: string): Promise<void> {
  await confirmDialog(hass, { text, confirmText: t(hass, "dialog_ok"), single: true });
}
```

- [ ] **Paso 9: textos en `i18n.ts`**, junto a `zone_deleted`:

| Clave | ES | EN |
|---|---|---|
| `dialog_ok` | `Aceptar` | `OK` |
| `delete_valves_not_off` | `No se ha borrado la zona: {valves} no se ha apagado. Revísala y vuelve a intentarlo.` | `The zone was not deleted: {valves} did not turn off. Check it and try again.` |
| `delete_zone_busy` | `No se ha borrado la zona: {valves} se está abriendo o cerrando. Vuelve a intentarlo en unos segundos.` | `The zone was not deleted: {valves} is opening or closing. Try again in a few seconds.` |

- [ ] **Paso 10: modal en `zone-editor.ts` (`removeZone`, `:411-429`).**
  - Import: `import { alertDialog, confirmDialog } from "../shared/confirm-dialog";`.
  - El `catch` pasa a:

```ts
    } catch (err) {
      this.deleting = false;
      const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown };
      const valves = typeof message === "string" ? message : "";
      if (code === "valves_not_off") await alertDialog(this.hass, t(this.hass, "delete_valves_not_off", { valves }));
      else if (code === "zone_busy") await alertDialog(this.hass, t(this.hass, "delete_zone_busy", { valves }));
      else showToast(this, errorMessage(this.hass, err));
    }
```

- [ ] **Paso 11: tipos**

Run (en `frontend/`): `npx tsc --noEmit`
Expected: sin salida.

- [ ] **Paso 12: commit**

```bash
git add custom_components/irrigation_scheduler/const.py custom_components/irrigation_scheduler/manager.py custom_components/irrigation_scheduler/websocket.py frontend/src/shared/confirm-dialog.ts frontend/src/panel/zone-editor.ts frontend/src/i18n.ts
git commit -m "fix(zones): borrar una zona apaga primero y no borra si alguna válvula no apaga"
```

---

### Tarea 5: Apartado «Errores y avisos» en Ajustes

Spec, «Interfaz del apartado «Errores y avisos»».

**Files:**
- Modify: `frontend/src/api.ts:91-100`, `:171-186`
- Create: `frontend/src/alerts.ts`
- Create: `frontend/src/panel/notify-targets.ts`
- Create: `frontend/src/panel/alert-settings.ts`
- Modify: `frontend/src/panel/settings-view.ts:1-34`, `:127-134`
- Modify: `frontend/src/i18n.ts` (ES y EN)

**Interfaces:**
- Consumes: esquema `alerts` del WS (Tarea 1); regla `alert_priority` y `notify` con ruta `alerts.<id>.…`.
- Produces:
  - `api.AlertPriority`, `api.AlertConfig`, `Settings.alerts: Record<string, AlertConfig>`;
  - `alerts.ALERT_TYPES: AlertType[]`, `alerts.ALERT_LEVELS`, `alerts.alertConfig(settings, id): AlertConfig`;
  - elemento `irrigation-alert-settings` con propiedades `hass`, `settings`, `readOnly` y `errors`, que emite `alerts-changed` con `detail: Record<string, AlertConfig>`.

  El subproyecto 3 reutiliza `alerts.ts` para filtrar por `show_in_history`.

- [ ] **Paso 1: tipos en `api.ts`.** Antes de `interface Settings` (`api.ts:91`):

```ts
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
```

- En `Settings`, campo nuevo:
  ```ts
    // solo los tipos editados alguna vez; el resto, valores por defecto
    alerts: Record<string, AlertConfig>;
  ```
- En el `payload` de `saveSettings`: `alerts: settings.alerts,`.

- [ ] **Paso 2: crear `frontend/src/alerts.ts`**

```ts
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
}

const ALL: AlertPriority[] = ["critical", "high", "normal"];

export const ALERT_LEVELS: AlertLevel[] = ["valve", "zone", "installation"];

export const ALERT_TYPES: AlertType[] = [
  { id: "turn_on_failed", level: "valve", priority: "high", allowed: ALL, name: "alert_turn_on_failed", help: "alert_turn_on_failed_help" },
  // no baja de alta (decisión 7)
  { id: "turn_off_failed", level: "valve", priority: "critical", allowed: ["critical", "high"], name: "alert_turn_off_failed", help: "alert_turn_off_failed_help" },
  { id: "overrun_restart", level: "valve", priority: "high", allowed: ALL, name: "alert_overrun_restart", help: "alert_overrun_restart_help" },
  { id: "overrun_running", level: "valve", priority: "high", allowed: ALL, name: "alert_overrun_running", help: "alert_overrun_running_help" },
  { id: "manual_overrun", level: "valve", priority: "high", allowed: ALL, name: "alert_manual_overrun", help: "alert_manual_overrun_help" },
  { id: "sensor_unavailable", level: "zone", priority: "normal", allowed: ALL, name: "alert_sensor_unavailable", help: "alert_sensor_unavailable_help" },
  { id: "rain_skipped", level: "zone", priority: "normal", allowed: ALL, name: "alert_rain_skipped", help: "alert_rain_skipped_help" },
  { id: "rain_source_unavailable", level: "installation", priority: "normal", allowed: ALL, name: "alert_rain_source_unavailable", help: "alert_rain_source_unavailable_help" },
];

const DEFAULT_ALERT: AlertConfig = { push: true, targets: null, priority: null, show_in_history: true };

/** Ajustes efectivos de un tipo: un ID ausente usa los valores por defecto. */
export function alertConfig(settings: Settings, id: string): AlertConfig {
  return { ...DEFAULT_ALERT, ...settings.alerts[id] };
}
```

- [ ] **Paso 3: crear `frontend/src/panel/notify-targets.ts`.** Mover desde `settings-view.ts:9-11` y `:31-34`, sin cambios:

```ts
// móviles de la app de HA: servicios notify.mobile_app_*

export const NOTIFY_PREFIX = "notify.mobile_app_";
// mdi:cellphone
export const PHONE_ICON =
  "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z";

/** «notify.mobile_app_movil_principal» → «movil principal». */
export function targetName(target: string): string {
  return target.slice(NOTIFY_PREFIX.length).replaceAll("_", " ");
}
```

En `settings-view.ts`:
- borrar esas definiciones;
- importar: `import { NOTIFY_PREFIX, PHONE_ICON, targetName } from "./notify-targets";`.

- [ ] **Paso 4: textos en `i18n.ts`.**
  - Claves nuevas, tras `no_targets`, en ES y EN.
  - `notifications_help` cambia de texto: ahora los móviles valen para todas las alertas.

| Clave | ES | EN |
|---|---|---|
| `notifications_help` (cambia) | `Móviles que reciben los push. Pulsa uno para activarlo o quitarlo. Cada alerta elige cuáles en «Errores y avisos».` | `Phones that receive push alerts. Tap one to turn it on or off. Each alert picks which ones in «Errors and alerts».` |
| `alerts` | `Errores y avisos` | `Errors and alerts` |
| `alerts_help` | `Qué alertas llegan al móvil y cuáles salen en el histórico. Todas quedan siempre registradas en HA.` | `Which alerts reach your phone and which show in the history. All are always recorded in HA.` |
| `alerts_no_targets` | `No hay móviles en Notificaciones: activa alguno para recibir push.` | `No phones in Notifications: turn one on to receive push alerts.` |
| `level_valve` | `Válvula` | `Valve` |
| `level_zone` | `Zona` | `Zone` |
| `level_installation` | `Instalación` | `Installation` |
| `alert_push` | `Push` | `Push` |
| `alert_priority` | `Prioridad` | `Priority` |
| `alert_history` | `Histórico` | `History` |
| `alert_details` | `Más opciones` | `More options` |
| `alert_all_targets` | `Todos` | `All` |
| `priority_critical` | `Crítica` | `Critical` |
| `priority_high` | `Alta` | `High` |
| `priority_normal` | `Normal` | `Normal` |
| `alert_turn_on_failed` | `La válvula no enciende` | `Valve does not turn on` |
| `alert_turn_on_failed_help` | `No responde al encender tras 3 reintentos. Se descarta y la cola sigue.` | `No response to turn on after 3 retries. The job is dropped and the queue continues.` |
| `alert_turn_off_failed` | `La válvula no apaga` | `Valve does not turn off` |
| `alert_turn_off_failed_help` | `No responde al apagar tras 3 reintentos: puede seguir regando. Prioridad mínima: alta.` | `No response to turn off after 3 retries: it may still be watering. Minimum priority: high.` |
| `alert_overrun_restart` | `Tiempo excedido con HA parado` | `Time exceeded while HA was down` |
| `alert_overrun_restart_help` | `Al arrancar HA, una válvula había pasado su tiempo. Se apaga.` | `On HA start, a valve was past its time. It is turned off.` |
| `alert_overrun_running` | `Tiempo excedido` | `Time exceeded` |
| `alert_overrun_running_help` | `Seguía abierta pasado su tiempo. La apaga la vigilancia cada 5 min.` | `Still open past its time. The 5-minute check turns it off.` |
| `alert_manual_overrun` | `Encendida a mano demasiado tiempo` | `Turned on manually too long` |
| `alert_manual_overrun_help` | `Encendida fuera del riego más de su duración. La apaga la vigilancia cada 5 min.` | `Turned on outside irrigation for longer than its duration. The 5-minute check turns it off.` |
| `alert_sensor_unavailable` | `Sensor no disponible` | `Sensor unavailable` |
| `alert_sensor_unavailable_help` | `Un sensor de la zona pasa a no disponible o desconocido.` | `A zone sensor becomes unavailable or unknown.` |
| `alert_rain_skipped` | `Riego omitido por lluvia` | `Watering skipped due to rain` |
| `alert_rain_skipped_help` | `Un bloque de la zona no riega por lluvia. Un push al empezar a omitir por lluvia en la zona.` | `A zone block does not water due to rain. One push when the zone starts skipping for rain.` |
| `alert_rain_source_unavailable` | `Fuente de lluvia no disponible` | `Rain source unavailable` |
| `alert_rain_source_unavailable_help` | `El pluviómetro o el pronóstico no dan datos al decidir. Se riega.` | `The rain gauge or the forecast gives no data when deciding. It waters.` |
| `rule_alert` | `Alerta desconocida` | `Unknown alert` |
| `rule_alert_priority` | `Prioridad no permitida en esta alerta` | `Priority not allowed for this alert` |

`ruleMessage` (`i18n.ts:391-399`) ya resuelve `rule_<regla>`: no cambia.

- [ ] **Paso 5: crear `frontend/src/panel/alert-settings.ts`**

```ts
import { css, html, LitElement, nothing, type TemplateResult } from "lit";

import { ALERT_LEVELS, ALERT_TYPES, alertConfig, type AlertLevel, type AlertType } from "../alerts";
import type { AlertConfig, AlertPriority, Hass, Settings } from "../api";
import { t, type Key } from "../i18n";
import { fireEvent, svgIcon } from "../shared/controls";
import { define } from "../shared/ha-components";
import { sharedStyles } from "../shared/styles";
import { PHONE_ICON, targetName } from "./notify-targets";

const LEVEL_KEYS: Record<AlertLevel, Key> = {
  valve: "level_valve",
  zone: "level_zone",
  installation: "level_installation",
};

const PRIORITY_KEYS: Record<AlertPriority, Key> = {
  critical: "priority_critical",
  high: "priority_high",
  normal: "priority_normal",
};

/** Tarjeta «Errores y avisos» de Ajustes: push, móviles, prioridad e histórico por tipo. */
export class AlertSettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    settings: { attribute: false },
    readOnly: { type: Boolean },
    errors: { attribute: false },
    _open: { state: true },
  };

  declare hass: Hass;
  declare settings: Settings;
  declare readOnly: boolean;
  declare errors: Record<string, string>;
  // tipo desplegado con ›
  declare _open: string | null;

  constructor() {
    super();
    this.readOnly = false;
    this.errors = {};
    this._open = null;
  }

  private change(id: string, patch: Partial<AlertConfig>): void {
    const next = { ...alertConfig(this.settings, id), ...patch };
    fireEvent(this, "alerts-changed", { ...this.settings.alerts, [id]: next });
  }

  private toggleAll(id: string, config: AlertConfig): void {
    // al apagar «Todos» se parte de todos marcados, para quitar uno a uno
    this.change(id, { targets: config.targets === null ? [...this.settings.notify_targets] : null });
  }

  private toggleTarget(id: string, targets: string[], target: string): void {
    this.change(id, {
      targets: targets.includes(target) ? targets.filter((item) => item !== target) : [...targets, target],
    });
  }

  private error(path: string): TemplateResult | typeof nothing {
    const message = this.errors[path];
    return message ? html`<div class="error-text">${message}</div>` : nothing;
  }

  protected render() {
    const hass = this.hass;
    if (!hass || !this.settings) return nothing;
    const noTargets = this.settings.notify_targets.length === 0;
    return html`<div class="card section">
      <div class="label">${t(hass, "alerts")}</div>
      <div class="muted small help">${t(hass, "alerts_help")}</div>
      ${noTargets ? html`<div class="banner warning">${t(hass, "alerts_no_targets")}</div>` : nothing}
      ${ALERT_LEVELS.map(
        (level) => html`<div class="row head">
            <span class="name">${t(hass, LEVEL_KEYS[level])}</span>
            <span class="cell">${t(hass, "alert_push")}</span>
            <span class="cell">${t(hass, "alert_priority")}</span>
            <span class="cell">${t(hass, "alert_history")}</span>
            <span class="expand"></span>
          </div>
          ${ALERT_TYPES.filter((type) => type.level === level).map((type) => this.renderRow(type, noTargets))}`,
      )}
    </div>`;
  }

  private renderRow(type: AlertType, noTargets: boolean): TemplateResult {
    const hass = this.hass;
    const config = alertConfig(this.settings, type.id);
    const pushOff = !config.push || noTargets;
    const open = this._open === type.id;
    return html`<div class="row">
        <span class="name">${t(hass, type.name)}</span>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${config.push && !noTargets}
            ?disabled=${this.readOnly || noTargets}
            @change=${(ev: Event) => this.change(type.id, { push: (ev.target as HTMLInputElement).checked })}
          />
          <span class="inline-label">${t(hass, "alert_push")}</span>
        </label>
        <select
          class="cell"
          aria-label=${t(hass, "alert_priority")}
          ?disabled=${this.readOnly || pushOff}
          @change=${(ev: Event) =>
            this.change(type.id, { priority: (ev.target as HTMLSelectElement).value as AlertPriority })}
        >
          ${type.allowed.map(
            (priority) =>
              html`<option .value=${priority} ?selected=${(config.priority ?? type.priority) === priority}>
                ${t(hass, PRIORITY_KEYS[priority])}
              </option>`,
          )}
        </select>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${config.show_in_history}
            ?disabled=${this.readOnly}
            @change=${(ev: Event) =>
              this.change(type.id, { show_in_history: (ev.target as HTMLInputElement).checked })}
          />
          <span class="inline-label">${t(hass, "alert_history")}</span>
        </label>
        <button
          class="expand ${open ? "open" : ""}"
          aria-label=${t(hass, "alert_details")}
          aria-expanded=${open ? "true" : "false"}
          @click=${() => (this._open = open ? null : type.id)}
        >
          ›
        </button>
      </div>
      ${this.error(`alerts.${type.id}.priority`)} ${open ? this.renderDetail(type, config, pushOff) : nothing}`;
  }

  private renderDetail(type: AlertType, config: AlertConfig, pushOff: boolean): TemplateResult {
    const hass = this.hass;
    const all = config.targets === null;
    const selected = config.targets ?? [];
    return html`<div class="detail">
      <div class="muted small">${t(hass, type.help)}</div>
      <div class="chips">
        <button
          class="chip ${all ? "on" : ""}"
          ?disabled=${this.readOnly || pushOff}
          aria-pressed=${all ? "true" : "false"}
          @click=${() => this.toggleAll(type.id, config)}
        >
          ${t(hass, "alert_all_targets")}
        </button>
        ${this.settings.notify_targets.map((target) => {
          const on = all || selected.includes(target);
          return html`<button
            class="chip with-icon ${on ? "on" : ""}"
            ?disabled=${this.readOnly || pushOff || all}
            title=${target}
            aria-pressed=${on ? "true" : "false"}
            @click=${() => this.toggleTarget(type.id, selected, target)}
          >
            ${svgIcon(PHONE_ICON)}${targetName(target)}
          </button>`;
        })}
      </div>
      ${selected.map((_target, index) => this.error(`alerts.${type.id}.targets.${index}`))}
    </div>`;
  }

  static styles = [
    sharedStyles,
    css`
      .help {
        margin-bottom: 12px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 64px 112px 72px 32px;
        align-items: center;
        gap: 8px;
        min-height: 40px;
      }
      .row.head {
        margin-top: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .cell {
        justify-self: center;
      }
      select.cell {
        justify-self: stretch;
      }
      input[type="checkbox"] {
        accent-color: var(--primary-color);
      }
      .inline-label {
        display: none;
      }
      .expand {
        background: none;
        border: none;
        color: var(--secondary-text-color);
        font-size: 1.25rem;
        cursor: pointer;
        transition: transform 0.15s;
      }
      .expand.open {
        transform: rotate(90deg);
      }
      .detail {
        padding: 4px 0 12px;
      }
      .detail .chips {
        margin-top: 8px;
      }
      /* estrecho: Push, Prioridad e Histórico bajan a una segunda línea bajo el nombre */
      @media (max-width: 600px) {
        .row {
          grid-template-columns: auto auto 1fr 32px;
          row-gap: 4px;
        }
        .row .name {
          grid-column: 1 / 4;
        }
        .row .expand {
          grid-column: 4;
          grid-row: 1;
        }
        .row.head .cell {
          display: none;
        }
        .inline-label {
          display: inline;
        }
      }
    `,
  ];
}

define("irrigation-alert-settings", AlertSettings);
```

- [ ] **Paso 6: integrar en `settings-view.ts`.**
  - Imports:
    ```ts
    import { ALERT_TYPES, alertConfig } from "../alerts";
    import type { AlertConfig } from "../api";
    import "./alert-settings";
    ```
    Si `type Settings` ya viene del import de `../api`, se une a él.
  - `copySettings` (`settings-view.ts:13-15`):
    ```ts
    return { ...settings, notify_targets: [...settings.notify_targets], alerts: { ...settings.alerts } };
    ```
  - `settingsKey` (`settings-view.ts:18-29`): añadir como último elemento del array:
    ```ts
    // valores efectivos: guardar un tipo con sus valores por defecto no cuenta como cambio
    ALERT_TYPES.map((type) => {
      const config = alertConfig(settings, type.id);
      return [config.push, config.targets, config.priority, config.show_in_history];
    }),
    ```
  - `render()` (`settings-view.ts:131-133`): tras `${this.renderNotifications(draft, readOnly)}`:

```ts
    <irrigation-alert-settings
      .hass=${this.hass}
      .settings=${draft}
      .readOnly=${readOnly}
      .errors=${this._errors}
      @alerts-changed=${(ev: CustomEvent<Record<string, AlertConfig>>) => this.patch({ alerts: ev.detail })}
    ></irrigation-alert-settings>
```

  `patch` ya limpia los errores con prefijo `alerts.` (`settings-view.ts:80-83`).

- [ ] **Paso 7: tipos**

Run (en `frontend/`): `npx tsc --noEmit`
Expected: sin salida.

- [ ] **Paso 8: commit**

```bash
git add frontend/src/api.ts frontend/src/alerts.ts frontend/src/panel/notify-targets.ts frontend/src/panel/alert-settings.ts frontend/src/panel/settings-view.ts frontend/src/i18n.ts
git commit -m "feat(settings): apartado «Errores y avisos» con push, móviles, prioridad e histórico por tipo"
```

---

### Tarea 6: Lint, build, bundle y docs

**Files:**
- Modify: `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js` (generado)
- Modify: `docs/alerts/spec.md`, `docs/alerts/README.md`

- [ ] **Paso 1: lint**

Run (en `frontend/`): `npm run lint`
Expected: sin errores ni avisos. Si falla, corregir en el fichero señalado sin cambiar el comportamiento.

- [ ] **Paso 2: build**

Run (en `frontend/`): `npm run build`
Expected: termina sin errores ni avisos y reescribe `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`.

- [ ] **Paso 3: gates de backend otra vez**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y compileall sin salida.

- [ ] **Paso 4: docs de alertas.** En `docs/alerts/spec.md`:
  - §1-§6, fila «Estado»: `Implementada: entidad event, evento de bus y push configurable`.
  - §0.1 paso 4: la referencia a `_async_push` pasa a `IrrigationManager._async_alert` con su `manager.py:línea` real, y se añade `alerts.push_targets` / `alert_priority`.
  - §0.3: sustituir «Los nombres definitivos se fijan en el plan» por:
    - Los atributos de cada disparo son exactamente los datos del evento de bus.
    - Entidades:
      - válvula: unique_id `<zone_id>_valve_alerts_<switch>`, nombre «Alertas <válvula>», en el dispositivo de la switch;
      - zona: `<zone_id>_alerts`;
      - instalación: `installation_alerts`.
  - §2, «Borrado de zona»: citar `async_delete_zone` y los códigos WS `valves_not_off` / `zone_busy`.
  - §3, texto de push: `MESSAGES[...]["overrun_restart"]`.
  - Todas las citas `archivo:línea` de §0-§6 se revisan contra el código nuevo, con `graft grep` de cada símbolo.
  - «Pendiente»: dejar solo lo de la fase 5 (evento de bus y textos de `rain_skipped` / `rain_source_unavailable`).

  En `docs/alerts/README.md`, los estados de los 6 tipos implementados igual que arriba.

- [ ] **Paso 5: commit**

```bash
git add custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js docs/alerts
git commit -m "build: bundle con «Errores y avisos»; docs de alertas al día"
```

---

## Validación en HA (la hace el usuario)

Solo como referencia de qué mirar, sin plan de pruebas formal:
- las entidades `event` aparecen en los 3 niveles;
- la de válvula sale en el dispositivo de la switch;
- quitar una válvula de la zona borra su entidad;
- desactivar el push de un tipo no impide que la entidad registre;
- borrar una zona con una switch que no responde muestra el modal y no borra.
