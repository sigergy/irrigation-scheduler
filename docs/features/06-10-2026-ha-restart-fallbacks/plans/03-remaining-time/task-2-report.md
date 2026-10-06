# Tarea 2: el manager interrumpe al parar y descarta al arrancar

## Cambios realizados

### Paso 1: `async_close_on_stop` (parada)
- **Línea 173:** Actualizado docstring. Cambio: «Las gestionadas que cierran se dan por terminadas» → «Las gestionadas que cierran con tiempo por delante quedan interrumpidas (03-remaining-time §4.3)»
- **Líneas 222-224:** Reemplazado el bucle simple `self._slots.closed(entity_id)` por lógica que intenta `interrupt()` primero:
  ```python
  now = dt_util.utcnow()
  for entity_id in closed:
      if self._slots.interrupt(entity_id, now) is None:
          self._slots.closed(entity_id)
  ```

### Paso 2: `_async_recover` (arranque)
- **Línea 234:** Añadida como primera instrucción dentro del bloque `async with self._lock:` la descarga de válvulas interrumpidas:
  ```python
  for valve in self._slots.drop_interrupted():
      _LOGGER.info(
          "%s: riego interrumpido por reinicio de HA, faltaban %s min; no se retoma",
          valve.entity_id,
          valve.remaining_min,
      )
  ```

### Paso 3: `_async_open_job` (apertura abortada)
- **Línea 676:** Añadida rama `elif` tras el bloque `if ok:` y antes de `await self._async_persist_locked()`:
  ```python
  elif self._stopping and not cancelled:
      self._slots.interrupt_job(job, dt_util.utcnow())
  ```

## Gates

| Gate | Resultado |
|------|-----------|
| `uvx ruff check custom_components` | ✓ All checks passed! |
| `py -3.14 -m compileall -q custom_components` | ✓ Sin errores (exit 0) |

## Dudas

Ninguna. Implementación completada según el brief. Los cambios siguen exactamente las interfaces y comentarios especificados en `task-2-brief.md`.
