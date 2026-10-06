# Informe Tarea 1: intento único en `async_set_valve` y constante de reintentos

## Resumen de cambios

Se agregó la constante de secuencia de reintentos de cierre y se parametrizó `async_set_valve` para permitir un intento único en casos de reintento programado en segundo plano.

### Ficheros modificados

1. **`custom_components/irrigation_scheduler/const.py`** (línea 58-59)
   - Agregada constante `CLOSE_RETRY_OFFSETS_S = (10, 20, 30, 90, 150, 210, 270, 330, 390, 450)`
   - Se insertó después de `VERIFY_DELAY_S = 2` con comentario referenciando el spec.

2. **`custom_components/irrigation_scheduler/adapters/valves.py`**
   - **Firma** (línea 18-24): Agregado parámetro `retries: int = SWITCH_RETRIES` (por defecto mantiene comportamiento actual).
   - **Docstring** (línea 25-28): Actualizado para documentar `retries=0` como caso de uso para reintentos en segundo plano.
   - **Bucle** (línea 31): Cambiado `range(1 + SWITCH_RETRIES)` a `range(1 + retries)`.
   - **Log final** (línea 46): Cambiado `SWITCH_RETRIES` a `retries` en mensaje de error.

## Gates

```
$ uvx ruff check custom_components
All checks passed!

$ py -3.14 -m compileall -q custom_components
Exit code: 0
```

## Notas

- La constante `CLOSE_RETRY_OFFSETS_S` no se usa en esta tarea; se usará en la tarea 2.
- Las llamadas actuales a `async_set_valve` no cambian: mantienen el valor por defecto `retries=SWITCH_RETRIES`.
- No se agregaron tests; la validación funcional es responsabilidad del usuario en su HA.

## Siguiente paso

Implementación de la tarea 2: mecanismo de reintentos programados en segundo plano en el manejador `async_shutdown`.
