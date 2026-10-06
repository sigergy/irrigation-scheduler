# Informe tarea 5: documentación viva y estado

Estado: DONE_WITH_CONCERNS. Sin commit. No se ha tocado código.

## Cambios por fichero

- `docs/features/valves-execution/spec.md` §5.2 punto 0: texto del brief, tal cual.
- `docs/features/alerts/README.md`: fila `restart_not_resumed` tras `valve_switched`.
- `docs/features/alerts/spec.md`:
  - fila `info` de la tabla de cabeceras: `rain_skipped`, `valve_switched` y `restart_not_resumed` (sin marca).
  - sección nueva `## 11. restart_not_resumed` antes de `## Pendiente`. La última sección numerada previa era la 10 (`no_water`): comprobado.
  - `<línea>` sustituidas por las reales (tabla abajo).
- `.../04-resume-after-restart/spec.md`: estado `implementado`, línea `Plan:` bajo «Depende de» y citas corregidas.
- `.../03-remaining-time/spec.md` §4.3: añadido «Sustituido por [04-resume-after-restart](../04-resume-after-restart/spec.md) §4.1.» al punto «Al arrancar».
- `.../README.md`: «Estado: **implementado**» y fila 4 «Implementado».

## Citas nuevas (alerts/spec.md §11)

| Cita | Línea verificada |
|---|---|
| `notify.py:63-65` (texto ES) | `"restart_not_resumed": (` en `adapters/notify.py:63-65` |
| `notify.py:103-105` (texto EN) | `adapters/notify.py:103-105` |
| `manager.py:611-627` | `_not_resumed_locked`, `engine/manager.py:611-627` |
| `incidents.py:190-196` | `push_not_resumed`, `engine/incidents.py:190-196` |

## Citas de la spec 04: antes → después

| Antes | Después | Qué describe |
|---|---|---|
| `engine/manager.py:239` | `engine/manager.py:241` | `_async_recover` (def en :241) |
| `engine/manager.py:598` | `engine/manager.py:725` | `_async_quiet_end` (def en :725) |
| `engine/manager.py:984-993` | `engine/manager.py:1084-1094` | `_async_pause`, de la def al `_discard_interrupted_locked(match)` |
| `engine/manager.py:918-936` | `engine/manager.py:1044-1082` | `async_run_zone` (:1044) y `async_run_valve` (:1065) |
| `engine/slots.py:14-31` | `engine/slots.py:14-32` | `MUTATORS`, cierra en :32 |
| `frontend/src/shared/valve-status.ts:119-121` | `...:121-123` | `case "interrupted"` con la acción Pausar |
| `domain/runtime.py:127-133` (§4.4, límite de zona y global) | `domain/runtime.py:150-182` | `startable_jobs`, donde viven los límites |
| `domain/alerts.py:48` | sin cambio | `valve_switched` sigue en :48 |
| `frontend/src/alerts.ts:34` | sin cambio | `valve_switched` sigue en :34 |
| `domain/schedule.py:15-23` | sin cambio | `valves_for_block` y `block_runs` |
| `domain/schedule.py:65` | sin cambio | `missed_blocks` |
| `domain/runtime.py:127-133` (§6, cola sin duplicados) | sin cambio | `enqueue`, :127-133 |
| `engine/close_retry.py:41` | sin cambio | `class CloseRetry` |

## Dudas

1. `domain/runtime.py:127-133` en §4.4 apuntaba a `enqueue`, que no aplica límites. La frase habla de límites de zona y global. Corregí solo la cita a `startable_jobs` (:150-182). `runtime.py` no se movió: la cita era imprecisa desde el principio. La frase no se tocó.
2. `docs/features/alerts/spec.md:70` cita `MESSAGES` como `notify.py:24-86`. Hoy `MESSAGES` ocupa `adapters/notify.py:34-121` (es :35-81, en :82-120). Está fuera del alcance del brief y no lo toqué. Conviene actualizarlo aparte.
3. El brief citaba `docs/features/06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md`, que existe. El plan enlazado (`../plans/04-resume-after-restart.md`) también existe.

## Gates

- `uvx ruff check custom_components`: All checks passed (exit 0).
- `py -3.14 -m compileall -q custom_components`: exit 0.
