# Fallbacks ante reinicios de HA y fallos de cierre

Fecha: 2026-10-06. Estado: **en diseño**.

## Origen

Prueba real del usuario (2026-10-06):

1. Durante un bloque de riego, a unos 10 s del final, reinicia HA desde la interfaz.
2. HA tarda unos 3 min en volver. La red Zigbee (ZHA, coordinador USB) tarda otros 3 min.
3. Al arrancar salta `turn_off_failed`: la válvula no responde y hay que cerrarla a mano.
   El aviso es correcto.
4. Después nadie vuelve a intentar el cierre. La válvula sigue abierta cuando Zigbee vuelve.

Causa, según el código:

- La ráfaga de cierre dura ~8 s: 1 intento + 3 reintentos con 2 s de verificación
  (`adapters/valves.py:30-47`, `const.py:55-56`). Si falla, no hay más intentos.
- `_async_recover` saca la válvula de `open_valves` aunque el cierre falle
  (`engine/manager.py:162-176`, `engine/slots.py:90-93`).
- El paso `unavailable → on` de la switch al volver Zigbee se ignora (`engine/triggers.py:132`).
  Solo queda el latido, tras `duration_min` + 1 min (`engine/status.py:77-85`).

## Cambios

Cuatro cambios, cada uno con su spec y su commit.

| # | Cambio | Estado |
|---|---|---|
| 1 | [Reintentos de cierre en segundo plano](01-close-retry/spec.md) | Diseño aprobado |
| 2 | [Cierre de válvulas al reiniciar o apagar HA](02-shutdown-close/spec.md) | En diseño |
| 3 | [Tiempo restante por válvula](03-remaining-time/spec.md) | En diseño |
| 4 | [Retomar el riego tras un reinicio](04-resume-after-restart/spec.md) | En diseño |

## Orden

1 → 2 → 3 → 4.

- El 1 es la red de seguridad de todo lo que el resto no puede cubrir: corte de luz, kill,
  Zigbee caído o una válvula fuera de alcance. Se valida en HA antes de seguir.
- El 2 funciona solo: cierra al apagar y da el riego por terminado.
- El 3 añade el estado «pausada» y la entidad. El 4 lo usa para retomar.
