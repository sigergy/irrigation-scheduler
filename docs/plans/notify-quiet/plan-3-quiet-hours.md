# Plan 3 · Horario silencioso

> Spec: [`docs/quiet-hours/spec.md`](../../quiet-hours/spec.md), parte **B**.
> Requiere: plan 1 cerrado. Independiente del plan 2. Progreso: [`PROGRESO.md`](PROGRESO.md).
> Rutas de backend relativas a `custom_components/irrigation_scheduler/`; de panel, a `frontend/src/`.

**Objetivo.** Franja horaria sin bloques de riego; lo que caiga dentro se aplaza a su fin y
consulta la lluvia antes de regar.

---

## Tarea 3.1 · Modelo y cálculo de conflictos

Spec §B.1 y §B.2.

1. `domain/model.py`: `Settings.quiet_start`, `quiet_end` (`str | None`).
2. `domain/runtime.py`: `RuntimeState.held_until: datetime | None`; `to_dict` / `from_dict`
   con defecto `None` (patrón de `last_alive`, líneas 158 y 170-178).
3. `domain/schedule.py`, funciones puras:
   - `in_quiet_hours(settings, local_time) -> bool`: `[inicio, fin)`, cruce de medianoche.
   - `quiet_end_after(settings, local_now) -> datetime`: próximo fin de franja.
   - `block_span_min(zone, index) -> int`: duración simulada del bloque con todas sus válvulas
     (también desactivadas) y `max_simultaneous`, vía `RuntimeState().enqueue` +
     `estimate_batch_ends` (`domain/runtime.py:194-233`), sin límite global.
   - `block_hits_quiet(settings, zone, index) -> bool`: solape en minutos módulo 1440 con
     desplazamientos −1440, 0, +1440; tocar extremos no es conflicto.

**Criterio.** Sin franja (`None`), todas devuelven «sin conflicto» / «fuera de franja».

## Tarea 3.2 · Validación y API

Spec §B.3.

1. `domain/validation.py`: V15 en `validate_zone`; V16 y V17 en `validate_settings`, que pasa a
   recibir `config`. Actualizar la llamada en `engine/manager.py:640`.
2. V17 recorre las zonas **con la franja nueva** (la de `settings`, no la guardada).
3. `api/schemas.py`: `quiet_start`, `quiet_end` en `SETTINGS_SCHEMA`.

## Tarea 3.3 · Puerta en el despacho y aplazamiento

Spec §B.4.

1. `engine/manager.py` `_async_dispatch_locked` (418-436): si `in_quiet_hours`, no arranca nada;
   si hay cola y `held_until` es `None`, lo fija con `quiet_end_after`, persiste y programa el
   temporizador.
2. Temporizador único (`async_track_point_in_time`) guardado como unsub; se cancela en
   `async_shutdown` (135-147).
3. `_async_quiet_end()` (al dispararse):
   1. lote = zonas con trabajos `ORIGIN_SCHEDULED` en cola y `_needs_rain`;
      refs `(zone_id, quiet_end, hoy)`;
   2. `await self._async_evaluate_lot(refs)` (364-402);
   3. con el lock: `rain_decisions.pop(ref)`; si `skip`, quitar de `pending` los trabajos
      programados de esa zona con `self._slots.drop_pending(keep)` (`engine/slots.py:115`);
      no tocar `pending` desde el manager;
   4. `held_until = None`, persistir, `_async_dispatch_locked()`.
4. `_async_recover` (149-195): con `held_until` pasado → `_async_quiet_end` en segundo plano
   (`_spawn`); con `held_until` futuro → reprogramar temporizador.
5. `async_save_settings` (636-658): recalcular el temporizador; franja desactivada o movida con
   `held_until` ya pasado → `_async_quiet_end`.
6. `api/snapshot.py`: `held_until` en la raíz; con él, `batch_ends_at = None`.

**Criterio.** Una válvula abierta al empezar la franja termina. Un `run_zone` dentro de la
franja queda en cola y riega al fin sin mirar la lluvia.

## Tarea 3.4 · Panel

Spec §B.5.

1. `api.ts`: `Settings.quiet_start/end`, `held_until` en el snapshot.
2. `panel/settings-view.ts`: tarjeta «Horario silencioso» (mockup), errores V16 por campo y V17
   como lista «Choca con: Zona HH:MM» desde las rutas `("quiet_hours", zone_id, hora)`.
3. `panel/zone-editor.ts`: aviso de la franja bajo las horas; V15 en el chip (ya llega por
   `issueMap` con ruta `start_times.i`).
4. `shared/zone-status.ts` (61-62): con `held_until`, «Aplazado hasta HH:MM».
5. Riego manual dentro de la franja: toast «Se regará a las HH:MM (horario silencioso)» donde
   se llama a `runZone` / `runValve` (`api.ts:243-247`).
6. `i18n.ts`: `quiet*`, `rule_V15`, `rule_V16`, `rule_V17`, es/en.

## Tarea 3.5 · Gates y commits

1. `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
2. `npm run lint` y `npm run build` en `frontend/`.
3. Commits: `feat: horario silencioso en validación y ejecución` (3.1-3.3) y
   `feat: panel del horario silencioso` (3.4).
