# Informe tarea 2: async_close_on_stop y shutdown job

Estado: DONE

## Cambios (sin commit)
- `custom_components/irrigation_scheduler/const.py`: `SHUTDOWN_CLOSE_TIMEOUT_S = 10` y `SHUTDOWN_LOCK_TIMEOUT_S = 2` tras `CLOSE_RETRY_OFFSETS_S`.
- `custom_components/irrigation_scheduler/engine/manager.py`: import de `STATE_OFF`; las dos constantes entre `RAIN_STARTUP_RETRY_S` y `SIGNAL_CONFIG`; método `async_close_on_stop` justo después de `async_shutdown`, con el código exacto del brief.
- `custom_components/irrigation_scheduler/__init__.py`: import de `HassJob`; `entry.async_on_unload(hass.async_add_shutdown_job(HassJob(manager.async_close_on_stop)))` tras `entry.runtime_data = manager`.

## Gates
- `uvx ruff check custom_components`: `All checks passed!` (exit 0).
- `py -3.14 -m compileall -q custom_components`: sin salida (exit 0).
- No se ejecutó pytest ni se añadieron tests.

## Dudas
Ninguna. El brief encajó con el código; los bloques se localizaron por texto. `git status`: solo los 3 ficheros modificados.
