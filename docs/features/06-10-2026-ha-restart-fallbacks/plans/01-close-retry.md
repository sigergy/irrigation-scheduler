# Reintentos de cierre en segundo plano — plan de implementación

> **Para agentes:** sub-skill obligatoria: `subagent-driven-development` (recomendada) o
> `executing-plans`. Los pasos usan casillas (`- [ ]`). En este proyecto el implementador **no hace
> commit**: deja los cambios en el árbol; el controlador revisa el diff, pasa los gates y hace el
> commit al cerrar cada tarea.

**Objetivo:** cuando falla el apagado de una válvula, seguir intentándolo en segundo plano 10 veces
(3 en 30 s, luego 1 por minuto) y avisar solo al final: «límite superado» o «ya cerrada».

**Arquitectura:** un módulo nuevo `engine/close_retry.py` con la clase `CloseRetry`, que gestiona un
fallback por `entity_id` con `async_call_later` y un listener de estado. No toma el lock del manager
ni toca `ValveSlots`. El manager la arranca desde un único helper que sustituye a las tres llamadas
`valve_error(..., False)` actuales. En vez de los callbacks de spec §6, recibe `Incidents` y el
manager llama a `cancel` al reabrir: menos piezas, mismo comportamiento.

**Stack:** Python 3.14, Home Assistant 2026.9 (custom integration), ruff.

**Spec:** [`../01-close-retry/spec.md`](../01-close-retry/spec.md).

## Restricciones globales

- Comentarios en español; nombres de código en inglés. Ficheros `snake_case` (estándar Python).
- **Sin tests nuevos**: norma del proyecto para features. La validación funcional la hace el usuario
  en su HA (2026.9).
- Gates locales en cada tarea:
  - `uvx ruff check custom_components`
  - `py -3.14 -m compileall -q custom_components`
- `pytest` solo corre en GitHub Actions (`.github/workflows/tests.yml`). Los tests existentes deben
  seguir en verde, en especial `engine/tests/test_lock.py`, `engine/tests/test_layers.py` y
  `engine/tests/test_characterization.py::test_delete_zone_keeps_zone_when_turn_off_fails`, que
  provoca un fallback y depende de que `async_shutdown` lo cancele.
- `engine/` no importa `api` ni `entities` (`engine/tests/test_layers.py`).
- Fuera de `slots.py`, nada llama a mutadores de `ValveSlots` ni a `*_locked` sin el lock
  (`engine/tests/test_lock.py`). `CloseRetry` no los usa.
- Secuencia, desde el inicio del fallback: `(10, 20, 30, 90, 150, 210, 270, 330, 390, 450)` s.
- Textos exactos de los avisos: spec §4.
- Rama: `feat/ha-restart-fallbacks`. Push, merge y PR, solo con confirmación del usuario. El PR va
  contra `clean-refactor`.

## Mapa de ficheros

| Fichero | Cambio |
|---|---|
| `custom_components/irrigation_scheduler/const.py` | Constante `CLOSE_RETRY_OFFSETS_S` |
| `custom_components/irrigation_scheduler/adapters/valves.py` | Parámetro `retries` en `async_set_valve` |
| `custom_components/irrigation_scheduler/adapters/notify.py` | Textos `turn_off_gave_up` y `turn_off_recovered`; `severity` en `compose_notice` |
| `custom_components/irrigation_scheduler/engine/incidents.py` | `_names`, overrides en `_send`, `valve_close_gave_up`, `push_close_recovered` |
| `custom_components/irrigation_scheduler/engine/close_retry.py` | **Nuevo.** Clase `CloseRetry` |
| `custom_components/irrigation_scheduler/engine/manager.py` | Helper `_async_close_failed` y enganches |
| `docs/...` | Specs vivas y estado (tarea 5) |

---

### Tarea 1: intento único en `async_set_valve` y constante de la secuencia

**Ficheros:**
- Modificar: `custom_components/irrigation_scheduler/const.py:54-56`
- Modificar: `custom_components/irrigation_scheduler/adapters/valves.py:13-47`

