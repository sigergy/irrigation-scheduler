# Retomar el riego tras un reinicio — plan de implementación

> **Para agentes:** sub-skill obligatoria: `subagent-driven-development` (recomendada) o
> `executing-plans`. Los pasos usan casillas (`- [ ]`). En este proyecto el implementador **no hace
> commit**: deja los cambios en el árbol; el controlador revisa el diff, pasa los gates y hace el
> commit al cerrar cada tarea.

**Objetivo:** al volver HA tras un reinicio ordenado, cada válvula interrumpida (spec 03) espera a
su `switch` y completa lo que le faltaba si HA volvió en menos de 60 min y no ha llegado el
siguiente bloque de esa válvula. Si no, se da por terminada con un push nuevo,
`restart_not_resumed`.

**Arquitectura:** dos mutadores nuevos en `ValveSlots` (`resume`, `discard_interrupted`) y una
búsqueda de bloques por válvula en `domain/schedule.py`. Un módulo nuevo, `engine/resume.py`
(`ResumeWatch`), espera a la `switch` con la forma de `CloseRetry`. El manager decide en T con el
lock, evalúa la lluvia de lo programado como al terminar el horario silencioso y descarta sin aviso
al pausar, detener, regar a mano o quitar la válvula. Tipo de alerta nuevo, solo push, y botón
Pausar en el estado «Interrumpida» del panel.

**Stack:** Python 3.14, Home Assistant 2026.9 (custom integration), ruff; frontend Lit +
TypeScript + Vite.

**Spec:** [`../04-resume-after-restart/spec.md`](../04-resume-after-restart/spec.md) (§2-3
decisiones, §4 diseño, §5 ejemplos, §6 límites).

## Restricciones globales

- Comentarios en español; nombres de código en inglés. Ficheros Python `snake_case`.
- **Sin tests nuevos**: norma del proyecto para features. La validación funcional la hace el usuario
  en su HA (2026.9).
- Gates locales en cada tarea:
  - `uvx ruff check custom_components`
  - `py -3.14 -m compileall -q custom_components`
  - Tarea 3, además, en `frontend/`: `npm run lint`, `npm run typecheck` y `npm run build`
    (requiere `npm ci` una vez).
- `pytest` solo corre en GitHub Actions (`.github/workflows/tests.yml`). Los tests existentes deben
  seguir en verde, en especial `engine/tests/test_lock.py`, `engine/tests/test_layers.py`,
  `engine/tests/test_characterization.py` y `engine/tests/test_slots.py`.
- `engine/` no importa `api` ni `entities` (`engine/tests/test_layers.py`).
- `ValveSlots` es el único que modifica el estado de las válvulas en el runtime. Sus mutadores van
  en `MUTATORS` (`engine/slots.py:14-31`) y fuera de `slots.py` solo se llaman con el lock. Los
  métodos `*_locked` también se llaman solo con el lock (`engine/tests/test_lock.py`).
- `ResumeWatch` no toma el lock ni toca `ValveSlots`, igual que `CloseRetry`
  (`engine/close_retry.py:41`).
- Plazo para retomar: **60 min** desde `interrupted_at`, constante fija `RESUME_WINDOW` en
  `const.py`. Sin ajuste en el panel.
