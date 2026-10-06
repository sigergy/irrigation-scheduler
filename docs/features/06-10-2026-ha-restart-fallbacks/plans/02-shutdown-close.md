# Cierre de válvulas al reiniciar o apagar HA — plan de implementación

> **Para agentes:** sub-skill obligatoria: `subagent-driven-development` (recomendada) o
> `executing-plans`. Los pasos usan casillas (`- [ ]`). En este proyecto el implementador **no hace
> commit**: deja los cambios en el árbol; el controlador revisa el diff, pasa los gates y hace el
> commit al cerrar cada tarea.

**Objetivo:** en una parada ordenada de HA (reinicio o apagado), cerrar en stage 1 todas las
`switch` de riego que no estén en `off`, con un intento por `switch`, en paralelo y en 12 s como
mucho. Sin avisos, solo log.

**Arquitectura:** un método nuevo del manager, `async_close_on_stop`, registrado como shutdown job en
`async_setup_entry`. Reutiliza `async_shutdown` para cerrar la puerta y `async_set_valve(retries=0)`
para cada apagado. Retoques en el manager con `_stopping` activo: el despacho no abre nada, una
apertura en curso deja de reintentar, no se programan cierres y el arranque no registra oyentes si
HA empieza a parar mientras recupera.

**Stack:** Python 3.14, Home Assistant 2026.9 (custom integration), ruff.

**Spec:** [`../02-shutdown-close/spec.md`](../02-shutdown-close/spec.md) (§4 decisiones, §5 diseño,
§6 límites).

## Restricciones globales

- Comentarios en español; nombres de código en inglés. Ficheros `snake_case` (estándar Python).
- **Sin tests nuevos**: norma del proyecto para features. La validación funcional la hace el usuario
  en su HA (2026.9).
- Gates locales en cada tarea:
  - `uvx ruff check custom_components`
  - `py -3.14 -m compileall -q custom_components`
- `pytest` solo corre en GitHub Actions (`.github/workflows/tests.yml`). Los tests existentes deben
  seguir en verde, en especial `engine/tests/test_lock.py`, `engine/tests/test_layers.py` y
  `engine/tests/test_characterization.py`.
- `engine/` no importa `api` ni `entities` (`engine/tests/test_layers.py`).
- Fuera de `slots.py`, nada llama a mutadores de `ValveSlots` (`MUTATORS`, `engine/slots.py:14-28`)
  ni a `*_locked` sin el lock (`engine/tests/test_lock.py`). El cálculo de objetivos solo usa vistas
  (`busy()`), que no son mutadores.
- Tiempos: `SHUTDOWN_CLOSE_TIMEOUT_S = 10` y `SHUTDOWN_LOCK_TIMEOUT_S = 2` (12 s en total, spec §4).
- Sin push ni eventos en el cierre al parar: solo `_LOGGER.info` / `_LOGGER.warning`.
- Ruff: `line-length = 120`, reglas `E, F, I, UP, B` (`pyproject.toml`). Los imports van en el
  orden de isort (mayúsculas primero, orden ASCII).
- Rama: `sigergy/ha-restart-fallbacks-impl`. Push, merge y PR, solo con confirmación del usuario.

## Mapa de ficheros

| Fichero | Cambio |
|---|---|
| `custom_components/irrigation_scheduler/const.py` | Constantes `SHUTDOWN_CLOSE_TIMEOUT_S` y `SHUTDOWN_LOCK_TIMEOUT_S` |
| `custom_components/irrigation_scheduler/engine/manager.py` | Puerta del despacho, apertura y arranque al parar, cierres sin temporizador y `async_close_on_stop` |
| `custom_components/irrigation_scheduler/__init__.py` | Registro del shutdown job |
| `docs/...` | Specs vivas y estado (tarea 3) |

---

### Tarea 1: nada se abre ni se registra con la integración parando

