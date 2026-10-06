# Tarea 5: informe

Status: DONE. Sin commit. Los ficheros mantienen sus saltos de línea CRLF.

## Cambios por fichero

- `docs/features/valves-execution/spec.md`
  - Cabecera: «Última actualización» 2026-10-03 → 2026-10-06.
  - §6: viñeta de apagado ampliada con el texto del brief (líneas 133-136).
  - §7.2: dos filas nuevas tras la de «apagar» (la de `turn_off_failed` y la de cierre recuperado).
- `docs/features/alerts/spec.md`
  - Cabecera: «Última actualización» 2026-09-29 → 2026-10-06. «Estado» sin tocar.
  - §0.4: frase añadida al final del párrafo (reintentos en segundo plano, ver §2).
  - §2: bloque «**Reintentos en segundo plano.**» tras «**Cuándo salta.**», con línea en blanco antes y después.
  - §2: citas corregidas (tabla siguiente).
- `docs/features/alerts/README.md:46`: frase añadida en la columna Resumen de `turn_off_failed`.
- `01-close-retry/spec.md`: Estado «diseño aprobado» → «implementado».
- `06-10-2026-ha-restart-fallbacks/README.md`: fila 1 «Diseño aprobado» → «Implementado».

## Citas archivo:línea (antes → después)

§6 de `valves-execution/spec.md`: no tiene ninguna cita `archivo:línea`, solo enlaces a specs. Sin cambios.

`alerts/spec.md` §0.4:

| Antes | Después | Comprobado en |
|---|---|---|
| `valves.py:17-34` | `valves.py:18-49` | `async_set_valve` ocupa 18-49 |
| `const.py:54` (VERIFY_DELAY_S) | `const.py:56` | `VERIFY_DELAY_S = 2` en const.py:56 |
| `const.py:53` (SWITCH_RETRIES) | `const.py:55` | `SWITCH_RETRIES = 3` en const.py:55 |
| `valves.py:27` (warning) | `valves.py:38` | `_LOGGER.warning(...)` en valves.py:38 |

`alerts/spec.md` §2, tabla de cabecera y texto:

| Antes | Después | Comprobado en |
|---|---|---|
| `const.py:78` (bus `valve_error`) | `const.py:87` | `EVENT_VALVE_ERROR` en const.py:87 |
| `notify.py:32-34` | `notify.py:42-44` | `turn_off_failed` en notify.py:42-44 |
| `manager.py:720-749` (`_async_close_due` → `_async_finish_close`) | `manager.py:610-615`, `626-638` | las dos funciones |
| `manager.py:1065-1098` (`_async_pause`) | `manager.py:864-893` | def y `gather` |
| `manager.py:910-935` (`async_delete_zone`, tabla) | `manager.py:744-765` | def hasta `_triggers.untrack_zone` |
| `manager.py:695-696` (`_async_open_job` → finish_close) | `manager.py:593-594` | `if ok and cancelled and closing` |
| `manager.py:250-253` (latido) | `manager.py:236-239` | `asyncio.gather(...)` |
| `manager.py:764-772` (`_async_close_manual`) | `manager.py:676-684` | def |
| `manager.py:184`, `196-197` (`_async_recover`) | `manager.py:170`, `179-180` | `async_set_valve` y `if not ok` |
| `_async_valve_error(..., False)` (`manager.py:774-789`) | `_async_close_failed` (`manager.py:640-649`) → `Incidents.valve_error(..., False)` (`manager.py:647`, `engine/incidents.py:116-131`) | `_async_valve_error` ya no existe: la lógica está en `Incidents.valve_error` |
| `manager.py:742-748` (libera hueco) | `manager.py:630-637` | `_slots.closed` + persist + dispatch |
| `manager.py:910-935` (Borrado de zona) | `manager.py:744-765` | `async_delete_zone` |
| `manager.py:914` (`_async_pause`) | `manager.py:748` | llamada a `_async_pause` |
| `manager.py:915-917`, `const.py:76` | `manager.py:749-751`, `const.py:85` | `ZONE_DELETE_VALVES_ON` en const.py:85 |
| `manager.py:918-923`, `const.py:75` | `manager.py:752-757`, `const.py:84` | `ZONE_DELETE_BUSY` en const.py:84 |
| `manager.py:927` (borra zona) | `manager.py:761` | `del self.config.zones[zone_id]` |
| `websocket.py:146-154` | `api/websocket.py:102-110` | `ws_delete_zone`; el fichero está en `api/` |
| `websocket.py:110-113` | `api/websocket.py:65-67` | `except ZoneDeleteError` → `send_error` |

No toqué las citas de §1 (p. ej. `const.py:78` de `turn_on_failed`), por el alcance indicado. Siguen desfasadas.

## Textos del brief contrastados con el código

- Secuencia `CLOSE_RETRY_OFFSETS_S` = (10, 20, 30, 90, ..., 450): const.py:60.
- Intento extra en `unavailable`/`unknown` → `on`: `close_retry.py:107-114`.
- `action: "turn_off_gave_up"`: `incidents.py:147`.
- Solo push, prioridad normal, severidad Info, destinos de `turn_off_failed`: `incidents.py:153-167`.
- Textos de gave_up y recovered: `notify.py:45-51`.
- Switch excluida de «encendida a mano»: `manager.py:656`.
- Se cancela al reabrir: `manager.py:578`.
- `cancel_all` al descargar o parar HA: `close_retry.py:72-76`.

## Gates

- `uvx ruff check custom_components` → `All checks passed!` (código 0)
- `py -3.14 -m compileall -q custom_components` → sin salida, código 0
- pytest no ejecutado, por indicación.

## Dudas

Ninguna.
