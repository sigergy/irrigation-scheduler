# Tarea 2: avisos «límite superado» y «ya cerrada»

## Cambios realizados

### 1. Textos nuevos en `adapters/notify.py`

- Añadidos dos textos nuevos a `MESSAGES["es"]`:
  - `"turn_off_gave_up"`: error en cierre de válvula con límite de reintentos superado
  - `"turn_off_recovered"`: válvula cerrada por reintento, ya no hace falta cerrar a mano

- Añadidos dos textos nuevos a `MESSAGES["en"]`:
  - `"turn_off_gave_up"`: valve close error with retry limit exceeded
  - `"turn_off_recovered"`: closed on retry, no need to close by hand

### 2. Parámetro `severity` en `compose_notice`

- Añadido parámetro `severity: str | None = None` tras `kind` en la firma
- Actualizado docstring: indica que `severity` es la cabecera si no es la del tipo
- Modificado cálculo del título: `title_{severity or ALERT_TYPES[alert_id].severity}`

### 3. Firma expandida de `_send` en `engine/incidents.py`

- Añadidos parámetros `priority: str | None = None` y `severity: str | None = None`
- Actualizado docstring: indica que solo se usan si el aviso no usa los del tipo
- Modificado cuerpo: `priority or alert_priority(...)` y `severity=severity` pasado a `compose_notice`

### 4. Método `_names` en `engine/incidents.py`

- Extrae campos `zone` y `entity` del push
- Válvula: usa su nombre propio (V12); otra entidad: usa su nombre en HA
- Refactorizado final de `alert`: sustituye lógica inline por `**self._names(zone_id, entity_id)`

### 5. Métodos nuevos en `engine/incidents.py`

- `async def valve_close_gave_up(zone_id, entity_id)`: falla de reintentos de cierre
  - Usa `alert_id="turn_off_failed"` (mismo tipo, otro texto)
  - Emite entidad event, evento de bus y push
  - Parámetro `kind="turn_off_gave_up"`

- `async def push_close_recovered(zone_id, entity_id)`: válvula se cierra durante reintentos
  - Solo push, sin entidad event ni evento de bus
  - Prioridad normal, destinos de `turn_off_failed`
  - `kind="turn_off_recovered"` y `severity=SEVERITY_INFO`

### 6. Imports añadidos

- `PRIORITY_NORMAL` en `from ..const import (...)`
- `SEVERITY_INFO` en `from ..domain.alerts import (...)`
- Ordenados alfabéticamente con `ruff check --fix --select I`

## Ficheros modificados

- `custom_components/irrigation_scheduler/adapters/notify.py`
- `custom_components/irrigation_scheduler/engine/incidents.py`

## Salida de gates

### ruff check

```
All checks passed!
```

### compileall

```
(sin salida, código 0)
```

## Dudas

Ninguna. Implementación exacta del brief.