- `switch` lista = estado que no es `unavailable` ni `unknown`.
- `{minutes}` del aviso = `InterruptedValve.remaining_min` (minutos redondeados hacia arriba).
- Tipo de alerta `restart_not_resumed`: nivel válvula, severidad `info`, prioridad `normal`,
  `push_only`. Nombre «No retomado tras reinicio» / «Not resumed after restart». Texto del push:
  - ES: «{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se
    retoma.»
  - EN: «{zone} · {entity}: irrigation interrupted by HA restart. {minutes} min were left. Not
    resumed.»
- Ruff: `line-length = 120`, reglas `E, F, I, UP, B` (`pyproject.toml`). Imports en orden isort.
- Rama: `sigergy/ha-restart-fallbacks-impl`. Push, merge y PR, solo con confirmación del usuario.
- Registro de avance, briefs e informes de esta ejecución:
  `docs/features/06-10-2026-ha-restart-fallbacks/plans/04-resume-after-restart/`. Nunca en
  `.superpowers/`.

## Mapa de ficheros

| Fichero | Tarea | Cambio |
|---|---|---|
| `custom_components/irrigation_scheduler/const.py` | 1 | `RESUME_WINDOW` |
| `custom_components/irrigation_scheduler/domain/schedule.py` | 1 | `valve_block_between` |
| `custom_components/irrigation_scheduler/engine/slots.py` | 1, 4 | Mutadores `resume` y `discard_interrupted`; la 4 quita `drop_interrupted` |
| `custom_components/irrigation_scheduler/engine/resume.py` | 2 | Nuevo: `ResumeWatch` |
| `custom_components/irrigation_scheduler/domain/alerts.py` | 3 | Tipo `restart_not_resumed` |
| `custom_components/irrigation_scheduler/adapters/notify.py` | 3 | Texto ES/EN |
| `custom_components/irrigation_scheduler/engine/incidents.py` | 3 | `push_not_resumed` |
| `frontend/src/{alerts.ts,i18n.ts,shared/valve-status.ts}` | 3 | Tipo en el panel de alertas y botón Pausar |
| `custom_components/irrigation_scheduler/engine/manager.py` | 4 | Arranque, decisión en T, lluvia, descartes y parada |
| `docs/...` | 5 | Specs vivas y estado |

---

### Tarea 1: dominio y mutadores de `ValveSlots`

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/const.py:63-65` (tras `SHUTDOWN_LOCK_TIMEOUT_S`)
- Modificar: `custom_components/irrigation_scheduler/domain/schedule.py:89` (tras `missed_blocks`)
- Modificar: `custom_components/irrigation_scheduler/engine/slots.py:14-31` (`MUTATORS`) y `:148`
  (tras `drop_interrupted`)

**Interfaces:**
- Produce:
  - `RESUME_WINDOW: timedelta` (`const.py`), 60 min.
  - `valve_block_between(zone: Zone, entity_id: str, since: datetime, until: datetime) -> datetime | None`
    (`domain/schedule.py`).
  - `ValveSlots.resume(entity_id: str) -> Job | None`.
  - `ValveSlots.discard_interrupted(match: Callable[[str, str], bool]) -> list[InterruptedValve]`;
    `match(zone_id, entity_id)`, igual que `ValveSlots.cancel`.
- `drop_interrupted` se queda en esta tarea: la usa `_async_recover` hasta la tarea 4.

- [ ] **Paso 1: constante.** En `const.py`, tras `SHUTDOWN_LOCK_TIMEOUT_S = 2`, añadir (con una
  línea en blanco antes):

```python
# Plazo para retomar un riego interrumpido por la parada de HA, desde la interrupción
# (docs/features/06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md §2)
RESUME_WINDOW = timedelta(minutes=60)
```

  `const.py` ya importa `timedelta` (lo usa `HEARTBEAT_INTERVAL`).

- [ ] **Paso 2: bloque siguiente de una válvula.** En `domain/schedule.py`, justo después de
  `missed_blocks`, añadir:

```python
def valve_block_between(zone: Zone, entity_id: str, since: datetime, until: datetime) -> datetime | None:
    """Primer bloque de la zona que incluye la válvula con hora en (since, until], o None.

    Mismas condiciones que `missed_blocks`; la lluvia no cuenta (04-resume-after-restart §4.3).
    `until` debe ser local y con tz; `since` puede estar en UTC.
    """
    for when, _zone_id, index in missed_blocks([zone], since, until):
        if any(valve.entity_id == entity_id for valve in valves_for_block(zone, index)):
            return when
    return None
```

- [ ] **Paso 3: mutadores.** En `engine/slots.py`:
  - En `MUTATORS`, tras `"drop_interrupted",`, añadir `"discard_interrupted",` y `"resume",`.
  - Tras el método `drop_interrupted`, añadir:

```python
    def discard_interrupted(self, match: Callable[[str, str], bool]) -> list[InterruptedValve]:
        """Saca de `interrupted` las que cumplen `match(zone_id, entity_id)` y las devuelve."""
        dropped = [item for item in self.runtime.interrupted.values() if match(item.zone_id, item.entity_id)]
        for item in dropped:
            del self.runtime.interrupted[item.entity_id]
        return dropped

    def resume(self, entity_id: str) -> Job | None:
        """Retoma una interrumpida (04-resume-after-restart §4.4): a la cola con lo que le faltaba.

        Trabajo normal, con su origen: respeta el límite de la zona y el global. None si ya no estaba.
        """
        interrupted = self.runtime.interrupted.pop(entity_id, None)
        if interrupted is None:
            return None
        return self.enqueue(
            interrupted.zone_id, entity_id, interrupted.remaining_s, origin=interrupted.origin
        )
```

- [ ] **Paso 4: gates.** Los dos de Python, con exit 0.

---

### Tarea 2: `ResumeWatch`, espera de la `switch`

**Ficheros:**
- Crear: `custom_components/irrigation_scheduler/engine/resume.py`

**Interfaces:**
- Produce:
  - `ResumeWatch(hass: HomeAssistant, on_ready: Callable[[str, bool], None])`.
  - `ResumeWatch.start(entity_id: str, deadline: datetime) -> None`: `deadline` en UTC.
  - `ResumeWatch.cancel(entity_id: str) -> None` y `ResumeWatch.cancel_all() -> None`.
  - `on_ready(entity_id, expired)`: una sola vez por espera. `expired=False`: la `switch` está
    lista; `True`: venció el plazo sin ella. Se llama dentro del bucle de eventos, sin `await`.

- [ ] **Paso 1: crear el módulo** con este contenido:

```python
"""Espera a la switch de cada válvula interrumpida antes de decidir si se retoma.

Spec: docs/features/06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md §4.2
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from functools import partial

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_point_in_utc_time, async_track_state_change_event


@dataclass
class _Watch:
    """Lo que sigue vivo mientras se espera a una switch."""

    timer: CALLBACK_TYPE | None = None
    unsub_state: CALLBACK_TYPE | None = None


def _ready(state: State | None) -> bool:
    """La switch responde: ni unavailable ni unknown (Zigbee tarda tras un reinicio)."""
    return state is not None and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)


class ResumeWatch:
    """Una espera por switch. No toma el lock del manager ni toca ValveSlots.

    Avisa una sola vez con `on_ready(entity_id, expired)`: False si la switch está lista, True si
    vence el plazo sin ella.
    """

    def __init__(self, hass: HomeAssistant, on_ready: Callable[[str, bool], None]) -> None:
        self.hass = hass
        self._on_ready = on_ready
        self._watches: dict[str, _Watch] = {}

    @callback
    def start(self, entity_id: str, deadline: datetime) -> None:
        """Empieza a esperar hasta `deadline` (UTC). Con una espera ya en marcha sigue la que hay."""
        if entity_id in self._watches:
            return
        if _ready(self.hass.states.get(entity_id)):
            # ya responde: no hay nada que esperar
            self._on_ready(entity_id, False)
            return
        watch = _Watch()
        self._watches[entity_id] = watch
        watch.unsub_state = async_track_state_change_event(self.hass, [entity_id], self._state_changed)
        watch.timer = async_track_point_in_utc_time(self.hass, partial(self._expired, entity_id), deadline)

    @callback
    def cancel(self, entity_id: str) -> None:
        """Para sin avisar: interrupción descartada o ya decidida."""
        self._drop(entity_id)

    @callback
    def cancel_all(self) -> None:
        """Para todas sin avisar: descarga de la entry o parada de HA (§4.8)."""
        for entity_id in list(self._watches):
            self._drop(entity_id)

    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        if entity_id in self._watches and _ready(event.data["new_state"]):
            self._drop(entity_id)
            self._on_ready(entity_id, False)

    @callback
    def _expired(self, entity_id: str, _now: datetime) -> None:
        watch = self._watches.get(entity_id)
        if watch is None:
            return
        # ya ha saltado: no hay que desregistrarlo
        watch.timer = None
        self._drop(entity_id)
        self._on_ready(entity_id, True)

    @callback
    def _drop(self, entity_id: str) -> None:
        watch = self._watches.pop(entity_id, None)
        if watch is None:
            return
        if watch.timer is not None:
            watch.timer()
        if watch.unsub_state is not None:
            watch.unsub_state()
```

- [ ] **Paso 2: gates.** Los dos de Python, con exit 0. El módulo aún no se usa: lo conecta la
  tarea 4.

---

### Tarea 3: aviso `restart_not_resumed` y botón Pausar

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/domain/alerts.py:48` (`ALERT_TYPES`)
- Modificar: `custom_components/irrigation_scheduler/adapters/notify.py:62` (ES) y `:99` (EN)
- Modificar: `custom_components/irrigation_scheduler/engine/incidents.py:169-188` (tras
  `push_switched`)
- Modificar: `frontend/src/alerts.ts:34`
- Modificar: `frontend/src/i18n.ts:185-187` (ES) y `:422-424` (EN)
- Modificar: `frontend/src/shared/valve-status.ts:119-121`

**Interfaces:**
- Produce: `Incidents.push_not_resumed(zone_id: str, entity_id: str, minutes: int) -> None`
  (async). Lo usa la tarea 4.

- [ ] **Paso 1: catálogo.** En `domain/alerts.py`, tras la línea de `"valve_switched"` en
  `ALERT_TYPES`, añadir:

```python
    "restart_not_resumed": AlertType(LEVEL_VALVE, SEVERITY_INFO, PRIORITY_NORMAL, push_only=True),
```

- [ ] **Paso 2: textos.** En `adapters/notify.py`, en `MESSAGES`:
  - `"es"`, tras `"valve_off": ...`:

```python
        "restart_not_resumed": (
            "{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se retoma."
        ),
```

  - `"en"`, tras `"valve_off": ...`:

```python
        "restart_not_resumed": (
            "{zone} · {entity}: irrigation interrupted by HA restart. {minutes} min were left. Not resumed."
        ),
```

- [ ] **Paso 3: push.** En `engine/incidents.py`, tras el método `push_switched`, añadir:

```python
    async def push_not_resumed(self, zone_id: str, entity_id: str, minutes: int) -> None:
        """Riego cortado por un reinicio de HA que no se retoma (04-resume-after-restart §4.6). Solo push."""
        if not any(targets := self._targets("restart_not_resumed")):
            return
        self._send(
            "restart_not_resumed", targets, minutes=str(minutes), **self._names(zone_id, entity_id)
        )
```

- [ ] **Paso 4: panel de alertas.** En `frontend/src/alerts.ts`, tras la línea de
  `valve_switched` en `ALERT_TYPES`, añadir:

```ts
  { id: "restart_not_resumed", level: "valve", priority: "normal", allowed: ALL, name: "alert_restart_not_resumed", help: "alert_restart_not_resumed_help", pushOnly: true },
```

- [ ] **Paso 5: textos del panel.** En `frontend/src/i18n.ts`:
  - ES, tras `alert_valve_switched_help`:

```ts
  alert_restart_not_resumed: "No retomado tras reinicio",
  alert_restart_not_resumed_help:
    "Un riego cortado por un reinicio de HA no se completa: pasaron más de 60 min, llegó el siguiente bloque de la válvula, está deshabilitada o es hora de silencio. No se marca en el histórico.",
```

  - EN, tras `alert_valve_switched_help`:

```ts
  alert_restart_not_resumed: "Not resumed after restart",
  alert_restart_not_resumed_help:
    "An irrigation cut by an HA restart is not completed: over 60 min went by, the valve's next block arrived, it is disabled or it is quiet time. Not marked in the history.",
```

- [ ] **Paso 6: botón Pausar.** En `frontend/src/shared/valve-status.ts`, en `valveButtons`,
  sustituir:

```ts
    case "closing":
    case "interrupted":
      return [];
```

  por:

```ts
    case "closing":
      return [];
    case "interrupted":
      // espera a retomarse tras un reinicio: Pausar la descarta (04-resume-after-restart §4.7)
      return [{ action: "pause", run: (hass) => pauseValve(hass, entityId) }];
```

- [ ] **Paso 7: gates.** Los dos de Python y, en `frontend/`, `npm run lint`, `npm run typecheck` y
  `npm run build`, todos con exit 0. El bundle generado está en `.gitignore`: no se commitea.

---

### Tarea 4: el manager retoma, avisa y descarta

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py`:
  - imports `:27-68`;
  - `__init__` `:103`;
  - `async_shutdown` `:151-167`;
  - `_async_recover` `:234-294` (bloque de `drop_interrupted`, `:238-244`);
  - `_async_quiet_end` `:598-649` (bucle de decisiones, `:633-638`);
  - `async_save_zone` `:818`;
  - `async_run_zone` `:918-934`;
  - `async_run_valve` `:936-951`;
  - `_async_pause` `:961`.
- Modificar: `custom_components/irrigation_scheduler/engine/slots.py` (quitar `drop_interrupted`)

**Interfaces:**
- Consume: `RESUME_WINDOW`, `valve_block_between`, `ValveSlots.resume`,
  `ValveSlots.discard_interrupted` (tarea 1); `ResumeWatch` (tarea 2);
  `Incidents.push_not_resumed` (tarea 3).
- Produce (privados del manager): `_resume_watch`, `_resume_ready`, `_async_resume`,
  `_resume_blocker_locked`, `_resume_locked`, `_not_resumed_locked`, `_discard_interrupted_locked`,
  `_take_skips_locked`.

- [ ] **Paso 1: imports.**
  - En `from ..const import (...)`, añadir `RESUME_WINDOW` en orden alfabético (tras
    `RAIN_STARTUP_RETRY_S`).
  - `from ..domain.runtime import BlockRef, InterruptedValve, Job, OpenValve, RuntimeState`.
  - En `from ..domain.schedule import (...)`, añadir `valve_block_between` (tras `quiet_end_after`).
  - Tras `from .rain_control import ...`, añadir `from .resume import ResumeWatch` (isort: `.resume`
    va entre `.rain_control` y `.slots`).

- [ ] **Paso 2: `__init__`.** Tras `self._close_retry = CloseRetry(hass, self._incidents)`, añadir:

```python
        # espera de la switch de las válvulas interrumpidas antes de retomarlas (04-resume-after-restart §4.2)
        self._resume_watch = ResumeWatch(hass, self._resume_ready)
```

- [ ] **Paso 3: parada y descarga.** En `async_shutdown`, tras `self._close_retry.cancel_all()`,
  añadir:

```python
        # las interrupciones siguen guardadas con su interrupted_at: el próximo arranque las vigila (§4.8)
        self._resume_watch.cancel_all()
```

- [ ] **Paso 4: arranque.** En `_async_recover`, sustituir el bloque:

```python
            # riegos cortados por la parada ordenada: sin la spec 04 no se retoman (03-remaining-time §3)
            for valve in self._slots.drop_interrupted():
                _LOGGER.info(
                    "%s: riego interrumpido por reinicio de HA, faltaban %s min; no se retoma",
                    valve.entity_id,
                    valve.remaining_min,
                )
```

  por:

```python
            # riegos cortados por la parada ordenada: dentro del plazo se espera a su switch
            # (04-resume-after-restart §4.1)
            for item in list(self.runtime.interrupted.values()):
                deadline = item.interrupted_at + RESUME_WINDOW
                if now >= deadline:
                    self._not_resumed_locked(item, "HA volvió pasado el plazo")
                elif not self._stopping:
                    self._resume_watch.start(item.entity_id, deadline)
```

  `_async_recover` ya persiste al final. Si HA está parando, la interrupción se queda guardada para
  el próximo arranque.

- [ ] **Paso 5: quitar `drop_interrupted`.** En `engine/slots.py`, borrar el método
  `drop_interrupted` y su entrada `"drop_interrupted",` de `MUTATORS`. Comprobar con
  `grep -rn drop_interrupted custom_components` que no queda ninguna llamada.

- [ ] **Paso 6: decisiones de lluvia compartidas.** En `_async_quiet_end`, sustituir:

```python
                decisions = self.runtime.rain_decisions
                skip: set[str] = set()
                for ref in refs:
                    decision = decisions.get(ref) if ref[0] in own else decisions.pop(ref, None)
                    if decision is not None and decision.skip:
                        skip.add(ref[0])
```

  por:

```python
                skip = self._take_skips_locked(refs, own)
```

  y añadir, justo antes de `async def _async_quiet_end_due`, el método:

```python
    def _take_skips_locked(self, refs: list[BlockRef], own: set[str]) -> set[str]:
        """Requiere el lock. Zonas de `refs` omitidas por lluvia.

        Consume la decisión, salvo en las zonas de `own`: tienen un bloque propio a esa hora y la
        consume `_async_block_fired` (quiet-hours §B.4).
        """
        decisions = self.runtime.rain_decisions
        skip: set[str] = set()
        for ref in refs:
            decision = decisions.get(ref) if ref[0] in own else decisions.pop(ref, None)
            if decision is not None and decision.skip:
                skip.add(ref[0])
        return skip
```

  El comportamiento de `_async_quiet_end` no cambia.

- [ ] **Paso 7: retomar.** Añadir una sección nueva justo antes de `# ---------- colas y válvulas
  ----------` (antes de `_enqueue_block_locked`):

```python
    # ---------- retomar tras un reinicio (04-resume-after-restart) ----------

    @callback
    def _resume_ready(self, entity_id: str, expired: bool) -> None:
        """Aviso de ResumeWatch: la switch está lista (T = ahora) o venció el plazo."""
        self._spawn(
            self._async_resume(entity_id, dt_util.utcnow(), expired), f"irrigation_resume_{entity_id}"
        )

    async def _async_resume(self, entity_id: str, ready_at: datetime, expired: bool) -> None:
        """Decide en T = `ready_at` si la interrumpida se retoma (§4.3-4.4)."""
        if self._stopping:
            return
        rain_ref: BlockRef | None = None
        own: set[str] = set()
        async with self._lock:
            item = self.runtime.interrupted.get(entity_id)
            if item is None:
                # descartada mientras esperaba (§4.5)
                return
            reason = "la switch no volvió en el plazo" if expired else self._resume_blocker_locked(item, ready_at)
            if reason is not None:
                self._not_resumed_locked(item, reason)
                await self._async_persist_locked()
                return
            zone = self.config.zones[item.zone_id]
            if item.origin != ORIGIN_SCHEDULED or not self._needs_rain(zone):
                # manual o sin lluvia que mirar: a la cola ya
                await self._resume_locked(item)
                return
            # programado: la lluvia se decide como al terminar la franja, con un bloque (zona, hora de T, hoy)
            local = dt_util.as_local(ready_at)
            rain_ref = (zone.zone_id, local.strftime("%H:%M"), local.date())
            own = {other.zone_id for other in blocks_at(self.config.zones.values(), rain_ref[1], rain_ref[2])}
        # sin el lock: recalcula la lluvia y fija la decisión, como un bloque a su hora
        await self._async_evaluate_lot([rain_ref])
        async with self._lock:
            item = self.runtime.interrupted.get(entity_id)
            if item is None or self._stopping:
                # descartada mientras se miraba la lluvia, o HA parando: se queda guardada (§4.8)
                return
            if self._take_skips_locked([rain_ref], own):
                # el push rain_skipped ya ha salido: sin aviso propio
                self._slots.discard_interrupted(lambda _zone, entity: entity == entity_id)
                _LOGGER.info("%s: riego interrumpido omitido por lluvia; no se retoma", entity_id)
                await self._async_persist_locked()
                return
            # la configuración pudo cambiar mientras se miraba la lluvia
            if (reason := self._resume_blocker_locked(item, ready_at)) is not None:
                self._not_resumed_locked(item, reason)
                await self._async_persist_locked()
                return
            await self._resume_locked(item)

    def _resume_blocker_locked(self, item: InterruptedValve, ready_at: datetime) -> str | None:
        """Requiere el lock. Motivo para no retomar en T = `ready_at`, o None si se retoma (§4.3)."""
        zone = self.config.zones.get(item.zone_id)
        valve = next((v for v in zone.valves if v.entity_id == item.entity_id), None) if zone else None
        if zone is None or valve is None:
            return "la válvula ya no está en la zona"
        if not zone.enabled or not valve.enabled:
            return "zona o válvula deshabilitada"
        if in_quiet_hours(self.config.settings, dt_util.as_local(ready_at)):
            return "horario silencioso"
        if ready_at >= item.interrupted_at + RESUME_WINDOW:
            return "pasado el plazo"
        # bloque siguiente: solo uno que incluya la válvula, hasta el fin previsto del resto (T + R)
        until = dt_util.as_local(ready_at + timedelta(seconds=item.remaining_s))
        if (when := valve_block_between(zone, item.entity_id, item.interrupted_at, until)) is not None:
            return f"bloque de las {when.strftime('%H:%M')}"
        return None

    async def _resume_locked(self, item: InterruptedValve) -> None:
        """Requiere el lock. A la cola de su zona con lo que le faltaba (§4.4)."""
        self._slots.resume(item.entity_id)
        _LOGGER.info("%s: riego interrumpido retomado, faltan %s min", item.entity_id, item.remaining_min)
        await self._async_persist_locked()
        await self._async_dispatch_locked()

    def _not_resumed_locked(self, item: InterruptedValve, reason: str) -> None:
        """Requiere el lock. Da el riego por terminado y avisa con restart_not_resumed (§4.6).

        Quien llama persiste.
        """
        self._slots.discard_interrupted(lambda _zone, entity: entity == item.entity_id)
        self._resume_watch.cancel(item.entity_id)
        _LOGGER.info(
            "%s: riego interrumpido por reinicio de HA, faltaban %s min; no se retoma: %s",
            item.entity_id,
            item.remaining_min,
            reason,
        )
        self._spawn(
            self._incidents.push_not_resumed(item.zone_id, item.entity_id, item.remaining_min),
            f"irrigation_not_resumed_{item.entity_id}",
        )

    def _discard_interrupted_locked(self, match: Callable[[str, str], bool]) -> None:
        """Requiere el lock. Descarta sin aviso las interrumpidas que esperan (§4.5)."""
        for item in self._slots.discard_interrupted(match):
            self._resume_watch.cancel(item.entity_id)
            _LOGGER.info("%s: riego interrumpido descartado; no se retoma", item.entity_id)
```

  Notas para el implementador:
  - Si la línea de `reason = ...` pasa de 120 caracteres, partirla con paréntesis sin cambiar la
    lógica.
  - `timedelta`, `Callable`, `callback`, `blocks_at`, `in_quiet_hours` y `ORIGIN_SCHEDULED` ya están
    importados en `manager.py`.

- [ ] **Paso 8: descartes sin aviso (§4.5).**
  - `_async_pause`: tras `closing = self._slots.cancel(match)`, añadir:

```python
            # interrumpidas que esperaban a retomarse: Pausar o detener las descarta, sin aviso
            self._discard_interrupted_locked(match)
```

    Cubre pausar o detener la válvula, la zona o todo, deshabilitar la válvula o la zona
    (`async_set_valve_enabled` y `async_set_zone_enabled` pausan) y borrar la zona
    (`async_delete_zone` pausa antes de borrar).
  - `async_run_zone`: dentro de `async with self._lock:`, antes del `for valve in zone.valves:`,
    añadir:

```python
            # un riego manual nuevo manda sobre la interrupción de sus válvulas
            enabled = {valve.entity_id for valve in zone.valves if valve.enabled}
            self._discard_interrupted_locked(lambda _zone, entity: entity in enabled)
```

  - `async_run_valve`: dentro de `async with self._lock:`, antes de `self._slots.enqueue(`, añadir:

```python
            # un riego manual nuevo manda sobre la interrupción
            self._discard_interrupted_locked(lambda _zone, entity: entity == entity_id)
```

  - `async_save_zone`: tras la línea
    `self._slots.drop_pending(lambda job: job.zone_id != zone.zone_id or job.entity_id in kept)`,
    añadir:

```python
            # válvulas quitadas de la zona: su interrupción ya no se retoma
            self._discard_interrupted_locked(
                lambda job_zone, entity: job_zone == zone.zone_id and entity not in kept
            )
```

- [ ] **Paso 9: gates.** Los dos de Python, con exit 0. Comprobar a mano, contra
  `engine/tests/test_lock.py`, que todas las llamadas nuevas a mutadores (`discard_interrupted`,
  `resume`) y a métodos `*_locked` están dentro de `async with self._lock:` o de un método `*_locked`.

---

### Tarea 5: documentación viva y estado

**Ficheros:**
- Modificar: `docs/features/valves-execution/spec.md` §5.2, punto 0 (`:105-106`)
- Modificar: `docs/features/alerts/README.md` (tabla del catálogo, tras la fila `valve_switched`,
  `:54`)
- Modificar: `docs/features/alerts/spec.md` (`:76` y sección nueva antes de `## Pendiente`, `:518`)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md`
  (estado, plan y citas)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/03-remaining-time/spec.md` §4.3
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/README.md` (estado y fila 4)

- [ ] **Paso 1: valves-execution §5.2.** Sustituir el punto 0:
  «0. **Válvulas interrumpidas** al parar (§5.1.1): se dan por terminadas, con un log. No se
  retoman ([`03-remaining-time`](../06-10-2026-ha-restart-fallbacks/03-remaining-time/spec.md) §3).»
  por:
  «0. **Válvulas interrumpidas** al parar (§5.1.1): si HA vuelve en menos de 60 min, se espera a su
  `switch` y lo que faltaba entra en la cola de su zona, salvo que haya llegado el siguiente bloque
  de esa válvula, esté deshabilitada o sea hora de silencio. Si no, se dan por terminadas con el
  aviso `restart_not_resumed`. Pausar, detener o regar a mano la válvula la descarta, sin aviso
  ([`04-resume-after-restart`](../06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md)).»

- [ ] **Paso 2: catálogo de alertas.** En `docs/features/alerts/README.md`, tras la fila de
  `valve_switched`, añadir:
  «| `restart_not_resumed` | No retomado tras reinicio | Válvula | Info | Normal | Implementada: solo
  push (sin entidad event, sin evento de bus, sin marca en el histórico) | Un riego cortado por un
  reinicio de HA no se completa: HA o la `switch` tardaron más de 60 min, llegó el siguiente bloque
  de la válvula, está deshabilitada o es hora de silencio. Casilla «Histórico» bloqueada. |»

- [ ] **Paso 3: spec de alertas.**
  - En la fila `info` de la tabla de cabeceras (`:76`), añadir `restart_not_resumed` junto a
    `valve_switched`: «`rain_skipped`, `valve_switched` y `restart_not_resumed` (sin marca)».
  - Antes de `## Pendiente`, añadir una sección con el formato de §9:

```markdown
## 11. `restart_not_resumed` — No retomado tras reinicio

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: solo push (sin entidad event, sin evento de bus, sin marca en el histórico) |
| Prioridad por defecto | Normal |
| Cabecera del push | Info |
| Texto de push | «{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se retoma.» (`notify.py:<línea>`) |

**Cuándo salta.** Al arrancar HA, una válvula interrumpida por la parada ordenada no se retoma:
HA o su `switch` tardaron más de 60 min, llegó el siguiente bloque de esa válvula, la zona o la
válvula están deshabilitadas o es hora de silencio
([`04-resume-after-restart`](../06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md) §4.3).
Pausar, detener o regar a mano la válvula mientras espera la descarta sin aviso.

**Componente.** `IrrigationManager._not_resumed_locked` (`manager.py:<línea>`) llama a
`Incidents.push_not_resumed` (`incidents.py:<línea>`).

**Datos del push.** `{minutes}`: minutos que faltaban, redondeados hacia arriba.
```

    Sustituir cada `<línea>` por la línea real tras las tareas 1-4.

- [ ] **Paso 4: spec 04.** «Estado: **implementado** · 2026-10-06». Bajo la línea de «Depende de»,
  añadir «> Plan: [`../plans/04-resume-after-restart.md`](../plans/04-resume-after-restart.md).».
  Revisar las citas `archivo:línea` de la spec 04 (`engine/manager.py`, `engine/slots.py`,
  `frontend/src/shared/valve-status.ts`, `domain/alerts.py`, `frontend/src/alerts.ts`) y
  corregirlas si se han movido.

- [ ] **Paso 5: spec 03.** En §4.3, al final del punto «**Al arrancar** (`_async_recover`)…»,
  añadir «Sustituido por [04-resume-after-restart](../04-resume-after-restart/spec.md) §4.1.».

- [ ] **Paso 6: README del cambio.** «Estado: **implementado**». Fila 4: «Implementado».

---

## Validación funcional (usuario, en su HA)

Fuera del plan de agentes. Riego de prueba de 20 min; reiniciar HA a mitad.

1. HA y la `switch` vuelven en unos minutos. Esperado: en el log, `... riego interrumpido
   retomado, faltan N min`, y la válvula riega N min más.
2. Con la `switch` aún `unavailable` al arrancar (Zigbee lento), la válvula sale «Interrumpida ·
   faltan N min» con el botón Pausar. Al volver la `switch`, se retoma.
3. En ese estado, pulsar Pausar. Esperado: `... riego interrumpido descartado; no se retoma`, sin
   push, y la válvula en reposo.
4. Con un bloque de esa válvula pocos minutos después de la vuelta: no se retoma y llega el push
   «… Faltaron N min. No se retoma.». El bloque riega a su hora.
5. Panel de alertas: el tipo «No retomado tras reinicio» sale con destinos y prioridad propios y la
   casilla «Histórico» bloqueada.
