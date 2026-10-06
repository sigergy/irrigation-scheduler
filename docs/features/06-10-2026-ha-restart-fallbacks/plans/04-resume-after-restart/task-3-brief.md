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

