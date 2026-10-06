# Tarea 3: Alerta `restart_not_resumed` y botón Pausar - Informe

**Fecha:** 2026-10-06  
**Ejecutor:** Claude Haiku 4.5  

## Cambios por fichero

### 1. `custom_components/irrigation_scheduler/domain/alerts.py` (línea 49)
- Añadida entrada en `ALERT_TYPES`:
  ```python
  "restart_not_resumed": AlertType(LEVEL_VALVE, SEVERITY_INFO, PRIORITY_NORMAL, push_only=True),
  ```

### 2. `custom_components/irrigation_scheduler/adapters/notify.py` (línea 63, 102)
- **ES (línea 63):** Añadido tras `valve_off`:
  ```python
  "restart_not_resumed": (
      "{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se retoma."
  ),
  ```
- **EN (línea 102):** Añadido tras `valve_off`:
  ```python
  "restart_not_resumed": (
      "{zone} · {entity}: irrigation interrupted by HA restart. {minutes} min were left. Not resumed."
  ),
  ```

### 3. `custom_components/irrigation_scheduler/engine/incidents.py` (línea 190)
- Añadido método `push_not_resumed` tras `push_switched`:
  ```python
  async def push_not_resumed(self, zone_id: str, entity_id: str, minutes: int) -> None:
      """Riego cortado por un reinicio de HA que no se retoma (04-resume-after-restart §4.6). Solo push."""
      if not any(targets := self._targets("restart_not_resumed")):
          return
      self._send(
          "restart_not_resumed", targets, minutes=str(minutes), **self._names(zone_id, entity_id)
      )
  ```

### 4. `frontend/src/alerts.ts` (línea 35)
- Añadida entrada en `ALERT_TYPES`:
  ```ts
  { id: "restart_not_resumed", level: "valve", priority: "normal", allowed: ALL, name: "alert_restart_not_resumed", help: "alert_restart_not_resumed_help", pushOnly: true },
  ```

### 5. `frontend/src/i18n.ts` (línea 189, 426)
- **ES (línea 189):** Añadido tras `alert_valve_switched_help`:
  ```ts
  alert_restart_not_resumed: "No retomado tras reinicio",
  alert_restart_not_resumed_help:
    "Un riego cortado por un reinicio de HA no se completa: pasaron más de 60 min, llegó el siguiente bloque de la válvula, está deshabilitada o es hora de silencio. No se marca en el histórico.",
  ```
- **EN (línea 426):** Añadido tras `alert_valve_switched_help`:
  ```ts
  alert_restart_not_resumed: "Not resumed after restart",
  alert_restart_not_resumed_help:
    "An irrigation cut by an HA restart is not completed: over 60 min went by, the valve's next block arrived, it is disabled or it is quiet time. Not marked in the history.",
  ```

### 6. `frontend/src/shared/valve-status.ts` (línea 119-121)
- Sustituido:
  ```ts
  case "closing":
  case "interrupted":
    return [];
  ```
  por:
  ```ts
  case "closing":
    return [];
  case "interrupted":
    // espera a retomarse tras un reinicio: Pausar la descarta (04-resume-after-restart §4.7)
    return [{ action: "pause", run: (hass) => pauseValve(hass, entityId) }];
  ```
- Verificado: `pauseValve` ya estaba importado en línea 5.

## Gates ejecutados

| Gate | Comando | Exit Code | Resultado |
|------|---------|-----------|-----------|
| Ruff | `uvx ruff check custom_components` | 0 | ✓ Passed: All checks passed! |
| Compile | `py -3.14 -m compileall -q custom_components` | 0 | ✓ Passed (sin output) |
| Lint | `npm run lint` en frontend/ | 0 | ✓ Passed (sin output) |
| Typecheck | `npm run typecheck` en frontend/ | 0 | ✓ Passed (sin output) |
| Build | `npm run build` en frontend/ | 0 | ✓ Passed (164.65 kB, gzip 46.45 kB) |

## Dudas / Notas

- Sin dudas. Todos los cambios siguen el brief exactamente.
- Bundle generado en `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js` (está en `.gitignore`).
