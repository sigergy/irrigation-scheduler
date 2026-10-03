# 3. Puertos explícitos (Protocols)

## Propuesta original

Crear `domain/ports.py` con Protocols `ValveGateway`, `RuntimeStore`, `Notifier`, `Clock`.
`engine/` dependería solo de esos puertos y HA quedaría confinado en `adapters/`. Objetivo:
testear `engine/` en Windows sin `pytest-homeassistant-custom-component`.

## Situación actual

- El engine está muy acoplado a HA:
  - `engine/manager.py:13-23`: `STATE_*`, `HomeAssistant`, `callback`, `ServiceValidationError`,
    `async_dispatcher_send`, `helpers.event`, `async_at_started`, `dt_util`.
  - `hass` aparece 33 veces en `engine/manager.py`, 13 en `incidents.py`, 11 en `triggers.py`,
    7 en `rain_control.py`.
  - Timers de HA (`helpers.event`) en `manager.py`, `triggers.py`, `rain_control.py`.
- `engine` ya depende de `adapters` en vez de al revés: `engine/incidents.py:14` (`Notifier`),
  `engine/manager.py:25-27` (`registry`, `IrrigationStore`, `async_set_valve`),
  `engine/rain_control.py:19` (`rain_source`).
- `Notifier` ya existe como clase en `adapters/notify.py`.
- Partes ya puras y testeables sin HA: `engine/slots.py` (solo importa `domain.runtime`,
  `engine/slots.py:12`) y todo `domain/`.

## Análisis

- Coste alto: el `Clock` y los timers son la parte cara. Hay que abstraer el bucle de eventos
  de HA, `callback`, la cancelación de timers y el arranque (`async_at_started`).
- Beneficio bajo en este proyecto: el motivo «testear en Windows» choca con lo acordado. Los
  tests se ejecutan en GitHub Actions (`.github/workflows/tests.yml`), no en local.
- La inversión engine → adapters sí tiene valor conceptual, pero no hay un dolor medido.

## Veredicto

**Dudoso como refactor completo.** Aplicar solo de forma puntual, donde un puerto simplifique
un test concreto.

## Alternativa propuesta

1. Puerto puntual `Notifier` (Protocol) a partir de la clase existente en `adapters/notify.py`,
   si un test de `incidents` lo necesita.
2. Tests puros directos sobre `domain/` y `engine/slots.py`, sin HA.
3. No introducir `Clock` ni `ValveGateway` mientras no haya un caso concreto.

## Riesgos si se hace completo

- Refactor grande sobre el núcleo con tests de caracterización que dependen de HA
  (`conftest.py:11-17`).
- Doble capa de indirección en un proyecto pequeño.
