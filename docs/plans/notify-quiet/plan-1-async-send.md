# Plan 1 · Envío de avisos sin espera

> Spec: [`docs/quiet-hours/spec.md`](../../quiet-hours/spec.md), parte **A**.
> Progreso: [`PROGRESO.md`](PROGRESO.md). Rutas relativas a `custom_components/irrigation_scheduler/`.
> La spec manda: si este plan y la spec chocan, se corrige el plan.

**Objetivo.** El motor nunca espera a una notificación. El aviso se compone al instante y sale
en segundo plano; los canales van en paralelo (por ahora solo push).

**Fuera de alcance.** Canal de voz (plan 2). Cambios de textos o prioridades.

---

## Tarea 1.1 · Adaptador: aviso compuesto y envío en segundo plano

Spec §A.2 puntos 1, 4, 5 y 6.

**Fichero:** `adapters/notify.py`.

1. `Notice` (dataclass congelada): `title`, `message`, `push_targets: list[str]`,
   `push_data: dict`. Lo que necesita cada canal, ya resuelto.
2. `compose_notice(hass, alert_id, priority, push_targets, *, kind=None, **fields) -> Notice`.
   Saca el cuerpo de `async_push` (`adapters/notify.py:113-133`): título por severidad, texto con
   `{time}` = `dt_util.now()` **en este momento** y `PUSH_DATA[priority]`.
3. `Notifier(hass)`:
   - `send(notice)`: si no hay ningún destino, no hace nada. Si hay, lanza
     `hass.async_create_background_task(self._async_deliver(notice), "irrigation_notify")` y
     guarda la tarea en un `set` hasta que termine (patrón de `engine/manager.py:104-108`).
     Es síncrono: quien llama no espera.
   - `_async_deliver`: `asyncio.gather(*canales, return_exceptions=True)`. Hoy un canal:
     `_async_push`. Excepciones devueltas al log.
   - `_async_push`: un `_async_push_one` por destino, en paralelo (`gather`).
   - `_async_push_one(target, notice)`: toma `self._locks.setdefault(target, asyncio.Lock())`;
     dentro, `asyncio.timeout(PUSH_TIMEOUT_S)` + `hass.services.async_call(..., blocking=True)`.
     `HomeAssistantError` y `TimeoutError` al log con el mismo formato que hoy
     (`adapters/notify.py:139-140`).
   - Constante de módulo `PUSH_TIMEOUT_S = 30`.
4. Borrar `async_push` cuando la tarea 1.2 deje de usarla (único uso: `engine/incidents.py`).

**Criterio de aceptación.** `Notifier.send` no es corrutina. Ningún `await` de servicio fuera de
la tarea de fondo. Los textos de `MESSAGES` no cambian.

## Tarea 1.2 · Incidents usa el Notifier

Spec §A.1 y §A.2 puntos 2 y 3.

**Ficheros:** `engine/incidents.py`.

1. `Incidents.__init__` crea `self._notifier = Notifier(hass)`.
2. `alert()` (`engine/incidents.py:43-79`): misma composición de `zone` y `entity`; en lugar de
   `await async_push(...)`, `self._notifier.send(compose_notice(...))`. La entidad `event` y el
   bus siguen igual y antes (líneas 59-60).
3. `push_switched()` (98-125) y `push_rain_skipped()` (127-144): igual.
4. Los métodos siguen siendo `async`: los llamadores del manager no cambian. Ya no esperan red.

**Criterio de aceptación.** `grep -n "async_push" custom_components` sin resultados.
`engine/manager.py` sin cambios.

## Tarea 1.3 · Gates y commit

1. `uvx ruff check custom_components`
2. `py -3.14 -m compileall -q custom_components`
3. CI: los tests de `engine/tests/` ya esperan tareas de fondo
   (`engine/tests/conftest.py:71`). Si alguno comprobaba el push de forma síncrona, se ajusta
   el test (no el código) y se anota en PROGRESO.
4. Commit: `feat: avisos en segundo plano sin bloquear el motor`.
