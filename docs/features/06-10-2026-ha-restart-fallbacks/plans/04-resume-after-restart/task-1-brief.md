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

