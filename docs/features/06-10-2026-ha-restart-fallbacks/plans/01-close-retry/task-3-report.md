# Tarea 3: clase `CloseRetry` — Informe

**Status:** DONE

## Cambios

- **Fichero creado:** `custom_components/irrigation_scheduler/engine/close_retry.py`
  - 169 líneas: módulo `CloseRetry` con clase del mismo nombre + dataclass `_Retry`.
  - Transcripción exacta del brief (task-3-brief.md, líneas 18–188).

## Gates

| Gate | Resultado |
|------|-----------|
| `uvx ruff check custom_components` | ✓ All checks passed! |
| `py -3.14 -m compileall -q custom_components` | ✓ Sin salida, código 0 |

## Restricciones verificadas

- ✓ `engine/` no importa `api` ni `entities` — ningún módulo en `engine/` importa esos nombres; el nuevo fichero importa solo Home Assistant core/helpers y `adapters.valves`, `const`, `.incidents`.
- ✓ Comentarios en español; nombres en inglés.
- ✓ Sin tests nuevos (conforme a norma del proyecto).
- ✓ Fichero `snake_case`: `close_retry.py`.

## Desviaciones

Ninguna.

## Notas

- El código respeta las dos notas de implementación del brief: (1) `_async_attempt` pone `retry.task = None` antes de `_finish`, evitando cancelación de la tarea que corre; (2) el listener en `_state_changed` viendo `off` durante un intento lo cancela sin doble aviso.
- El fichero está listo para ser commiteado (paso 3 del brief), pero no se ejecuta commit por instrucción del usuario.

---

**Fichero de informe:** `.superpowers/sdd/01-close-retry/task-3-report.md`
