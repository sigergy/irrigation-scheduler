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