**Interfaces:**
- Produce: `CLOSE_RETRY_OFFSETS_S: tuple[int, ...]` en `const.py`.
- Produce: `async_set_valve(hass, entity_id, turn_on, cancelled=None, retries: int = SWITCH_RETRIES) -> bool`.
  Las llamadas actuales no cambian.

- [ ] **Paso 1: constante.** En `const.py`, justo después de `VERIFY_DELAY_S = 2`:

```python

# Reintentos de cierre en segundo plano tras fallar la ráfaga, en segundos desde su inicio
# (docs/features/06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md §2)
CLOSE_RETRY_OFFSETS_S = (10, 20, 30, 90, 150, 210, 270, 330, 390, 450)
```

- [ ] **Paso 2: parámetro `retries`.** En `adapters/valves.py`, sustituir la firma, el docstring, el
  bucle y el log final:

```python
async def async_set_valve(
    hass: HomeAssistant,
    entity_id: str,
    turn_on: bool,
    cancelled: Callable[[], bool] | None = None,
    retries: int = SWITCH_RETRIES,
) -> bool:
    """Devuelve True si la switch llega al estado pedido. 1 intento + `retries`.

    `cancelled`: si devuelve True tras un intento fallido, no se reintenta y se devuelve False.
    `retries=0`: un solo intento, para los reintentos en segundo plano (01-close-retry).
    """
    service = SERVICE_TURN_ON if turn_on else SERVICE_TURN_OFF
    target = STATE_ON if turn_on else STATE_OFF
    for attempt in range(1 + retries):
```

  El cuerpo del bucle no cambia. La última línea pasa a:

```python
    _LOGGER.error("%s %s sin respuesta tras %s reintentos", service, entity_id, retries)
    return False
```

- [ ] **Paso 3: gates.**

Run: `uvx ruff check custom_components` → `All checks passed!`
Run: `py -3.14 -m compileall -q custom_components` → sin salida, código 0.

- [ ] **Paso 4: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/const.py custom_components/irrigation_scheduler/adapters/valves.py
git commit -m "feat(valves): intento único en async_set_valve y secuencia de reintentos de cierre"
```

---

### Tarea 2: avisos «límite superado» y «ya cerrada»

**Ficheros:**
- Modificar: `custom_components/irrigation_scheduler/adapters/notify.py` (`MESSAGES` es/en y `compose_notice`, `:143-168`)
- Modificar: `custom_components/irrigation_scheduler/engine/incidents.py` (`_send` `:52-70`, `alert` `:72-99`, métodos nuevos tras `valve_error` `:101-116`)

**Interfaces:**
- Consume: nada de la tarea 1.
- Produce, en `Incidents`:
  - `async def valve_close_gave_up(self, zone_id: str, entity_id: str) -> None`
  - `async def push_close_recovered(self, zone_id: str, entity_id: str) -> None`
- Produce: `compose_notice(..., severity: str | None = None, ...)`.

- [ ] **Paso 1: textos.** En `adapters/notify.py`, `MESSAGES["es"]`, justo después de la entrada
  `"turn_off_failed": (...)`:

```python
        "turn_off_gave_up": (
            "{zone} · {entity}: error en cierre de válvula. Se ha superado el límite de reintentos "
            "({time}). Ciérrala a mano."
        ),
        "turn_off_recovered": "{zone} · {entity}: cerrada por reintento a las {time}. Ya no hace falta cerrarla a mano.",
```

  En `MESSAGES["en"]`, justo después de su `"turn_off_failed": (...)`:

```python
        "turn_off_gave_up": "{zone} · {entity}: valve close error. Retry limit exceeded ({time}). Close it by hand.",
        "turn_off_recovered": "{zone} · {entity}: closed on retry at {time}. No need to close it by hand.",
