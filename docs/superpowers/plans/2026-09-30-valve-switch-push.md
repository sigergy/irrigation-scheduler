# Push al encender y al apagar una válvula — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un tipo de aviso nuevo, `valve_switched`, que envía un push al encender y otro al apagar cualquier switch configurada.

**Architecture:** el listener que ya vigila las switch (`manager.py:286`) detecta las transiciones `off→on` y `on→off`. En la transición a `on` guarda el origen del riego; en la transición a `off` lo recupera y calcula la duración. El push usa los ajustes del tipo `valve_switched` del catálogo de alertas, que está marcado `push_only`: no entra en las entidades `event`, no emite evento de bus y no pinta marca. En la interfaz, la casilla «Histórico» de ese tipo sale desmarcada y bloqueada.

**Tech Stack:** Home Assistant 2026.9 (Python), Lit 3 / TypeScript (Vite).

**Spec:** `docs/superpowers/specs/2026-09-30-valve-switch-push-design.md`.

## Global Constraints

- Sin tests (excepción del usuario). Gates:
  - backend: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`;
  - frontend, en `frontend/`: `npx tsc --noEmit`, `npm run lint` y `npm run build`.
- Sin servidores, navegador ni plan de pruebas. El usuario valida en su HA 2026.9.
- ID del tipo: `valve_switched`. Nivel válvula, prioridad por defecto normal, las tres prioridades permitidas, push activado por defecto.
- Solo push: sin entidad `event`, sin evento de bus y sin marca en el histórico.
- Mensajes ES: `"{zone}: {entity} encendida{origin} a las {time}."` y `"{zone}: {entity} apagada a las {time} tras {duration}{origin}."`.
- Mensajes EN: `"{zone}: {entity} turned on{origin} at {time}."` y `"{zone}: {entity} turned off at {time} after {duration}{origin}."`.
- `{origin}`: ` (programado)` · ` (manual)` · ` (externo)`, o en EN ` (scheduled)` · ` (manual)` · ` (external)`. Vacío si no se conoce.
- `{duration}`: menos de 1 min `45 s`; menos de 1 h `3 min` (minutos enteros redondeados); desde 1 h `1 h 5 min`, o `1 h` si los minutos son 0.
- Comentarios en español e identificadores en inglés. Lit sin decoradores. Textos del panel solo vía `t(hass, key)`, en ES y EN.

---

### Task 1: Backend — tipo `valve_switched`, detección y push

**Files:**
- Modify: `custom_components/irrigation_scheduler/alerts.py` (`AlertType`, `ALERT_TYPES`, `alert_types`)
- Modify: `custom_components/irrigation_scheduler/notify.py` (`MESSAGES`, función nueva `duration_text`)
- Modify: `custom_components/irrigation_scheduler/manager.py` (imports, `__init__`, `_async_valve_state_changed`, método nuevo `_async_push_switched`)

**Interfaces:**
- Produces: `AlertType.push_only: bool`, `ALERT_TYPES["valve_switched"]`, `duration_text(seconds: float) -> str`, claves de `MESSAGES` `valve_on`, `valve_off`, `origin_scheduled`, `origin_manual`, `origin_external`.

- [ ] **Step 1: catálogo (`alerts.py`)**

En `AlertType`, añade el campo tras `allowed`:

```python
    # solo push: sin entidad event, sin evento de bus y sin marca en el histórico
    push_only: bool = False
```

Al final de `ALERT_TYPES`, tras `rain_source_unavailable`:

```python
    "valve_switched": AlertType(LEVEL_VALVE, PRIORITY_NORMAL, push_only=True),
```

`alert_types` pasa a excluir los tipos `push_only`:

```python
def alert_types(level: str) -> list[str]:
    """IDs de un nivel, en orden de catálogo: los event_types de su entidad. Sin los de solo push."""
    return [
        alert_id
        for alert_id, alert in ALERT_TYPES.items()
        if alert.level == level and not alert.push_only
    ]
