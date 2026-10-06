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
para cada apagado. Dos retoques en el manager: el despacho no abre nada con `_stopping` y una
apertura en curso deja de reintentar al parar.

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
- Fuera de `slots.py`, nada llama a mutadores de `ValveSlots` (`MUTATORS`, `engine/slots.py`) ni a
  `*_locked` sin el lock (`engine/tests/test_lock.py`). El cálculo de objetivos solo usa vistas
  (`busy()`), que no son mutadores.
- Tiempos: `SHUTDOWN_CLOSE_TIMEOUT_S = 10` y `SHUTDOWN_LOCK_TIMEOUT_S = 2` (12 s en total, spec §4).
- Sin push ni eventos en el cierre al parar: solo `_LOGGER.info` / `_LOGGER.warning`.
- Rama: `sigergy/ha-restart-fallbacks-impl`. Push, merge y PR, solo con confirmación del usuario.

## Mapa de ficheros

| Fichero | Cambio |
|---|---|
| `custom_components/irrigation_scheduler/const.py` | Constantes `SHUTDOWN_CLOSE_TIMEOUT_S` y `SHUTDOWN_LOCK_TIMEOUT_S` |
| `custom_components/irrigation_scheduler/engine/manager.py` | Puerta del despacho, apertura al parar y `async_close_on_stop` |
| `custom_components/irrigation_scheduler/__init__.py` | Registro del shutdown job |
| `docs/...` | Specs vivas y estado (tarea 3) |

---

### Tarea 1: puerta del despacho y aperturas en curso al parar

**Ficheros:**
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:460-477` (`_async_dispatch_locked`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:570-597` (`_async_open_job`)

**Interfaces:** ninguna nueva. Comportamiento: con `_stopping` activo, el despacho no reserva ni
abre nada y una apertura en curso deja de reintentar sin avisar de fallo.

- [ ] **Paso 1: puerta del despacho.** En `_async_dispatch_locked`, justo después del docstring y
  antes de `if await self._quiet_hold_locked():`, añadir:

```python
        # parada de HA o descarga de la entry: no se abre nada más (02-shutdown-close §5.3)
        if self._stopping:
            return
```

- [ ] **Paso 2: apertura en curso al parar.** En `_async_open_job`, sustituir la llamada:

```python
        ok = await async_set_valve(
            self.hass, job.entity_id, turn_on=True, cancelled=lambda: self._slots.is_cancelled(job.entity_id)
        )
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
```

  y, al final del método, sustituir:

```python
        # pausada mientras reintentaba: la pausa es del usuario, no es un fallo
        elif not ok and not cancelled:
```

  por:

```python
        # pausada mientras reintentaba, o HA parando: no es un fallo
        elif not ok and not cancelled and not self._stopping:
```

- [ ] **Paso 3: gates.**

```bash
uvx ruff check custom_components
py -3.14 -m compileall -q custom_components
```

  Esperado: `All checks passed!` y ninguna salida de `compileall`.

- [ ] **Paso 4: commit (controlador).**

```bash
git add custom_components/irrigation_scheduler/engine/manager.py
git commit -m "feat(engine): sin despacho ni reintentos de apertura con la integración parando"
```

---

### Tarea 2: `async_close_on_stop` y registro del shutdown job

