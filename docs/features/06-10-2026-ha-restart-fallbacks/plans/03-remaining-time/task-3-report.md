# Tarea 3: Entidad «Fin riego» — Informe

## Cambios realizados

### 1. sensor.py
- Actualizé docstring del módulo (línea 1): añadí «modo y fin de riego por válvula»
- Cambié comentario de `valves_known` (línea 34): «sensores «Modo riego» y «Fin riego»»
- Actualicé `sync_valves()` (línea 38-47): ahora crea ambos sensores en un bucle anidado
- Añadí clase `ValveEndSensor` (línea 104-124):
  - Device class: `TIMESTAMP`
  - Lee `manager.runtime.open_valves[valve_id].ends_at` como valor nativo
  - Lee `manager.runtime.interrupted[valve_id].remaining_min` como atributo extra si interrumpida

### 2. registry.py
- Actualicé `remove_valve_entities()` (línea 32-39):
  - Tupla: `(("event", "valve_alerts"), ("sensor", "valve_mode"), ("sensor", "valve_end"))`
  - Docstring: «sensores «Modo riego» y «Fin riego»»

### 3. strings.json
- Añadí `valve_end` tras `valve_mode` (línea 72-75) con:
  - `name`: "Irrigation end"
  - Atributo `remaining_min`: "Minutes left"

### 4. translations/en.json
- Mismo contenido que strings.json

### 5. translations/es.json
- Añadí `valve_end` con:
  - `name`: "Fin riego"
  - Atributo `remaining_min`: "Minutos pendientes"

## Gates

```
JSON validation: OK
Ruff check: All checks passed!
Python compile: OK
```

Exit code: 0 (todos pasan).

## Dudas

Ninguna. Brief y código encajan. `ValveEntity` y `_update_attrs()` están disponibles en la base.