```

- [ ] **Step 2: mensajes y duración (`notify.py`)**

En `MESSAGES["es"]`, tras `"rain_other"`:

```python
        "valve_on": "{zone}: {entity} encendida{origin} a las {time}.",
        "valve_off": "{zone}: {entity} apagada a las {time} tras {duration}{origin}.",
        "origin_scheduled": "programado",
        "origin_manual": "manual",
        "origin_external": "externo",
```

En `MESSAGES["en"]`, tras `"rain_other"`:

```python
        "valve_on": "{zone}: {entity} turned on{origin} at {time}.",
        "valve_off": "{zone}: {entity} turned off at {time} after {duration}{origin}.",
        "origin_scheduled": "scheduled",
        "origin_manual": "manual",
        "origin_external": "external",
```

Tras `message_text`, añade:

```python
def duration_text(seconds: float) -> str:
    """Tiempo abierta de una válvula para el push: `45 s`, `3 min`, `1 h 5 min` o `1 h`."""
    if seconds < 60:
        return f"{round(seconds)} s"
    minutes = round(seconds / 60)
    if minutes < 60:
        return f"{minutes} min"
    hours, rest = divmod(minutes, 60)
    return f"{hours} h {rest} min" if rest else f"{hours} h"
```

- [ ] **Step 3: imports y estado (`manager.py`)**

- `from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN` pasa a `from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN`.
- `from .notify import async_push, message_text` pasa a `from .notify import async_push, duration_text, message_text`.
- En `__init__`, tras `self._opening_origin: dict[str, str] = {}`:

```python
        # origen de cada switch encendida, para el push de apagado (valve_switched); solo en memoria
        self._switch_origin: dict[str, str] = {}
```

- [ ] **Step 4: detección (`manager.py`)**

Sustituye `_async_valve_state_changed` entero:

```python
    @callback
    def _async_valve_state_changed(self, event: Event[EventStateChangedData]) -> None:
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        old_state = event.data["old_state"]
        new_state = event.data["new_state"]
        # push valve_switched: solo off→on y on→off; arranque y unavailable/unknown no avisan
        if old_state is None or new_state is None:
            return
        if {old_state.state, new_state.state} != {STATE_OFF, STATE_ON}:
            return
        entity_id = new_state.entity_id
        if new_state.state == STATE_ON:
            # el origen se lee ya: la integración suelta _opening_origin al volver del turn_on
            self._switch_origin[entity_id] = self.valve_origin(entity_id)
            self._spawn(
                self._async_push_switched(entity_id, "valve_on", self._switch_origin[entity_id]),
                f"{DOMAIN}_valve_on",
            )
            return
        # sin origen guardado (HA arrancó con la válvula abierta): el push va sin él
        origin = self._switch_origin.pop(entity_id, None)
        seconds = (new_state.last_changed - old_state.last_changed).total_seconds()
        self._spawn(
            self._async_push_switched(entity_id, "valve_off", origin, seconds),
            f"{DOMAIN}_valve_off",
        )
```

Justo debajo, añade:

```python
    async def _async_push_switched(
        self, entity_id: str, kind: str, origin: str | None, seconds: float | None = None
    ) -> None:
        """Push de encendido o apagado de una switch configurada (valve_switched). Solo push."""
        settings = self.config.settings
        if not (targets := push_targets(settings, "valve_switched")):
            return
        try:
            zone, valve = self._find_valve(entity_id)
        except ServiceValidationError:
            # la válvula se quitó de la configuración entre el cambio de estado y el push
            return
        fields = {
            "zone": zone.name,
            "entity": valve.name,
            "origin": f" ({message_text(self.hass, f'origin_{origin}')})"
            if origin in (ORIGIN_SCHEDULED, ORIGIN_MANUAL, ORIGIN_EXTERNAL)
            else "",
        }
        if seconds is not None:
            fields["duration"] = duration_text(seconds)
        await async_push(
            self.hass, targets, kind, alert_priority(settings, "valve_switched"), **fields
        )