**Ficheros** (líneas del código antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:127-143` (`_async_on_started`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:145-160` (`async_shutdown`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:460-477` (`_async_dispatch_locked`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:562-566` (`_async_quiet_end`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:570-597` (`_async_open_job`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:599-608` (`_mark_open_locked`,
  `_schedule_close`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:626-638` (`_async_finish_close`)

**Interfaces:** ninguna nueva. Comportamiento con `_stopping` activo: el despacho no reserva ni abre
nada; una apertura en curso deja de reintentar sin avisar de fallo; no se programa ningún cierre;
el arranque no registra oyentes, disparos ni latido; guardar zona o ajustes no vuelve a registrar
oyentes. Sin `_stopping`, el comportamiento no cambia.

- [ ] **Paso 1: puerta del despacho.** En `_async_dispatch_locked`, justo después del docstring y
  antes de `if await self._quiet_hold_locked():`, añadir:

```python
        # parada de HA o descarga de la entry: no se abre nada más (02-shutdown-close §5.3)
        if self._stopping:
            return
```

- [ ] **Paso 2: quitar las comprobaciones que la puerta vuelve redundantes.**
  - En `_async_quiet_end`, sustituir:

```python
                await self._async_persist_locked()
                if not self._stopping:
                    # si se sigue dentro de una franja (ajustes movidos), la puerta vuelve a retener
                    await self._async_dispatch_locked()
```

  por:

```python
                await self._async_persist_locked()
                # si se sigue dentro de una franja (ajustes movidos), la puerta vuelve a retener
                await self._async_dispatch_locked()
```

  - En `_async_finish_close`, sustituir:

```python
            valve = self._slots.closed(entity_id)
            await self._async_persist_locked()
            if not self._stopping:
                await self._async_dispatch_locked()
```

  por:

```python
            valve = self._slots.closed(entity_id)
            await self._async_persist_locked()
            await self._async_dispatch_locked()
```

  - `_async_open_job` se trata en el paso 3. No tocar `_async_recover_rain` (`:391`, `:394`),
    `_schedule_quiet_end` (`:503`) ni `_async_close_failed` (`:648`): no dependen del despacho.

- [ ] **Paso 3: apertura en curso al parar.** En `_async_open_job`, sustituir desde la llamada a
  `async_set_valve` hasta el final del método:

```python
        ok = await async_set_valve(
            self.hass, job.entity_id, turn_on=True, cancelled=lambda: self._slots.is_cancelled(job.entity_id)
        )
        cancelled = False
        closing = False
        async with self._lock:
            cancelled = self._slots.finish_opening(job.entity_id)
            if ok:
                self._mark_open_locked(job)
                if cancelled:
                    closing = self._begin_close_locked(job.entity_id)
            await self._async_persist_locked()
            if not self._stopping and not (ok and cancelled):
                await self._async_dispatch_locked()
        if ok and cancelled and closing:
            await self._async_finish_close(job.entity_id)
        # pausada mientras reintentaba: la pausa es del usuario, no es un fallo
        elif not ok and not cancelled:
            await self._incidents.valve_error(job.zone_id, job.entity_id, True)
```

  por:

```python
        ok = await async_set_valve(
            self.hass,
            job.entity_id,
            turn_on=True,
            # al parar HA deja de reintentar, como con una pausa (02-shutdown-close §5.4)
            cancelled=lambda: self._stopping or self._slots.is_cancelled(job.entity_id),
        )
        cancelled = False
        closing = False
        async with self._lock:
            cancelled = self._slots.finish_opening(job.entity_id)
            if ok:
                # parando: queda en open_valves sin temporizador; la cierra async_close_on_stop
                self._mark_open_locked(job)
                if cancelled:
                    closing = self._begin_close_locked(job.entity_id)
            await self._async_persist_locked()
            if not (ok and cancelled):
                await self._async_dispatch_locked()
        if ok and cancelled and closing:
            await self._async_finish_close(job.entity_id)
        # pausada mientras reintentaba, o HA parando: no es un fallo
        elif not ok and not cancelled and not self._stopping:
            await self._incidents.valve_error(job.zone_id, job.entity_id, True)
```

  Nota: `_spawn` crea la tarea con arranque inmediato (`eager_start=True` por defecto en
  `hass.async_create_background_task`), así que una apertura reservada ya ha enviado su `turn_on`
  antes de que el job de parada pueda correr. No hace falta comprobar `_stopping` antes del
  `turn_on`.

- [ ] **Paso 4: sin temporizadores de cierre al parar.** Sustituir:

```python
    def _mark_open_locked(self, job: Job) -> None:
        """Requiere el lock. Registra la válvula abierta y, si procede, programa su cierre."""
        valve = self._slots.opened(job, dt_util.utcnow())
        if not self._stopping:
            self._schedule_close(valve)

    def _schedule_close(self, valve: OpenValve) -> None:
        self._close_unsubs[valve.entity_id] = async_track_point_in_utc_time(
```

  por:

```python
    def _mark_open_locked(self, job: Job) -> None:
        """Requiere el lock. Registra la válvula abierta y programa su cierre."""
        self._schedule_close(self._slots.opened(job, dt_util.utcnow()))

    def _schedule_close(self, valve: OpenValve) -> None:
        """Programa el apagado en `ends_at`. Parando no: la cierra el job de parada o el arranque."""
        if self._stopping:
            return
        self._close_unsubs[valve.entity_id] = async_track_point_in_utc_time(
```

  Motivo: `_async_recover` (`:183`) también llama a `_schedule_close`. Si HA empieza a parar
  mientras el arranque tiene el lock, el temporizador quedaría vivo tras `async_shutdown`.

- [ ] **Paso 5: arranque interrumpido por la parada.**
  - En `async_shutdown`, justo después de `self._stopping = True`, añadir:

```python
        # guardar zona o ajustes ya no vuelve a registrar oyentes ni disparos
        self._started = False
```

  - En `_async_on_started`, sustituir:

```python
        undecided, soon = await self._async_recover()
        self._started = True
```

  por:

```python
        undecided, soon = await self._async_recover()
        if self._stopping:
            # HA empezó a parar durante la recuperación: no se registra nada (02-shutdown-close §5.3)
            return
        self._started = True
```

  Motivo: `_async_recover` puede tener el lock varios segundos (spec §5.2.1). Si el job corre
  entonces, al volver `_async_on_started` registraría de nuevo los oyentes de las switch (y con
  ellos los push de encendido/apagado de `engine/triggers.py:123-166`), los disparos, el latido y
  la lluvia, después de `async_shutdown`.

- [ ] **Paso 6: gates.**

```bash
uvx ruff check custom_components
py -3.14 -m compileall -q custom_components
```

  Esperado: `All checks passed!` y ninguna salida de `compileall`.

- [ ] **Paso 7: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/engine/manager.py
git commit -m "feat(engine): sin despacho, cierres programados ni oyentes con la integración parando"
```

---

### Tarea 2: `async_close_on_stop` y registro del shutdown job

**Ficheros:**
- Modificar: `custom_components/irrigation_scheduler/const.py:58-60` (tras `CLOSE_RETRY_OFFSETS_S`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py` (imports `:12` y `:27-45`;
  método nuevo tras `async_shutdown`)
- Modificar: `custom_components/irrigation_scheduler/__init__.py:12, 62-77`

**Interfaces:**
- Produce: `SHUTDOWN_CLOSE_TIMEOUT_S: int` y `SHUTDOWN_LOCK_TIMEOUT_S: int` en `const.py`.
- Produce: `IrrigationManager.async_close_on_stop(self) -> None` (coroutine).
- Consume: `async_set_valve(..., retries=0)` (`adapters/valves.py:18-49`), `ValveSlots.busy()` y
  `ValveSlots.closed()`, `CloseRetry.active()`, `async_shutdown()`.
- Consume (HA, verificado en `home-assistant/core` `dev`): `hass.async_add_shutdown_job(hassjob, *args)
  -> CALLBACK_TYPE` (`homeassistant/core.py:1042-1075`) y
  `hass.async_create_task(target, name=None, eager_start=True)` (`homeassistant/core.py:787-806`).

- [ ] **Paso 1: constantes.** En `const.py`, justo después de `CLOSE_RETRY_OFFSETS_S = (...)`:

```python

# Cierre al parar HA, en stage 1 (20 s compartidos con otras integraciones): espera máxima de los
# apagados y del lock (docs/features/06-10-2026-ha-restart-fallbacks/02-shutdown-close/spec.md §4)
SHUTDOWN_CLOSE_TIMEOUT_S = 10
SHUTDOWN_LOCK_TIMEOUT_S = 2
```

- [ ] **Paso 2: imports del manager.** En `engine/manager.py`:
  - `from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN` →
    `from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN`
  - En el bloque `from ..const import (...)`, añadir `SHUTDOWN_CLOSE_TIMEOUT_S` y
    `SHUTDOWN_LOCK_TIMEOUT_S` **detrás de `RAIN_STARTUP_RETRY_S` y delante de `SIGNAL_CONFIG`**
    (orden de isort: `SH` < `SI`; en otro sitio ruff da `I001`).

- [ ] **Paso 3: método.** En `engine/manager.py`, justo después de `async_shutdown` (antes de
  `_async_recover`):

```python
    async def async_close_on_stop(self) -> None:
        """Parada ordenada de HA, stage 1 (02-shutdown-close §5): cierra las switch de riego.

        Un intento por switch, en paralelo y con tope de tiempo. Sin avisos: solo log. La cola no
        se toca. Las gestionadas que cierran se dan por terminadas; las que fallan siguen en el
        runtime y las trata el arranque (valves-execution §5.2).
        """
        # foto sin await en medio: no espera al lock, que el arranque puede tener cogido
        targets = sorted(
            {
                valve.entity_id
                for zone in self.config.zones.values()
                for valve in zone.valves
                if (state := self.hass.states.get(valve.entity_id)) is not None and state.state != STATE_OFF
            }
            | self._slots.busy()
            | self._close_retry.active()
        )
        # puerta cerrada: sin temporizadores, disparos, oyentes de switch (sin push de encendido o
        # apagado), latido, lluvia, reintentos de cierre ni despacho
        self.async_shutdown()
        if not targets:
            return
        tasks = {
            entity_id: self.hass.async_create_task(
                async_set_valve(self.hass, entity_id, turn_on=False, retries=0),
                f"irrigation_stop_close_{entity_id}",
            )
            for entity_id in targets
        }
        await asyncio.wait(tasks.values(), timeout=SHUTDOWN_CLOSE_TIMEOUT_S)
        closed: list[str] = []
        for entity_id, task in tasks.items():
            if not task.done() or task.cancelled():
                # sin terminar en el tope: se cancela y cuenta como fallo
                task.cancel()
                _LOGGER.warning(
                    "%s no se ha podido cerrar al parar HA: sin respuesta en %s s",
                    entity_id,
                    SHUTDOWN_CLOSE_TIMEOUT_S,
                )
            elif (err := task.exception()) is not None:
                _LOGGER.warning("%s no se ha podido cerrar al parar HA: %s", entity_id, err)
            elif task.result():
                closed.append(entity_id)
                _LOGGER.info("%s cerrada al parar HA", entity_id)
            else:
                _LOGGER.warning("%s no se ha podido cerrar al parar HA", entity_id)
        if not closed:
            # nada que reflejar en el runtime: no se gasta la espera del lock
            return
        try:
            async with asyncio.timeout(SHUTDOWN_LOCK_TIMEOUT_S), self._lock:
                for entity_id in closed:
                    # riego terminado (02-shutdown-close §1); las fallidas siguen en open_valves
                    self._slots.closed(entity_id)
                # escritura diferida: con HA aún en marcha se escribe ya; si no, la vuelca stage 3
                await self._async_persist_locked()
        except TimeoutError:
            _LOGGER.warning("Sin lock al parar HA: el runtime no refleja los cierres")
```

  Notas para el implementador:
  - `self._slots.closed(entity_id)` es seguro para `switch` que no están en `open_valves` (encendidas
    a mano, abriéndose): solo hace `discard` y `pop(..., None)` (`engine/slots.py:90-93`).
  - `async with asyncio.timeout(...), self._lock:` es una sola sentencia `async with` con dos
    gestores. `engine/tests/test_lock.py:38-42` la reconoce porque mira los `items` de cada
    `AsyncWith`. El cuerpo no tiene puntos de espera reales (`_async_persist_locked` no hace
    `await`), así que el tope solo cuenta la espera del lock. Ruff (`SIM` no está activo) no pide
    otra forma.
  - El orden importa: los objetivos se calculan **antes** de `async_shutdown`, porque
    `CloseRetry.cancel_all` vacía `active()`.
  - `task.cancelled()` va antes de `task.exception()`: con una tarea cancelada, `exception()` lanza
    `CancelledError`. Llamar a `exception()` también evita el log «Task exception was never
    retrieved».
  - Las tareas son normales (`hass.async_create_task`), no de fondo: HA cancela las de fondo al
    empezar stage 2 (`homeassistant/core.py:1176-1180`), y estas ya han terminado o se han
    cancelado aquí.
  - `async_set_valve` ya registra con `error` cada apagado fallido (`adapters/valves.py:48`); el
    `warning` de aquí añade el contexto de la parada.

- [ ] **Paso 4: registro del job.** En `__init__.py`:
  - `from homeassistant.core import HomeAssistant` → `from homeassistant.core import HassJob, HomeAssistant`
  - En `async_setup_entry`, justo después de `entry.runtime_data = manager`:

```python
    # parada ordenada de HA: cierra las válvulas en stage 1, con Zigbee aún vivo
    # (02-shutdown-close §5.1); la entry no se descarga al parar, así que no vale async_unload_entry
    entry.async_on_unload(hass.async_add_shutdown_job(HassJob(manager.async_close_on_stop)))
```

  Si el resto de `async_setup_entry` falla, HA ejecuta los `async_on_unload` registrados
  (`homeassistant/config_entries.py:1003-1005`): el job no queda huérfano.

- [ ] **Paso 5: gates.**

```bash
uvx ruff check custom_components
py -3.14 -m compileall -q custom_components
```

  Esperado: `All checks passed!` y ninguna salida de `compileall`.

- [ ] **Paso 6: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/const.py custom_components/irrigation_scheduler/engine/manager.py custom_components/irrigation_scheduler/__init__.py
git commit -m "feat(engine): cierre de válvulas en la parada ordenada de HA"
```

---

### Tarea 3: documentación viva y estado

**Ficheros:**
- Modificar: `docs/features/valves-execution/spec.md` §5 (tras §5.1, `:66-84`) y límites de §5.3
  (`:121-125`)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/02-shutdown-close/spec.md` (cabecera y
  §2.4)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/README.md` (tabla)

- [ ] **Paso 1: `valves-execution/spec.md`.** Justo antes de `### 5.2 Al arrancar HA`, añadir:

```markdown
### 5.1.1 Al parar HA

En una parada ordenada (reinicio o apagado), en stage 1, con Zigbee aún vivo:

- se apaga la `switch` de toda válvula configurada que no esté en `off`, y las que la integración
  tiene abiertas, abriéndose o cerrándose, o con reintentos de cierre en marcha (§6);
- un intento por `switch`, en paralelo, 12 s como mucho; sin avisos, solo log;
- la válvula gestionada que cierra da su riego por terminado; la que falla sigue en el runtime y al
  arrancar actúa §5.2;
- la cola no se toca y no se abre nada más.

Detalle: [`02-shutdown-close/spec.md`](../06-10-2026-ha-restart-fallbacks/02-shutdown-close/spec.md).
```

  En «Límites conocidos» de §5.3, sustituir «- Con HA parado nadie puede apagar nada; al arrancar
  actúa §5.2.» por «- Con HA parado nadie puede apagar nada; al arrancar actúa §5.2. En una parada
  ordenada se cierran antes (§5.1.1).». Actualizar `> Última actualización:` a `2026-10-06` si no
  lo está.

- [ ] **Paso 2: estado del cambio.**
  - `02-shutdown-close/spec.md`: `> Estado: **diseño aprobado** · 2026-10-06` →
    `> Estado: **implementado** · 2026-10-06`. En §2.4, añadir al final de la primera viñeta:
    « Lo añade este cambio: `async_close_on_stop` en `engine/manager.py`.»
  - `README.md` del cambio, fila 2: `Diseño aprobado` → `Implementado`.

- [ ] **Paso 3: revisar las citas `archivo:línea`** de `02-shutdown-close/spec.md` (§2.4, §3, §5,
  §6) contra el código ya cambiado. Corregir las que se hayan movido (las tareas 1 y 2 desplazan
  `async_shutdown` y `_async_recover`).

- [ ] **Paso 4: commit (controlador).**

```bash
git add docs/features/valves-execution/spec.md docs/features/06-10-2026-ha-restart-fallbacks
git commit -m "docs(valves): cierre de válvulas al parar HA en las specs vivas"
```

---

## Validación funcional (usuario, en su HA)

Fuera del plan de agentes.

1. Con una válvula regando, reiniciar HA desde la interfaz. Esperado: la válvula se cierra antes de
   que HA pare; en el log, `... cerrada al parar HA`; sin push de apagado. Al volver, no salta
   `turn_off_failed` ni `overrun_restart` para ella y no figura como abierta.
2. Con una `switch` configurada encendida a mano, reiniciar HA. Esperado: se cierra igual.
3. Con trabajos en cola, reiniciar. Esperado: al volver, la cola sigue y se despacha.