**Ficheros:**
- Modificar: `custom_components/irrigation_scheduler/const.py:58-60` (tras `CLOSE_RETRY_OFFSETS_S`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py` (imports, método nuevo tras
  `async_shutdown`, `:145-160`)
- Modificar: `custom_components/irrigation_scheduler/__init__.py:12, 62-77`

**Interfaces:**
- Produce: `SHUTDOWN_CLOSE_TIMEOUT_S: int` y `SHUTDOWN_LOCK_TIMEOUT_S: int` en `const.py`.
- Produce: `IrrigationManager.async_close_on_stop(self) -> None` (coroutine).
- Consume: `async_set_valve(..., retries=0)` (`adapters/valves.py`), `ValveSlots.busy()` y
  `ValveSlots.closed()`, `CloseRetry.active()`, `async_shutdown()`.

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
  - En el bloque `from ..const import (...)`, añadir en orden alfabético `SHUTDOWN_CLOSE_TIMEOUT_S` y
    `SHUTDOWN_LOCK_TIMEOUT_S` (detrás de `SIGNAL_ZONE_ADDED`, delante de `ZONE_DELETE_BUSY`).

- [ ] **Paso 3: método.** En `engine/manager.py`, justo después de `async_shutdown` (antes de
  `_async_recover`):

```python
    async def async_close_on_stop(self) -> None:
        """Parada ordenada de HA, stage 1 (02-shutdown-close §5): cierra las switch de riego.

        Un intento por switch, en paralelo y con tope de tiempo. Sin avisos: solo log. La cola no
        se toca. Las gestionadas que cierran se dan por terminadas; las que fallan siguen en el
        runtime y las trata el arranque (03 §5.2).
        """
        # foto sin await en medio: no espera al lock, que el arranque puede tener cogido
        targets = sorted(
            {
                valve.entity_id
                for zone in self.config.zones.values()
                for valve in zone.valves
                if (state := self.hass.states.get(valve.entity_id)) is not None
                and state.state != STATE_OFF
            }
            | self._slots.busy()
            | self._close_retry.active()
        )
        # puerta cerrada: sin temporizadores, disparos, latido, reintentos ni despacho
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
            if task.done() and not task.cancelled() and task.exception() is None and task.result():
                closed.append(entity_id)
                _LOGGER.info("%s cerrada al parar HA", entity_id)
            else:
                task.cancel()
                _LOGGER.warning("%s no se ha podido cerrar al parar HA", entity_id)
        try:
            async with asyncio.timeout(SHUTDOWN_LOCK_TIMEOUT_S), self._lock:
                for entity_id in closed:
                    # riego terminado (02-shutdown-close §1); las fallidas siguen en open_valves
                    self._slots.closed(entity_id)
                await self._async_persist_locked()
        except TimeoutError:
            _LOGGER.warning("Sin lock al parar HA: el runtime no refleja los cierres")
```

  Notas para el implementador:
  - `self._slots.closed(entity_id)` es seguro para `switch` que no están en `open_valves` (encendidas
    a mano, abriéndose): solo hace `discard` y `pop(..., None)` (`engine/slots.py:90-93`).
  - `async with asyncio.timeout(...), self._lock:` es una sola sentencia `async with` con dos
    gestores. `engine/tests/test_lock.py` la reconoce porque mira los `items` de cada `AsyncWith`.
    Si ruff pide otra forma, anidar dos `async with` es equivalente.

- [ ] **Paso 4: registro del job.** En `__init__.py`:
  - `from homeassistant.core import HomeAssistant` → `from homeassistant.core import HassJob, HomeAssistant`
  - En `async_setup_entry`, justo después de `entry.runtime_data = manager`:

```python
    # parada ordenada de HA: cierra las válvulas en stage 1, con Zigbee aún vivo
    # (02-shutdown-close §5.1); la entry no se descarga al parar, así que no vale async_unload_entry
    entry.async_on_unload(hass.async_add_shutdown_job(HassJob(manager.async_close_on_stop)))
```

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
  tiene abiertas, abriéndose o cerrándose;
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
  - `README.md` del cambio, fila 2: `En diseño` → `Implementado`.

- [ ] **Paso 3: revisar las citas `archivo:línea`** de `02-shutdown-close/spec.md` (§2.4, §3) contra
  el código ya cambiado. Corregir las que se hayan movido.

- [ ] **Paso 4: commit (controlador).**

```bash
git add docs/features/valves-execution/spec.md docs/features/06-10-2026-ha-restart-fallbacks
git commit -m "docs(valves): cierre de válvulas al parar HA en las specs vivas"
```

---

## Validación funcional (usuario, en su HA)

Fuera del plan de agentes.

1. Con una válvula regando, reiniciar HA desde la interfaz. Esperado: la válvula se cierra antes de
   que HA pare; en el log, `... cerrada al parar HA`. Al volver, no salta `turn_off_failed` ni
   `overrun_restart` para ella y no figura como abierta.
2. Con una `switch` configurada encendida a mano, reiniciar HA. Esperado: se cierra igual.
3. Con trabajos en cola, reiniciar. Esperado: al volver, la cola sigue y se despacha.
