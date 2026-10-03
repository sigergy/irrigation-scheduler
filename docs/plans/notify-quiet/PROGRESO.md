# Progreso · Avisos sin espera, voz Cast y horario silencioso

**Siguiente pendiente: ninguna. Falta la prueba en HA (tareas en 🟨).**

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
| 1.1 | Adaptador: `Notice`, `compose_notice`, `Notifier` | 🟨 |
| 1.2 | `Incidents` usa el `Notifier` | 🟨 |
| 1.3 | Gates y commit del plan 1 | 🟨 |
| 2.1 | Modelo, destinos y validación de voz | 🟨 |
| 2.2 | `adapters/speak.py`, canal en el `Notifier`, WS `test_speak` | 🟨 |
| 2.3 | Panel: tarjeta «Notificaciones» | 🟨 |
| 2.4 | Panel: columna «Voz» en «Errores y avisos» | 🟨 |
| 2.5 | Gates y commits del plan 2 | 🟨 |
| 3.1 | Modelo y cálculo de conflictos | 🟨 |
| 3.2 | Validación V15–V17 y API | 🟨 |
| 3.3 | Puerta en el despacho y aplazamiento | 🟨 |
| 3.4 | Panel del horario silencioso | 🟨 |
| 3.5 | Gates y commits del plan 3 | 🟨 |

Estados: ⬜ pendiente · 🟨 hecho, falta prueba en HA · ✅ cerrado · ⛔ bloqueado.

## Comandos

- Backend: `uvx ruff check custom_components` · `py -3.14 -m compileall -q custom_components`
- Panel (en `frontend/`): `npm run lint` · `npm run build`
- Tests: los ejecuta CI (`.github/workflows/tests.yml`). Las features no llevan tests nuevos.
- Prueba funcional: el usuario, en su HA. No se levanta servidor ni navegador aquí.

## Commits

`tipo: descripción` en español (`feat:`, `fix:`, `docs:`, `chore:`), con las líneas
`Co-Authored-By` y `Claude-Session`. Un commit por cambio coherente.

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
- Confirmado por el usuario (2026-10-03): el riego manual aplazado no mira la lluvia; la lluvia
  al fin de la franja se decide con la misma regla que el sensor, en ese momento; la voz suena
  a cualquier hora; el volumen no se restaura tras hablar.

## Bloqueos

Ninguno.

## Registro

_(entradas nuevas arriba)_

### 2026-10-03 · Plan 3 (3.1–3.5) · 🟨 falta prueba en HA

- `803b7be` backend: `Settings.quiet_start/quiet_end`, `RuntimeState.held_until`; en
  `domain/schedule.py` `quiet_active`, `in_quiet_hours`, `quiet_end_after`, `block_span_min`,
  `block_hits_quiet`; V15 en `validate_zone`, V16/V17 en `validate_settings(settings, config)`;
  puerta `_quiet_hold_locked` en `_async_dispatch_locked`, temporizador único, `_async_quiet_end`,
  recuperación al arrancar y recálculo al guardar ajustes; `held_until` en el snapshot.
- `ea7ceca` panel: tarjeta «Horario silencioso», lista V17 desde las issues crudas, nota en el
  editor de zona, «Aplazado hasta HH:MM», toast del riego manual (`shared/quiet-hours.ts`).
- Divergencias:
  - La puerta sigue cerrada mientras haya `held_until`, también fuera de la franja, hasta que
    `_async_quiet_end` decide la lluvia. Si no, lo retenido arrancaría antes de decidir.
  - Zonas con un bloque propio a la hora de fin: la decisión se lee con `get`, no con `pop`,
    para no quitársela a `_async_block_fired`.
  - La hora del lote sale de `held_until`, no de `settings.quiet_end` (sirve si la franja cambió).
  - Al guardar ajustes con cola retenida: dentro de la franja nueva se mueve `held_until`; si no,
    se libera ya.
- Tests: 0 nuevos. Gates: ruff «All checks passed!», compileall 0, `npm run lint` 0, `npm run build` OK.

### 2026-10-03 · Plan 2 (2.1–2.5) · 🟨 falta prueba en HA

- `76a7dfd` backend: modelo y validación (V18), `adapters/speak.py`, canal de voz en el
  `Notifier`, WS `test_speak`.
- `16a4788` panel: grupos «Móviles · push» y «Altavoces y pantallas · voz», motor TTS, volumen,
  «Probar» por altavoz; columna «Voz» y chips de altavoces en «Errores y avisos».
- Divergencia: el volumen es un interruptor «Fijar el volumen» más un deslizador 0–100 %, en vez
  del desplegable del mockup. Apagado = no se toca el volumen.
- Tests: 0 nuevos. Gates: ruff, compileall, lint y build en verde.

### 2026-10-03 · Plan 1 (1.1–1.3) · 🟨 falta prueba en HA

- `adapters/notify.py`: `async_push` sustituido por `Notice` (aviso compuesto), `compose_notice`
  (hora fijada al emitir) y `Notifier` (`send` síncrono → tarea de fondo `irrigation_notify`;
  `gather` de canales con `return_exceptions=True`; push en paralelo por destino con
  `asyncio.Lock` por destino y `PUSH_TIMEOUT_S = 30`).
- `engine/incidents.py`: `alert`, `push_switched` y `push_rain_skipped` usan
  `self._notifier.send(compose_notice(...))`. Siguen siendo `async`; `engine/manager.py` sin
  cambios.
- Divergencias: ninguna. Tests: 0 nuevos (features sin tests). pytest no está instalado en
  local: los tests existentes los ejecuta CI.
- Gates: `uvx ruff check custom_components` → «All checks passed!»;
  `py -3.14 -m compileall -q custom_components` → código 0.
