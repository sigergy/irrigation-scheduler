# 2. Cierre de válvulas al reiniciar o apagar HA

> Estado: **diseño aprobado** · 2026-10-06
> Depende de: [01-close-retry](../01-close-retry/spec.md), que hace de red de seguridad.
> Relacionadas: [03-remaining-time](../03-remaining-time/spec.md),
> [04-resume-after-restart](../04-resume-after-restart/spec.md).

## 1. Objetivo

Cuando HA recibe una orden de reinicio o apagado, la integración cierra todas las válvulas
abiertas antes de parar.

Qué pasa con el riego cortado lo deciden las specs 03 y 04. Hasta que estén hechas, una válvula
cerrada al apagar se da por terminada.

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

- **Qué se cierra:** la `switch` de cualquier válvula de cualquier zona, aunque la zona o la
  válvula estén deshabilitadas, si su estado no es `off` (`on`, `unavailable` o `unknown`). Además,
  siempre, las de la integración: abiertas, abriéndose o cerrándose, y las que tienen reintentos de
  [01-close-retry](../01-close-retry/spec.md) en marcha.
- **Presupuesto:** un intento por `switch` (`async_set_valve` con `retries=0`: orden + 2 s de
  verificación), todas en paralelo. Tope total de 12 s: 10 s para los apagados y 2 s para esperar
  el lock y guardar el estado. Stage 1 da 20 s compartidos con otras integraciones.
- **Avisos:** ninguno. Solo log: `info` por cada `switch` cerrada y `warning` por cada fallo.
- **La cola no se toca.** Los trabajos pendientes siguen en el runtime y se retoman al arrancar
  (`valves-execution/spec.md` §5.2.3).

## 5. Diseño

1. `async_setup_entry` registra el job con `hass.async_add_shutdown_job`. El callback que lo quita
   va a `entry.async_on_unload`: al recargar o deshabilitar la entry no queda un job duplicado.
2. El job (`IrrigationManager.async_close_on_stop`):
   1. Calcula los objetivos (§4) sin `await` en medio. No espera al lock: el arranque
      (`_async_recover`) puede tenerlo cogido varios segundos mientras apaga válvulas excedidas.
   2. Llama a `async_shutdown`: quita temporizadores, disparos, latido, seguimiento de lluvia y
      reintentos de cierre.
   3. Lanza los apagados en paralelo y espera como mucho 10 s. Los que no han terminado se cancelan
      y cuentan como fallidos.
   4. Con el lock (espera máxima 2 s), cada válvula gestionada que cerró sale de `open_valves`: su
      riego se da por terminado (§1). Las que fallaron siguen en `open_valves` y al arrancar las
      trata `valves-execution/spec.md` §5.2. Persiste con la escritura diferida, que HA vuelca en
      stage 3 (§2.1).
3. **Puerta del despacho.** Con el manager parando (`_stopping`), `_async_dispatch_locked` no abre
   nada. Hace falta porque la entry sigue cargada en stages 2-4 y un servicio podría encolar y
   abrir una válvula.
4. **Aperturas en curso.** Con el manager parando, `_async_open_job` deja de reintentar el
   `turn_on`, como con una pausa, y un fallo de apertura no avisa. Si el `turn_on` ya ha tenido
   éxito, la válvula queda en `open_valves` sin temporizador y el job la cierra con las demás.

## 6. Límites conocidos

- Un `turn_on` ya enviado por Zigbee puede llegar después del `turn_off` del job (ventana de unos
  2 s). La válvula queda abierta y en `open_valves`; al arrancar la trata §5.2.
- Si el lock no llega en 2 s, las válvulas cerradas siguen en `open_valves`. Al arrancar se
  apagan otra vez: si su `ends_at` ya pasó, con el aviso `overrun_restart`.
- Un cierre propio que ya estaba en marcha al parar sigue su camino normal (ráfaga y, si falla,
  `turn_off_failed`). El job también le manda su `turn_off`.
- Fuera de alcance, como en §3: paradas sin stage 1.
