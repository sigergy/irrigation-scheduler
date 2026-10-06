# 2. Cierre de válvulas al reiniciar o apagar HA

> Estado: **en diseño** · 2026-10-06
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

## 3. Alcance

- **Dentro:** paradas ordenadas, las que pasan por stage 1 (§2.3). El caso principal es el
  reinicio desde la interfaz de HA.
- **Fuera:** paradas bruscas (corte de luz, kill, cuelgue). Ya las cubre el código actual: al
  arrancar, una válvula con `now ≥ ends_at` se cierra y avisa con `overrun_restart`
  (`engine/manager.py:162-176`). Si ese cierre falla, actúan los reintentos de
  [01-close-retry](../01-close-retry/spec.md).

## 4. Decisiones

Tomadas con el usuario el 2026-10-06.

### 4.1 Tiempo restante por válvula

Propuesta del usuario: el tiempo que le falta a cada válvula se pausa al cerrar por reinicio y
se retoma al volver. Así el tiempo siempre corresponde a un bloque de riego.

- **Fuente de verdad: el runtime persistido.** Ya guarda `started_at` y `ends_at` de cada válvula
  abierta (`domain/runtime.py:29-43`). Se añade el estado «pausada» con los segundos restantes.
  HA restaura el estado de las entidades tarde y sin garantías, así que la entidad no se usa
  para decidir nada.
- **Entidad: solo muestra el dato.**
  - Regando: sensor de tipo hora con el fin previsto («termina a las 10:20»). El panel calcula
    la cuenta atrás. No se actualiza cada segundo, para no llenar el histórico (recorder).
  - En pausa: muestra los minutos que faltan.

### 4.2 Cuándo se retoma

Se retoma solo si se cumplen las dos condiciones:

1. HA vuelve en **menos de 60 min** desde la pausa. Constante fija, sin ajuste en el panel.
2. **No ha llegado el siguiente bloque** de esa zona.

Al retomar, el resto entra en la cola de su zona como un trabajo normal. Respeta simultaneidad y
lluvia, como los bloques perdidos al arrancar
([`valves-execution/spec.md`](../../valves-execution/spec.md) §5.2.4).

Si no se cumplen, el riego se da por terminado y llega un aviso informativo:
«{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se retoma.»

Ejemplo: riego de 10:00 a 10:20, reinicio a las 10:15.

| HA vuelve | Resultado |
|---|---|
| 10:21 | Se retoma: 5 min más |
| 12:00 | Más de 60 min: terminado y aviso |
| 10:40, con otro bloque de la zona a las 10:30 | Terminado y aviso: manda el bloque de las 10:30 |

## 5. Puntos abiertos

Se deciden en el brainstorming de este cambio:

- Nombre de la entidad y su texto en el panel.
- Si se pausa un riego manual igual que uno programado.
- Qué pasa si al retomar la zona o la válvula está deshabilitada, o es hora de silencio.
- Presupuesto del cierre en stage 1: un intento por válvula, en paralelo, con un timeout total
  de 12 s o menos.
