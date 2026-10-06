# 2. Cierre de válvulas al reiniciar o apagar HA

> Estado: **investigado, pendiente de diseño** · 2026-10-06
> Depende de: [01-close-retry](../01-close-retry/spec.md), que hace de red de seguridad.

## 1. Objetivo

Cuando HA recibe una orden de reinicio o apagado, la integración cierra todas las válvulas
abiertas antes de parar. Al volver, retoma el riego interrumpido donde lo dejó.

## 2. Investigación

Código de HA revisado: `home-assistant/core` en `dev` (2026.11.0.dev0) y `home-assistant/supervisor`
en `main`. Las rutas son de `core` salvo que se diga otra cosa.

### 2.1 Fases de apagado

`HomeAssistant.async_stop` (`homeassistant/core.py:1125-1262`), timeouts en `core.py:111-114`:

| Fase | Qué pasa | Timeout |
|---|---|---|
| Stage 1 | Ejecuta los jobs de `hass.async_add_shutdown_job` (`core.py:1149-1163`). Todas las integraciones siguen vivas | 20 s, compartidos con todos los jobs |
| Stage 2 | `CoreState.stopping` y `EVENT_HOMEASSISTANT_STOP` (`core.py:1185-1186`) | 100 s |
| Stage 3 | `EVENT_HOMEASSISTANT_FINAL_WRITE`: los `Store` vuelcan lo pendiente (`core.py:1197-1198`) | 60 s |
| Stage 4 | `EVENT_HOMEASSISTANT_CLOSE` (`core.py:1210-1211`) | 30 s |

- Las config entries **no se descargan** al parar (`config_entries.py:2405-2410`). Ni
  `async_unload_entry` ni `async_on_unload` corren al reiniciar.
- `async_add_shutdown_job` devuelve el callback para quitar el job (`core.py:1042-1075`). Lo usa
  el trigger de automatización `homeassistant: shutdown`
  (`components/homeassistant/triggers/homeassistant.py:35-46`).

### 2.2 Zigbee en cada fase

- El repo usa ZHA (`docs/features/no-water/spec.md:8`).
- ZHA apaga el gateway en `EVENT_HOMEASSISTANT_STOP` (`components/zha/__init__.py:258-265`).
  MQTT se desconecta en el mismo evento (`components/mqtt/client.py:524, 534-536`). Un cierre
  enganchado a ese evento entra en carrera con el apagado de la radio.
- **Stage 1 es el único punto con ZHA y MQTT garantizados vivos.**
- Con ZHA, un `switch.turn_off` con `blocking=True` sin error equivale al ACK del dispositivo
  (`zigpy/zha` `zha/application/platforms/switch.py:188-194`).

### 2.3 Qué paradas cubre

| Parada | ¿Pasa por stage 1? |
|---|---|
| Reinicio o apagado desde la UI o por servicio, con o sin Supervisor | Sí |
| `ha host reboot` con ZHA | Sí |
| `ha host reboot` con Zigbee2MQTT | No: Supervisor para el add-on antes que Core |
| HA Container con `docker restart` (10 s de gracia por defecto) | Solo si el cierre es rápido. No verificado |
| Corte de luz, kill, OOM, cuelgue | No |

Margen con Supervisor antes del SIGKILL: 260 s (supervisor `docker/homeassistant.py:77-87`).
Las cuatro fases suman 210 s y caben.

### 2.4 Estado actual del repo

- No hay ningún enganche de parada en el código Python.
- `async_shutdown` del manager deja las válvulas abiertas a propósito (`engine/manager.py:143-156`)
  y además no corre al reiniciar (§2.1).
- Solo se cierran válvulas al borrar la integración (`__init__.py:90-100`).

## 3. Dirección elegida

Propuesta del usuario (2026-10-06): **una entidad de tiempo restante por válvula**.

- Al abrir la válvula empieza la cuenta atrás del bloque.
- Al cerrar por reinicio o apagado, la cuenta se **pausa** con los segundos que faltan.
- Al volver HA, la válvula se reabre por los segundos restantes. Así el tiempo siempre corresponde
  a un bloque de riego.
- También sirve a los otros fallbacks: al arrancar, se sabe si una válvula ha regado de más con
  HA parado, y se apaga.

Notas de partida para el diseño:

- Los datos ya existen. El runtime guarda `started_at` y `ends_at` de cada válvula abierta
  (`domain/runtime.py:29-43`) y los persiste en disco.
- Falta el estado «pausada»: guardar los segundos restantes en lugar de `ends_at`.
- La fuente de verdad es el runtime persistido. La entidad es la cara visible, no la fuente:
  HA restaura el estado de las entidades tarde y sin garantías.

## 4. Puntos abiertos

Se deciden en el brainstorming de este cambio, no antes:

- Tipo, nombre y unidades de la entidad, y qué muestra con la válvula cerrada.
- Cómo se reabre al volver: en su cola, respetando la simultaneidad, o fuera de ella.
- Qué pasa si al volver ya no toca regar: lluvia, horas de silencio, zona o válvula deshabilitada.
- Si se pausa un riego manual igual que uno programado.
- Presupuesto del cierre en stage 1: un intento por válvula, en paralelo, con un timeout total
  de 12 s o menos.
