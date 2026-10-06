# Tarea 5: informe

Estado: DONE. Sin commit, sin push, sin stash. Sin tests.

## Cambios

`docs/features/valves-execution/spec.md` (secciones localizadas por encabezado: §5.1 en :68, §5.1.1 en :86, §5.2 en :99 antes de editar):
- §5.1: punto nuevo de las válvulas interrumpidas tras el de las abiertas, con el texto del brief.
- §5.1.1: el punto «da su riego por terminado» sustituido por el texto de «interrumpida»; añadida al final la línea «Detalle de la interrupción: ...».
- §5.2: punto 0 antes del 1, sin renumerar.

`docs/features/06-10-2026-ha-restart-fallbacks/03-remaining-time/spec.md`:
- Estado: «en implementación» pasa a «implementado» (se mantiene la fecha).
- Citas corregidas (ver abajo).

`docs/features/06-10-2026-ha-restart-fallbacks/README.md`: fila 3 «En diseño» pasa a «Implementado».

## Citas comprobadas (paso 5)

| Cita original | Resultado | Cita nueva |
|---|---|---|
| `domain/runtime.py:28-54` | `OpenValve` empieza en :29 (decorador); :28 es línea en blanco. `started_at`/`ends_at` en :33-34, `from_dict` termina en :54. | `domain/runtime.py:29-54` |
| `engine/slots.py:14-28` | `MUTATORS` ahora ocupa :14-31 (se añadieron `interrupt`, `interrupt_job`, `drop_interrupted`). La regla del lock está en el docstring :1-5. | `engine/slots.py:14-31` |
| `frontend/src/shared/valve-status.ts:58-63` | Apuntaba a `LABELS`/`valveLive`. El cálculo del fin de la válvula manual (`endsAt = since + duration_min`) está en :75-80. | `frontend/src/shared/valve-status.ts:75-80` |

La cita `engine/tests/test_lock.py` no lleva número de línea y no se tocó.

## Dudas

- El punto 0 de §5.2 cita `03-remaining-time` §3 («Decisiones del brainstorming», :29 de la spec 03), como pide el brief. No he verificado que ese apartado diga explícitamente «no se retoman».
- Las rutas de `domain/` y `engine/` en la spec 03 son relativas a `custom_components/irrigation_scheduler/`, como antes.
