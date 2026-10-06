# Informe tarea 4: enganche de CloseRetry en el manager

Fichero tocado: `custom_components/irrigation_scheduler/engine/manager.py` (+26 -5). Sin commit.

## Cambios
1. Import `from .close_retry import CloseRetry` entre `status` y `config_edit`.
2. `__init__`: `self._close_retry = CloseRetry(hass, self._incidents)` tras `self._incidents`.
3. `async_shutdown`: `self._close_retry.cancel_all()` antes de `self._cancel_quiet_end()`.
4. Nuevo `_async_close_failed(zone_id, entity_id)` justo tras `_async_finish_close`.
5. Tres llamadas de apagado (`_async_recover`, `_async_finish_close`, `_async_close_manual`) pasan a `_async_close_failed`.
6. `manual_on`: `busy = self._slots.busy() | self._close_retry.active()`.
7. `_async_open_job`: `self._close_retry.cancel(job.entity_id)` con comentario, tras el docstring y antes de `ok = await async_set_valve(...)`.

## Desviaciones
Ninguna en el código. Nota sobre el paso 5: el grep devuelve dos líneas, no una, porque el helper nuevo contiene la llamada `valve_error(zone_id, entity_id, False)` (paso 4, literal del brief). Las tres llamadas de apagado originales ya no existen; solo queda la de encendido (`True`) fuera del helper.

## Gates
```
$ uvx ruff check custom_components
All checks passed!
(exit 0)

$ py -3.14 -m compileall -q custom_components
(sin salida, exit 0)
```

## Grep paso 5
```
$ grep -n "valve_error(" custom_components/irrigation_scheduler/engine/manager.py
597:            await self._incidents.valve_error(job.zone_id, job.entity_id, True)
647:        await self._incidents.valve_error(zone_id, entity_id, False)
```
Línea 597 = encendido (sin cambios). Línea 647 = dentro de `_async_close_failed`.

## Dudas
Ninguna. Pytest no ejecutado (norma del proyecto).