```

- [ ] **Step 5: gates de backend**

Run: `uvx ruff check custom_components`
Expected: `All checks passed!`

Run: `py -3.14 -m compileall -q custom_components`
Expected: sin salida, código 0.

- [ ] **Step 6: commit**

```bash
git add custom_components/irrigation_scheduler/alerts.py custom_components/irrigation_scheduler/notify.py custom_components/irrigation_scheduler/manager.py
git commit -m "feat(alerts): push al encender y al apagar una válvula (valve_switched)"
```

---

### Task 2: Frontend y documentación — fila de ajustes con «Histórico» bloqueado

**Files:**
- Modify: `frontend/src/alerts.ts` (`AlertType`, `ALERT_TYPES`)
- Modify: `frontend/src/panel/alert-settings.ts` (casilla «Histórico» de `renderRow`)
- Modify: `frontend/src/i18n.ts` (ES y EN)
- Modify: `docs/alerts/README.md` (catálogo)
- Modify: `README.md:14`
- Regenera: `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`

**Interfaces:**
- Consumes: el ID `valve_switched` de la tarea 1.
- Produces: `AlertType.pushOnly?: boolean` y las claves `alert_valve_switched`, `alert_valve_switched_help`.

- [ ] **Step 1: catálogo del frontend (`alerts.ts`)**

En `interface AlertType`, tras `help: Key;`:

```ts
  // solo push: sin entidad event ni marca; la casilla «Histórico» va desmarcada y bloqueada
  pushOnly?: boolean;
```

Al final de `ALERT_TYPES`, tras `rain_source_unavailable`:

```ts
  { id: "valve_switched", level: "valve", priority: "normal", allowed: ALL, name: "alert_valve_switched", help: "alert_valve_switched_help", pushOnly: true },
```

- [ ] **Step 2: casilla «Histórico» (`alert-settings.ts`)**

En `renderRow`, la casilla de `show_in_history` pasa de:

```ts
            .checked=${config.show_in_history}
            ?disabled=${this.readOnly}
```

a:

```ts
            .checked=${config.show_in_history && !type.pushOnly}
            ?disabled=${this.readOnly || type.pushOnly}
```

- [ ] **Step 3: textos (`i18n.ts`)**

En `ES`, tras `alert_rain_source_unavailable_help`:

```ts
  alert_valve_switched: "Válvula encendida/apagada",
  alert_valve_switched_help:
    "Un push al encender y otro al apagar, con el tiempo abierta. Programado, manual o externo. No se marca en el histórico.",
```

En `EN`, tras `alert_rain_source_unavailable_help`:

```ts
  alert_valve_switched: "Valve turned on/off",
  alert_valve_switched_help:
    "One push on turn on and one on turn off, with the time open. Scheduled, manual or external. Not marked in the history.",
```

- [ ] **Step 4: documentación**

En `docs/alerts/README.md`, añade al final de la tabla «Catálogo», tras la fila de `rain_source_unavailable`:

```markdown
| `valve_switched` | Válvula encendida/apagada | Válvula | Normal | Implementada: solo push (sin entidad event, sin evento de bus, sin marca en el histórico) | Un push al encender y otro al apagar la switch, sea cual sea el origen (programado, manual o externo). El de apagado lleva el tiempo abierta. Casilla «Histórico» bloqueada. |
```

En `README.md:14`, la línea:

```markdown
- Avisa por push (`notify.mobile_app_*`) de fallos de válvula, excesos de tiempo y sensores no disponibles.
```

pasa a:

```markdown
- Avisa por push (`notify.mobile_app_*`) de fallos de válvula, excesos de tiempo y sensores no disponibles, y de cada encendido y apagado de válvula (desactivable en Ajustes → «Errores y avisos»).
```

- [ ] **Step 5: gates de frontend** (en `frontend/`)

Run: `npx tsc --noEmit`
Expected: código 0.

Run: `npm run lint`
Expected: código 0.

Run: `npm run build`
Expected: código 0; regenera `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`.

- [ ] **Step 6: commit**

```bash
git add frontend/src/alerts.ts frontend/src/panel/alert-settings.ts frontend/src/i18n.ts docs/alerts/README.md README.md custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js
git commit -m "feat(alerts): fila «Válvula encendida/apagada» en ajustes, con «Histórico» bloqueado"
```
