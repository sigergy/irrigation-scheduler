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

