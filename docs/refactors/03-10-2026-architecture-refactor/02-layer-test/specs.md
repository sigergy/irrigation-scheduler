# 2. Test de capas

## Propuesta original

Test de capas con `import-linter` o un test de AST: `domain` no importa nada; `engine` no
importa `api`, `entities` ni `homeassistant`.

## Situación actual

- Hay precedente de test por AST sin dependencias: `engine/tests/test_lock.py` (comprueba que
  los mutadores de `ValveSlots` se llaman con el lock tomado).
- La regla «domain no importa nada» **es falsa hoy**: `domain` importa `..const` en
  `domain/model.py:8`, `domain/runtime.py:11`, `domain/schedule.py:8`, `domain/alerts.py:8`,
  `domain/validation.py:10`. Es legítimo: son constantes, no infraestructura.
- La regla «engine no importa homeassistant» **es falsa hoy** y solo sería viable tras el
  apartado 3: `engine/manager.py:13-23`, `engine/triggers.py:13-17`,
  `engine/rain_control.py:11-17`, `engine/incidents.py:11-12`, `engine/manual.py:8-9`,
  `engine/status.py:11-13`.
- `engine → api` existe hoy en `engine/manager.py:28` (lo elimina el apartado 1).

## Veredicto

**Sí, con AST y reglas ajustadas a la realidad.** Mejor seguir el patrón de `test_lock.py` que
añadir `import-linter` como dependencia.

## Reglas aplicables

| Capa | No puede importar |
|---|---|
| `domain/` | `engine`, `api`, `entities`, `adapters`, `homeassistant` |
| `engine/` | `api`, `entities` (tras el apartado 1) |

Permitido explícitamente: `domain → const`, `engine → domain/adapters/const`.

## Plan

1. Hacer antes el apartado 1.
2. Nuevo test por AST que recorra `domain/*.py` y `engine/*.py` (sin `tests/`), resuelva
   imports relativos y absolutos y falle con la lista `fichero:línea módulo`.
3. Ubicación según la convención del proyecto (tests en `<subcarpeta>/tests/`). Pendiente de
   decidir carpeta: candidata `engine/tests/` o una nueva `domain/tests/`.
4. Añadir un aserto de no vacuidad, como hace `test_lock.py` (que haya ficheros analizados).

## Riesgos

- Imports bajo `TYPE_CHECKING` (`engine/triggers.py:11`): decidir si cuentan. Propuesta: sí
  cuentan para `domain`, se ignoran para `engine`.
