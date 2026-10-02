# Progreso · Avisos sin espera, voz Cast y horario silencioso

**Siguiente pendiente: 1.1 · Adaptador: aviso compuesto y envío en segundo plano**

Rama: `feat/cast-notifies`. Orden obligatorio: plan 1 → plan 2 → plan 3.

## Documentos

| Doc | Qué es |
|---|---|
| [`docs/quiet-hours/spec.md`](../../quiet-hours/spec.md) | Spec: parte A (envío sin espera) y B (horario silencioso). |
| [`docs/alerts/cast-notifies/spec.md`](../../alerts/cast-notifies/spec.md) | Spec: canal de voz. |
| [`docs/alerts/cast-notifies/mockup.html`](../../alerts/cast-notifies/mockup.html) | Mockup del panel. |
| [`plan-1-async-send.md`](plan-1-async-send.md) | Plan 1 → spec quiet-hours §A. |
| [`plan-2-voice.md`](plan-2-voice.md) | Plan 2 → spec cast-notifies. |
| [`plan-3-quiet-hours.md`](plan-3-quiet-hours.md) | Plan 3 → spec quiet-hours §B. |

La spec manda sobre el plan. Si chocan, parar y preguntar.

## Dependencias

- Plan 2 necesita `Notice` / `Notifier` del plan 1.
- Plan 3 necesita el plan 1 (los avisos de lluvia al fin de la franja no deben bloquear el
  despacho). No depende del plan 2.

## Tareas

| ID | Tarea | Estado |
|---|---|---|
| 1.1 | Adaptador: `Notice`, `compose_notice`, `Notifier` | ⬜ |
| 1.2 | `Incidents` usa el `Notifier` | ⬜ |
| 1.3 | Gates y commit del plan 1 | ⬜ |
| 2.1 | Modelo, destinos y validación de voz | ⬜ |
| 2.2 | `adapters/speak.py`, canal en el `Notifier`, WS `test_speak` | ⬜ |
| 2.3 | Panel: tarjeta «Notificaciones» | ⬜ |
| 2.4 | Panel: columna «Voz» en «Errores y avisos» | ⬜ |
| 2.5 | Gates y commits del plan 2 | ⬜ |
| 3.1 | Modelo y cálculo de conflictos | ⬜ |
| 3.2 | Validación V15–V17 y API | ⬜ |
| 3.3 | Puerta en el despacho y aplazamiento | ⬜ |
| 3.4 | Panel del horario silencioso | ⬜ |
| 3.5 | Gates y commits del plan 3 | ⬜ |

Estados: ⬜ pendiente · 🟨 hecho, falta prueba en HA · ✅ cerrado · ⛔ bloqueado.

## Comandos

- Backend: `uvx ruff check custom_components` · `py -3.14 -m compileall -q custom_components`
- Panel (en `frontend/`): `npm run lint` · `npm run build`
- Tests: los ejecuta CI (`.github/workflows/tests.yml`). Las features no llevan tests nuevos.
- Prueba funcional: el usuario, en su HA. No se levanta servidor ni navegador aquí.

## Commits

`tipo: descripción` en español (`feat:`, `fix:`, `docs:`, `chore:`), con las líneas
`Co-Authored-By` y `Claude-Session`. Un commit por cambio coherente. Sin push.

## Invariantes

- El motor nunca espera a un canal de aviso.
- Las válvulas abiertas no se cierran por el horario silencioso.
- El riego manual no se omite por lluvia (`docs/specs/05-rain-skip.md:65-66`).
- Sin migraciones: todo campo nuevo tiene defecto que conserva el comportamiento actual.

## Decisiones tomadas

- Validación del horario: el bloque choca si su duración simulada (con `max_simultaneous`)
  solapa la franja (opción B).
- Lo que cae dentro se aplaza al fin de la franja, también el riego manual.
- Al fin de la franja, la lluvia se decide con `_async_evaluate_lot`, no leyendo
  `zone_rain_outlook` (spec quiet-hours §B.4).
- El horario silencioso no silencia avisos.

## Bloqueos

Ninguno.

## Registro

_(entradas nuevas arriba)_
