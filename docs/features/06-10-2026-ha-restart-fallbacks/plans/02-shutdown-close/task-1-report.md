# Informe tarea 1: nada se abre ni se registra con la integración parando

Estado: DONE. Sin commit (paso 7 es del controlador). Solo se tocó `custom_components/irrigation_scheduler/engine/manager.py`.

## Cambios (localizados por texto)

1. `_async_dispatch_locked`: puerta `if self._stopping: return` tras el docstring, antes de `_quiet_hold_locked`.
2. `_async_quiet_end` y `_async_finish_close`: quitado el `if not self._stopping:` alrededor de `_async_dispatch_locked()`.
3. `_async_open_job`: `cancelled=lambda: self._stopping or self._slots.is_cancelled(...)`; el despacho ya no comprueba `_stopping` (solo `not (ok and cancelled)`); `valve_error` solo si `not self._stopping`; comentarios del brief.
4. `_mark_open_locked` simplificado; `_schedule_close` con docstring y `return` si `_stopping`.
5. `async_shutdown`: `self._started = False` tras `self._stopping = True`. `_async_on_started`: `return` si `_stopping` tras `_async_recover()`, antes de `self._started = True`.

Todo con el código exacto del brief. Nada no encajó con el código.

## Gates

```
uvx ruff check custom_components   -> All checks passed!  (exit 0)
py -3.14 -m compileall -q custom_components -> sin salida (exit 0)
```

`git status --short`: solo `M custom_components/irrigation_scheduler/engine/manager.py`.
No se ejecutó pytest (norma del proyecto).
