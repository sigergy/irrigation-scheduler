# Tarea 4: informe del implementador

Estado: DONE. Sin commit, sin tests nuevos. Ficheros tocados: `engine/manager.py`, `engine/slots.py`.

## Cambios por paso

1. Imports (`manager.py`): `RESUME_WINDOW` tras `RAIN_STARTUP_RETRY_S`; `InterruptedValve` en el import de `domain.runtime`; `valve_block_between` tras `quiet_end_after`; `from .resume import ResumeWatch` entre `.rain_control` y `.slots`.
2. `__init__`: `self._resume_watch = ResumeWatch(hass, self._resume_ready)` tras `CloseRetry`.
3. `async_shutdown`: `self._resume_watch.cancel_all()` tras `self._close_retry.cancel_all()`.
4. `_async_recover`: sustituido el bloque `drop_interrupted` por el bucle con `RESUME_WINDOW`, `_not_resumed_locked` y `_resume_watch.start`.
5. `slots.py`: borrados `drop_interrupted` y su entrada en `MUTATORS`. `grep -rn --include='*.py' drop_interrupted custom_components` sale vacío (exit 1). Sin referencias en `engine/tests/`. Un grep sin `--include` encuentra `.pyc` obsoletos en `__pycache__`; no son código.
6. `_async_quiet_end`: el bucle de decisiones pasa a `skip = self._take_skips_locked(refs, own)`. Método nuevo `_take_skips_locked` justo antes de `_async_quiet_end_due`.
7. Sección nueva «retomar tras un reinicio» antes de «colas y válvulas»: `_resume_ready`, `_async_resume`, `_resume_blocker_locked`, `_resume_locked`, `_not_resumed_locked`, `_discard_interrupted_locked`. La línea `reason = ...` pasaba de 120 caracteres: partida con paréntesis, misma lógica.
8. Descartes: `_async_pause` (tras `self._slots.cancel(match)`), `async_run_zone`, `async_run_valve`, `async_save_zone` (tras `drop_pending`). Textos y comentarios tal cual el brief.

Anclas: todas encontradas por contenido. Ninguna discrepancia con el brief.

## Gates

- `uvx ruff check custom_components` -> `All checks passed!`, exit 0.
- `py -3.14 -m compileall -q custom_components` -> sin salida, exit 0.
- Líneas > 120 en `manager.py`: ninguna.
- pytest no se ejecuta (solo CI).

## Paso 9: comprobación de la regla AST (`engine/tests/test_lock.py`)

La regla: llamada a un MUTATOR sobre `self._slots`, o llamada a `*_locked`, debe estar dentro de `async with <x>._lock` o de una función `*_locked` (manda la función más cercana). Las lambdas no cuentan como función: heredan el contexto.
Números de línea de `manager.py` tras los cambios.

Llamadas nuevas a mutadores (`self._slots.*`):

| Línea | Llamada | Dónde |
|---|---|---|
| 575 | `self._slots.discard_interrupted(...)` | `_async_resume`, dentro del segundo `async with self._lock:` (569-584) |
| 606 | `self._slots.resume(...)` | `_resume_locked` (`*_locked`) |
| 616 | `self._slots.discard_interrupted(...)` | `_not_resumed_locked` (`*_locked`) |
| 631 | `self._slots.discard_interrupted(...)` | `_discard_interrupted_locked` (`*_locked`) |

Llamadas nuevas a métodos `*_locked`:

| Línea | Llamada | Dónde |
|---|---|---|
| 250 | `self._not_resumed_locked` | `_async_recover`, dentro de `async with self._lock:` |
| 551 | `self._resume_blocker_locked` | `_async_resume`, primer `async with self._lock:` |
| 554 | `self._not_resumed_locked` | idem |
| 560 | `self._resume_locked` | idem |
| 573 | `self._take_skips_locked` | `_async_resume`, segundo `async with self._lock:` |
| 580 | `self._resume_blocker_locked` | idem |
| 581 | `self._not_resumed_locked` | idem |
| 584 | `self._resume_locked` | idem |
| 760 | `self._take_skips_locked` | `_async_quiet_end`, dentro de `async with self._lock:` |
| 942 | `self._discard_interrupted_locked` | `async_save_zone`, dentro de `async with self._lock:` |
| 1056 | `self._discard_interrupted_locked` | `async_run_zone`, dentro de `async with self._lock:` |
| 1077 | `self._discard_interrupted_locked` | `async_run_valve`, dentro de `async with self._lock:` |
| 1094 | `self._discard_interrupted_locked` | `_async_pause`, dentro de `async with self._lock:` |

Fuera del lock, a propósito: `await self._async_evaluate_lot([rain_ref])` (no es `*_locked`) y `_resume_ready` (solo hace `_spawn`).
Resultado: todas las llamadas nuevas cumplen la regla. Ninguna ofensora.

## Dudas

Ninguna.