```

- [ ] **Paso 2: cabecera configurable en `compose_notice`.** Añadir el parámetro `severity` tras
  `kind` y usarlo en el título:

```python
    kind: str | None = None,
    severity: str | None = None,
    **fields: str,
) -> Notice:
    """Compone el aviso con la hora de ahora, no la del envío (spec §A.2.1).

    `kind`: texto de MESSAGES si no es el del tipo (valve_switched → valve_on / valve_off).
    `severity`: cabecera si no es la del tipo (turn_off_recovered es informativo).
    """
    texts = _texts(hass)
    return Notice(
        title=texts[f"title_{severity or ALERT_TYPES[alert_id].severity}"],
```

  El resto de `compose_notice` no cambia.

- [ ] **Paso 3: `_send` con prioridad y cabecera opcionales.** En `engine/incidents.py`, sustituir
  `_send` entero:

```python
    def _send(
        self,
        alert_id: str,
        targets: tuple[list[str], list[str]],
        *,
        kind: str | None = None,
        priority: str | None = None,
        severity: str | None = None,
        **fields: str,
    ) -> None:
        """Compone el aviso ahora y lo lanza en segundo plano: no espera a ningún canal.

        `priority` y `severity`: solo si el aviso no usa los del tipo (turn_off_recovered).
        """
        settings = self._config().settings
        phones, speakers = targets
        self._notifier.send(
            compose_notice(
                self.hass,
                alert_id,
                priority or alert_priority(settings, alert_id),
                phones,
                voice_targets=speakers,
                tts_entity=settings.tts_entity,
                tts_volume=settings.tts_volume,
                kind=kind,
                severity=severity,
                **fields,
            )
        )
```

- [ ] **Paso 4: extraer los nombres del push.** Añadir este método justo antes de `alert`:

```python
    def _names(self, zone_id: str | None, entity_id: str | None) -> dict[str, str]:
        """Campos zone y entity del push. Válvula: su nombre propio (V12); otra entidad: su nombre en HA."""
        zone = self._config().zones.get(zone_id) if zone_id else None
        valve = (
            next((v for v in zone.valves if v.entity_id == entity_id), None) if zone else None
        )
        state = self.hass.states.get(entity_id) if entity_id else None
        entity = valve.name if valve else state.name if state else entity_id or ""
        return {"zone": zone.name if zone else zone_id or "", "entity": entity}
```

  En `alert`, sustituir desde `zone = self._config().zones.get(...)` hasta el final del método por:

```python
        self._send(alert_id, targets, **self._names(zone_id, entity_id), **push_fields)
```

- [ ] **Paso 5: métodos nuevos.** Justo después de `valve_error`:

```python
    async def valve_close_gave_up(self, zone_id: str, entity_id: str) -> None:
        """Fallan los reintentos de cierre en segundo plano (01-close-retry §4).

        Mismo tipo que turn_off_failed: su entidad event, su prioridad y sus destinos; otro texto.
        """
        alert_id = "turn_off_failed"
        await self.alert(
            alert_id,
            zone_id,
            entity_id,
            EVENT_VALVE_ERROR,
            {
                "zone_id": zone_id,
                "entity_id": entity_id,
                "action": "turn_off_gave_up",
                "priority": alert_priority(self._config().settings, alert_id),
            },
            kind="turn_off_gave_up",
        )

    async def push_close_recovered(self, zone_id: str, entity_id: str) -> None:
        """La switch se cierra durante los reintentos (01-close-retry §4).

        Solo push, prioridad normal, destinos de turn_off_failed: sin entidad event ni evento de bus.
        """
        if not any(targets := self._targets("turn_off_failed")):
            return
        self._send(
            "turn_off_failed",
            targets,
            kind="turn_off_recovered",
            priority=PRIORITY_NORMAL,
            severity=SEVERITY_INFO,
            **self._names(zone_id, entity_id),
        )
```

  Imports en `engine/incidents.py`: añadir `PRIORITY_NORMAL` al bloque `from ..const import (...)`
  (orden alfabético) y `SEVERITY_INFO` a
  `from ..domain.alerts import Alert, SEVERITY_INFO, alert_priority, push_targets, voice_targets`.
  Dejar que ruff ordene: `uvx ruff check --fix --select I custom_components/irrigation_scheduler/engine/incidents.py`.

- [ ] **Paso 6: gates.**

Run: `uvx ruff check custom_components` → `All checks passed!`
Run: `py -3.14 -m compileall -q custom_components` → sin salida, código 0.

- [ ] **Paso 7: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/adapters/notify.py custom_components/irrigation_scheduler/engine/incidents.py
git commit -m "feat(alerts): avisos de límite de reintentos superado y de cierre recuperado"
```

---

### Tarea 3: clase `CloseRetry`

**Ficheros:**
- Crear: `custom_components/irrigation_scheduler/engine/close_retry.py`

**Interfaces:**
- Consume: `CLOSE_RETRY_OFFSETS_S` y `async_set_valve(..., retries=0)` (tarea 1);
  `Incidents.valve_close_gave_up` e `Incidents.push_close_recovered` (tarea 2).
- Produce, en `CloseRetry(hass: HomeAssistant, incidents: Incidents)`:
  - `start(zone_id: str, entity_id: str) -> None`: arranca el fallback. Si ya hay uno para esa switch, no hace nada.
  - `cancel(entity_id: str) -> None`: para sin aviso.
  - `cancel_all() -> None`: para todos sin aviso (descarga de la entry).
  - `is_active(entity_id: str) -> bool`
  - `active() -> set[str]`

- [ ] **Paso 1: crear el módulo.**

```python
"""Reintentos de cierre en segundo plano tras fallar la ráfaga de apagado.

Spec: docs/features/06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from ..adapters.valves import async_set_valve
from ..const import CLOSE_RETRY_OFFSETS_S
from .incidents import Incidents

_LOGGER = logging.getLogger(__name__)


@dataclass
class _Retry:
    """Fallback de una switch: reintentos contados y lo que sigue vivo."""

    zone_id: str
    # hora del bucle al empezar: la secuencia cuenta desde aquí (spec §2)
    started: float
    done: int = 0
    timer: CALLBACK_TYPE | None = None
    unsub_state: CALLBACK_TYPE | None = None
    # intento en curso; como mucho uno por switch
    task: asyncio.Task[None] | None = None


class CloseRetry:
    """Un fallback por switch. No toma el lock del manager ni toca ValveSlots."""

    def __init__(self, hass: HomeAssistant, incidents: Incidents) -> None:
        self.hass = hass
        self._incidents = incidents
        self._retries: dict[str, _Retry] = {}

    def active(self) -> set[str]:
        """Switch con reintentos en marcha: quedan fuera de «encendida a mano» (spec §5)."""
        return set(self._retries)

    def is_active(self, entity_id: str) -> bool:
        return entity_id in self._retries

    @callback
    def start(self, zone_id: str, entity_id: str) -> None:
        """Arranca el fallback. Con uno ya en marcha sigue el que hay (spec §3)."""
        if entity_id in self._retries:
            return
        retry = _Retry(zone_id, self.hass.loop.time())
        self._retries[entity_id] = retry
        retry.unsub_state = async_track_state_change_event(self.hass, [entity_id], self._state_changed)
        _LOGGER.warning("%s: reintentos de cierre en segundo plano", entity_id)
        self._schedule_next(entity_id, retry)

    @callback
    def cancel(self, entity_id: str) -> None:
        """Para sin aviso: la integración vuelve a abrir la válvula."""
        self._drop(entity_id)

    @callback
    def cancel_all(self) -> None:
        """Para todos sin aviso: descarga de la entry o parada de HA (spec §3)."""
        for entity_id in list(self._retries):
            self._drop(entity_id)

    @callback
    def _schedule_next(self, entity_id: str, retry: _Retry) -> None:
        due = retry.started + CLOSE_RETRY_OFFSETS_S[retry.done]
        delay = max(0.0, due - self.hass.loop.time())
        retry.timer = async_call_later(self.hass, delay, partial(self._timer_fired, entity_id))

    @callback
    def _timer_fired(self, entity_id: str, _now: datetime) -> None:
        retry = self._retries.get(entity_id)
        if retry is None:
            return
        retry.timer = None
        if retry.task is not None:
            # otro intento en curso: este se salta y cuenta como hecho (spec §2)
            self._count_failed(entity_id, retry)
            return
        self._attempt(entity_id, retry, counted=True)

    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        retry = self._retries.get(entity_id)
        old_state = event.data["old_state"]
        new_state = event.data["new_state"]
        if retry is None or new_state is None:
            return
        if new_state.state == STATE_OFF:
            # cerrada por un reintento, a mano o por otro motivo
            self._finish(entity_id, recovered=True)
        elif (
            new_state.state == STATE_ON
            and old_state is not None
            and old_state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            and retry.task is None
        ):
            # vuelve la switch (Zigbee tras un reinicio): intento extra, fuera de la tabla (spec §2.1)
            self._attempt(entity_id, retry, counted=False)

    @callback
    def _attempt(self, entity_id: str, retry: _Retry, *, counted: bool) -> None:
        retry.task = self.hass.async_create_background_task(
            self._async_attempt(entity_id, retry, counted), f"irrigation_close_retry_{entity_id}"
        )

    async def _async_attempt(self, entity_id: str, retry: _Retry, counted: bool) -> None:
        ok = await async_set_valve(self.hass, entity_id, turn_on=False, retries=0)
        # terminado o cancelado mientras se intentaba: ya no es este fallback
        if self._retries.get(entity_id) is not retry:
            return
        retry.task = None
        if ok:
            self._finish(entity_id, recovered=True)
        elif counted:
            self._count_failed(entity_id, retry)

    @callback
    def _count_failed(self, entity_id: str, retry: _Retry) -> None:
        retry.done += 1
        if retry.done >= len(CLOSE_RETRY_OFFSETS_S):
            self._finish(entity_id, recovered=False)
        else:
            self._schedule_next(entity_id, retry)

    @callback
    def _finish(self, entity_id: str, *, recovered: bool) -> None:
        retry = self._drop(entity_id)
        if retry is None:
            return
        if recovered:
            _LOGGER.info("%s cerrada durante los reintentos en segundo plano", entity_id)
            self._notify(self._incidents.push_close_recovered(retry.zone_id, entity_id), entity_id)
        else:
            _LOGGER.error("%s sin cerrar tras %s reintentos en segundo plano", entity_id, retry.done)
            self._notify(self._incidents.valve_close_gave_up(retry.zone_id, entity_id), entity_id)

    @callback
    def _notify(self, coro: Coroutine[Any, Any, None], entity_id: str) -> None:
        self.hass.async_create_background_task(coro, f"irrigation_close_retry_notice_{entity_id}")

    @callback
    def _drop(self, entity_id: str) -> _Retry | None:
        """Quita el fallback y lo que tenga vivo. El intento en curso se cancela si no es quien llama."""
        retry = self._retries.pop(entity_id, None)
        if retry is None:
            return None
        if retry.timer is not None:
            retry.timer()
        if retry.unsub_state is not None:
            retry.unsub_state()
        if retry.task is not None and retry.task is not asyncio.current_task():
            retry.task.cancel()
        return retry
```

  Notas para el implementador:
  - `_async_attempt` pone `retry.task = None` **antes** de llamar a `_finish`. Así `_drop` no
    cancela la tarea que está corriendo.
  - Si el listener ve `off` mientras corre un intento, `_finish` cancela ese intento: la
    cancelación corta el `await` y el intento no avisa. Si el intento termina igualmente, la
    comprobación `self._retries.get(entity_id) is not retry` lo descarta. No hay doble aviso.

- [ ] **Paso 2: gates.**

Run: `uvx ruff check custom_components` → `All checks passed!`
Run: `py -3.14 -m compileall -q custom_components` → sin salida, código 0.

- [ ] **Paso 3: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/engine/close_retry.py
git commit -m "feat(engine): CloseRetry, reintentos de cierre en segundo plano"
```

---

### Tarea 4: enganche en el manager

**Ficheros:**
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py`
  - imports `:60-66`
  - `__init__` `:94-98`
  - `async_shutdown` `:143-156`
  - `_async_recover` `:176`
  - `_async_open_job` `:566-591`
  - `_async_finish_close` `:620-632`
  - `manual_on` `:634-636`
  - `_async_close_manual` `:655-663`

**Interfaces:**
- Consume: `CloseRetry` (tarea 3).
- Produce: `IrrigationManager._async_close_failed(zone_id: str, entity_id: str) -> None` (privado).

- [ ] **Paso 1: import.** Entre `from . import status` y `from .config_edit import ...` (orden de ruff):

```python
from .close_retry import CloseRetry
```

- [ ] **Paso 2: instancia.** En `__init__`, justo después de `self._incidents = Incidents(...)`:

```python
        # reintentos de cierre en segundo plano tras un apagado fallido (01-close-retry)
        self._close_retry = CloseRetry(hass, self._incidents)
```

- [ ] **Paso 3: cancelar al descargar.** En `async_shutdown`, justo antes de `self._cancel_quiet_end()`:

```python
        self._close_retry.cancel_all()
```

- [ ] **Paso 4: helper único.** Justo después de `_async_finish_close`:

```python
    async def _async_close_failed(self, zone_id: str, entity_id: str) -> None:
        """Falla la ráfaga de apagado: turn_off_failed y reintentos en segundo plano (01-close-retry).

        Con reintentos ya en marcha para esa switch no se repite el aviso.
        """
        if self._close_retry.is_active(entity_id):
            return
        await self._incidents.valve_error(zone_id, entity_id, False)
        if not self._stopping:
            self._close_retry.start(zone_id, entity_id)
```

- [ ] **Paso 5: sustituir las tres llamadas de apagado.**
  - `_async_recover` (`:176`):
    `await self._incidents.valve_error(valve.zone_id, valve.entity_id, False)` →
    `await self._async_close_failed(valve.zone_id, valve.entity_id)`
  - `_async_finish_close` (`:631`):
    `await self._incidents.valve_error(valve.zone_id, entity_id, False)` →
    `await self._async_close_failed(valve.zone_id, entity_id)`
  - `_async_close_manual` (`:662`):
    `await self._incidents.valve_error(zone_id, entity_id, False)` →
    `await self._async_close_failed(zone_id, entity_id)`

  La llamada de encendido (`valve_error(job.zone_id, job.entity_id, True)`, `:591`) **no cambia**.
  Comprobar: `grep -n "valve_error(" custom_components/irrigation_scheduler/engine/manager.py` →
  solo queda la de `True`.

- [ ] **Paso 6: fuera de «encendida a mano».** `manual_on` pasa a:

```python
    def manual_on(self) -> list[tuple[Zone, Valve, datetime]]:
        """Switch configuradas encendidas a mano: en `on` y fuera de la gestión propia (03 §5.3).

        Las que tienen reintentos de cierre en marcha tampoco cuentan (01-close-retry §5).
        """
        busy = self._slots.busy() | self._close_retry.active()
        return manual_on(self.hass, self.config.zones.values(), busy)
```

- [ ] **Paso 7: parar al reabrir.** Al principio de `_async_open_job`, justo después del docstring:

```python
        # un trabajo nuevo sobre esta switch manda: programa su propio cierre (01-close-retry §3)
        self._close_retry.cancel(job.entity_id)
```

- [ ] **Paso 8: gates.**

Run: `uvx ruff check custom_components` → `All checks passed!`
Run: `py -3.14 -m compileall -q custom_components` → sin salida, código 0.

- [ ] **Paso 9: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/engine/manager.py
git commit -m "feat(engine): reintentos de cierre en segundo plano en todos los apagados fallidos"
```

---

### Tarea 5: documentación viva y estado

**Ficheros:**
- Modificar: `docs/features/valves-execution/spec.md` §6 (`:127-136`) y §7.2 (fila de apagado, `:150`)
- Modificar: `docs/features/alerts/spec.md` §0.4 (`:51-57`) y §2 (`:110-121`)
- Modificar: `docs/features/alerts/README.md:46`
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md` (cabecera)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/README.md` (tabla)

- [ ] **Paso 1: `valves-execution/spec.md` §6.** Sustituir la viñeta
  «Si falla al **apagar**, se emite el mismo evento, con prioridad crítica, y se notifica (§7).» por:

```markdown
- Si falla al **apagar**, se emite el mismo evento, con prioridad crítica, y se notifica (§7).
  Después se sigue intentando en segundo plano: 10 reintentos a los 10, 20 y 30 s y luego uno por
  minuto hasta los 450 s. Sin aviso por cada fallo. Al final, un aviso de «límite superado» o de
  «ya cerrada». Detalle: [`01-close-retry/spec.md`](../06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md).
```

  Actualizar `> Última actualización:` de la cabecera a `2026-10-06`.

- [ ] **Paso 2: `valves-execution/spec.md` §7.2.** Justo después de la fila «La válvula no responde
  al **apagar** …», añadir:

```markdown
| La válvula sigue sin apagarse tras los 10 reintentos en segundo plano | Error | La de `turn_off_failed` |
| La válvula se cierra durante los reintentos en segundo plano | Info | Normal (solo push) |
```

- [ ] **Paso 3: `alerts/spec.md`.**
  - En §0.4, al final del párrafo, añadir: «Si falla un apagado, siguen 10 reintentos en segundo
    plano (`engine/close_retry.py`, `CLOSE_RETRY_OFFSETS_S` en `const.py`); ver §2.»
  - En §2, tras el párrafo «**Cuándo salta.**», añadir:

```markdown
**Reintentos en segundo plano.** Tras el aviso, `CloseRetry` (`engine/close_retry.py`) reintenta
10 veces: a los 10, 20 y 30 s y luego cada minuto hasta los 450 s. Si la switch pasa de
`unavailable`/`unknown` a `on`, hace un intento extra al momento. No avisa por cada fallo.

- Si fallan los 10: vuelve a saltar `turn_off_failed` (entidad event, evento de bus con
  `action: "turn_off_gave_up"` y push) con el texto «{zone} · {entity}: error en cierre de válvula.
  Se ha superado el límite de reintentos ({time}). Ciérrala a mano.»
- Si la switch pasa a `off`: solo push, cabecera Info, prioridad normal, mismos destinos:
  «{zone} · {entity}: cerrada por reintento a las {time}. Ya no hace falta cerrarla a mano.»
- Mientras dura, la switch no cuenta como encendida a mano. Si la integración la vuelve a abrir,
  los reintentos paran sin aviso. Se pierden si HA se reinicia.

Spec: [`01-close-retry/spec.md`](../06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md).
```

- [ ] **Paso 4: `alerts/README.md:46`.** En la última columna de `turn_off_failed`, añadir al final:
  « Después, 10 reintentos en segundo plano; avisa solo si se agotan o si se cierra.»

- [ ] **Paso 5: estado del cambio.**
  - `01-close-retry/spec.md`: `> Estado: **diseño aprobado** · 2026-10-06` →
    `> Estado: **implementado** · 2026-10-06`.
  - `README.md` del plan, fila 1: `Diseño aprobado` → `Implementado`.

- [ ] **Paso 6: revisar las citas `archivo:línea` de los pasos 1 y 3** contra el código ya
  cambiado. Corregir las que se hayan movido.

- [ ] **Paso 7: commit (controlador).**

```bash
git add docs/features/valves-execution/spec.md docs/features/alerts/spec.md docs/features/alerts/README.md docs/features/06-10-2026-ha-restart-fallbacks
git commit -m "docs(valves): reintentos de cierre en segundo plano en las specs vivas"
```

---

## Validación funcional (usuario, en su HA)

Fuera del plan de agentes. Se repite la prueba original: reiniciar HA a pocos segundos del final de
un riego. Resultado esperado:

1. Al arrancar: aviso `turn_off_failed`, como hoy.
2. Al volver Zigbee: la válvula se cierra en segundos. Llega el aviso «cerrada por reintento».
3. Ningún otro aviso.
