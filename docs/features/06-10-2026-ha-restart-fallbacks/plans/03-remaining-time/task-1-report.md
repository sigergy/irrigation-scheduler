# Task 1: Informe de implementación

## Estado: DONE

## Cambios realizados

### `domain/runtime.py`

1. **Import**: Añadido `import math` en el bloque de imports estándar (línea 4), antes de `from collections import Counter`.

2. **Clase `InterruptedValve`**: Añadida tras `OpenValve`, con:
   - Campos: `entity_id`, `zone_id`, `remaining_s`, `interrupted_at`, `origin` (default `ORIGIN_MANUAL`)
   - Propiedad `remaining_min`: redondea hacia arriba `remaining_s / 60` con `math.ceil`
   - Método `to_dict()`: serializa con `interrupted_at.isoformat()`
   - Método `from_dict()`: deserializa con `datetime.fromisoformat()`

3. **Campo `interrupted` en `RuntimeState`**: Añadido tras `forecast_log` (línea 101-102), tipo `dict[str, InterruptedValve]` con factory por defecto.

4. **Persistencia en `to_dict()`**: Añadida clave `"interrupted"` que serializa `self.interrupted.values()`.

5. **Persistencia en `from_dict()`**: Añadida reconstrucción de interrupciones, con fallback a lista vacía para compatibilidad hacia atrás.

### `engine/slots.py`

1. **Import**: Actualizado para incluir `InterruptedValve` junto con `Job`, `OpenValve`, `RuntimeState`.

2. **Docstring del módulo**: Actualizado para mencionar que `ValveSlots` también modifica `interrupted`.

3. **MUTATORS**: Añadidos tres mutadores: `"interrupt"`, `"interrupt_job"`, `"drop_interrupted"` tras `"prune_batches"`.

4. **Método `interrupt(entity_id, now)`**: 
   - Devuelve `InterruptedValve | None`
   - Devuelve None si la válvula no existe, ya está cerrándose, o no tiene tiempo restante
   - Si hay tiempo, la saca de `open_valves`, la guarda en `interrupted` y la devuelve

5. **Método `interrupt_job(job, now)`**:
   - Devuelve `InterruptedValve`
   - Guarda en `interrupted` con duración completa de la apertura abortada

6. **Método `drop_interrupted()`**:
   - Devuelve lista de todas las interrupciones
   - Vacía `self.runtime.interrupted`

## Gates

- `uvx ruff check custom_components`: ✓ All checks passed!
- `py -3.14 -m compileall -q custom_components`: ✓ Completed with no output (exit 0)

## Observaciones

- Orden de imports en isort respetado: `math` en estándar, antes que `collections`.
- No hay tests nuevos (norma del proyecto).
- Sin cambios en otros ficheros; solo `domain/runtime.py` y `engine/slots.py` tocados.
- Compatibilidad hacia atrás: `from_dict()` maneja `data.get("interrupted", [])` para runtime guardados antes de esta tarea.
