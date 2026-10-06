# Informe de migración de `.superpowers/sdd/` a `plans/`

Fecha: 2026-10-06. Rama: `sigergy/ha-restart-fallbacks-impl`, HEAD `146f3e7`.

Los 17 ficheros de las specs 01, 02 y 03 estaban en `.superpowers/sdd/` (git-ignorado). Se contrastaron con el historial y se movieron con `mv` a `docs/features/06-10-2026-ha-restart-fallbacks/plans/<carpeta>/`. No se borró nada, no se editó ningún fichero y no se hizo commit.

Comprobaciones hechas para cada sha: `git cat-file -e <sha>`, `git merge-base --is-ancestor <sha> HEAD` y `git show --stat <sha>` frente a la sección de ficheros del `task-N-report.md`. Los 14 shas existen y son ancestros de HEAD.

## 01-close-retry (movida)

El `progress.md` no da un sha por tarea sino rangos `<base>..<sha>`. El sha de cada tarea es el extremo final del rango. Base `3d8a977` es el commit del plan (docs).

| Tarea | Sha | En rama | Ficheros del commit coinciden con el informe | Spec implementada |
|---|---|---|---|---|
| 1 | da6b99c | sí | sí (`adapters/valves.py`, `const.py`) | sí |
| 2 | 83ee4d9 | sí | sí (`adapters/notify.py`, `engine/incidents.py`) | sí |
| 3 | e73441d | sí | sí (`engine/close_retry.py`, nuevo, 169 líneas) | sí |
| 4 | b13fd9b | sí | sí (`engine/manager.py`, +26 −5; el stat total es 31 líneas) | sí |
| 5 | e9241c8 | sí | sí (`valves-execution/spec.md`, `alerts/spec.md`, `alerts/README.md`, `01-close-retry/spec.md`, `README.md` del cambio) | sí |

Spec: `01-close-retry/spec.md:3` dice «Estado: **implementado**». README del cambio, fila 1: «Implementado».

## 02-shutdown-close (movida)

| Tarea | Sha | En rama | Ficheros del commit coinciden con el informe | Spec implementada |
|---|---|---|---|---|
| 1 | f816f12 | sí | sí (`engine/manager.py`) | sí |
| 2 | 02257d6 | sí | sí (`__init__.py`, `const.py`, `engine/manager.py`) | sí |
| 3 | 3ee0913 | sí | sí (`valves-execution/spec.md`, `02-shutdown-close/spec.md`, `README.md` del cambio) | sí |

Spec: `02-shutdown-close/spec.md:3` dice «Estado: **implementado**». README del cambio, fila 2: «Implementado».

## 03-remaining-time (movida)

| Tarea | Sha | En rama | Ficheros del commit coinciden con el informe | Spec implementada |
|---|---|---|---|---|
| 1 | 7da6b60 | sí | sí (`domain/runtime.py`, `engine/slots.py`) | sí |
| 2 | b6d86be | sí | sí (`engine/manager.py`) | sí |
| 3 | 532bf4b | sí | sí (`sensor.py`, `adapters/registry.py`, `strings.json`, `translations/en.json`, `translations/es.json`) | sí |
| 4 | 10a91ee | sí | sí (`api/snapshot.py`, `frontend/src/api.ts`, `frontend/src/i18n.ts`, `frontend/src/shared/valve-status.ts`) | sí |
| 5 | 253bfff | sí | sí (`valves-execution/spec.md`, `03-remaining-time/spec.md`, `README.md` del cambio) | sí |

Spec: `03-remaining-time/spec.md:3` dice «Estado: **implementado**». README del cambio, fila 3: «Implementado».

## Qué se movió y adónde

| Origen | Destino |
|---|---|
| `.superpowers/sdd/01-close-retry/` (6 ficheros) | `docs/features/06-10-2026-ha-restart-fallbacks/plans/01-close-retry/` |
| `.superpowers/sdd/02-shutdown-close/` (4 ficheros) | `docs/features/06-10-2026-ha-restart-fallbacks/plans/02-shutdown-close/` |
| `.superpowers/sdd/03-remaining-time/` (6 ficheros) | `docs/features/06-10-2026-ha-restart-fallbacks/plans/03-remaining-time/` |

Los destinos no existían antes. Los nombres de fichero no cambian.

## Qué no se movió

`.superpowers/sdd/.gitignore` queda donde estaba. Es el único fichero que queda en `.superpowers/`.

## Anotaciones (sin tocar)

- Los tres `progress.md` citan la ruta del plan en la cabecera: `docs/features/06-10-2026-ha-restart-fallbacks/plans/0N-<nombre>.md`. La ruta sigue siendo válida (los planes no se movieron).
- `01-close-retry/task-3-report.md` cita su propia ruta antigua: `.superpowers/sdd/01-close-retry/task-3-report.md`. Ya no existe esa ruta.
- Los informes de 01 (tarea 3) y de 03 (tareas 2, 4, 5) mencionan `task-N-brief.md`. Esos briefs no estaban en `.superpowers/` (solo existen los de la spec 04). No faltan por error de movimiento.
- Las carpetas 01, 02 y 03 no tienen `task-N-brief.md`, a diferencia de la 04. No es una discrepancia con el historial.
- Los `progress.md` de 02 y 03 no usan rangos ni «review inline clean» de forma uniforme: 01 usa rangos `base..sha`; 02 y 03 usan el sha suelto. Distinto formato, sin impacto.
- Dudas pendientes que los propios informes dejan abiertas, no relacionadas con la migración:
  - `01-close-retry/progress.md` (Task 5, minor, deferred): citas de §1 de `alerts/spec.md` y de `01-close-retry/spec.md` §5 siguen desfasadas.
  - `02-shutdown-close/task-3-report.md`: el README del cambio cita código anterior al cambio (`engine/manager.py:162-176`) en «Causa, según el código».
  - `03-remaining-time/task-5-report.md`: no se verificó que §3 de la spec 03 diga explícitamente «no se retoman».

## Nombres

Todos los ficheros y carpetas siguen kebab-case y están en inglés. No hay renombrados pendientes.
