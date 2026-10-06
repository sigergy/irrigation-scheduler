# 1. Romper la dependencia engine → api

## Propuesta original

`snapshot` pasa a construirse en `api/` leyendo vistas públicas del manager.

## Situación actual

- Dependencia invertida real: `engine/manager.py:28` importa `build_snapshot` de `api/snapshot.py`.
- `engine/manager.py:965-966` solo delega: `def snapshot(self)` → `return build_snapshot(self)`.
- `api/snapshot.py:18-79` ya usa solo la API pública del manager: `runtime`, `config`,
  `zone_status`, `zone_next_run`, `opening_durations`, `visible_opening`, `closing_valves`,
  `manual_on`, `hass`. Su docstring (`api/snapshot.py:19`) lo declara así.
- No hacen falta «vistas públicas» nuevas: ya existen.

Llamadores de `manager.snapshot()`:

- `api/websocket.py:78` (comando de lectura).
- `api/websocket.py:256` (`forward` de la suscripción).
- `engine/tests/test_characterization.py:50`, `:54`, `:75`.

## Veredicto

**Sí. Hacerlo ya.** Coste muy bajo, sin riesgo funcional y desbloquea la regla de capas del
apartado 2.

## Plan

1. `api/websocket.py:78` y `:256`: llamar a `build_snapshot(manager)` / `build_snapshot(current)`.
2. Borrar `snapshot()` y el import de `engine/manager.py:28`, `:965-966`.
3. Tests de caracterización: importar `build_snapshot` y usar `build_snapshot(manager)`.
4. Gates: `ruff check custom_components`, `pytest` (en CI).

## Riesgos

- Ninguno funcional: la salida del snapshot no cambia.
- `api/snapshot.py:15` mantiene el import de `IrrigationManager` bajo `TYPE_CHECKING`;
  api → engine es la dirección correcta.
