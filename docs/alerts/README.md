# Alertas y notificaciones

> Estado: **en diseño** · Última actualización: 2026-09-29
> Detalle de cada alerta: [`spec.md`](spec.md). Diseño y decisiones:
> [`../superpowers/specs/2026-09-29-incidents-design.md`](../superpowers/specs/2026-09-29-incidents-design.md).

## Propósito

La integración detecta situaciones que el usuario debe conocer: una válvula que no responde, una
válvula que riega más de la cuenta, un sensor caído o un riego omitido por lluvia. Cada una es una
**alerta** con un identificador fijo.

Cada vez que salta una alerta:

1. **Se registra siempre** en una entidad `event` de HA, en su nivel (válvula, zona o
   instalación). Queda en el historial y el logbook de HA y sirve como disparador de
   automatizaciones.
2. **Se emite siempre** un evento de bus `irrigation_scheduler_*`, por compatibilidad.
3. **Push, según la configuración** del apartado «Errores y avisos» de ajustes: push sí/no, a qué
   móviles (subconjunto de `notify_targets`) y con qué prioridad.
4. **Tarjeta de histórico, según la configuración**: se pinta o no en la fila de su nivel.

## Niveles

| Nivel | Entidad `event` | Cuelga de | Fila en la tarjeta de histórico |
|---|---|---|---|
| Válvula | Una por válvula configurada | Dispositivo físico de la switch; si no tiene, dispositivo de la zona | Bajo la válvula |
| Zona | Una por zona | Dispositivo de la zona | Fila de la zona, una sola vez |
| Instalación | Una global | Dispositivo de la instalación | Fila «Instalación», encima de las zonas |

Las tres entidades se llaman «Alertas riego». entity_id al crearlas: `event.alertas_riego_<dispositivo>` (válvula),
`event.alertas_riego_<zona>` (zona) y `event.alertas_riego_instalacion` (instalación). Las creadas antes conservan el suyo.

## Prioridades de push

| Prioridad | Efecto en el móvil |
|---|---|
| Crítica | Suena con el móvil en silencio o en «No molestar» (iOS: requiere autorizar alertas críticas) |
| Alta | Salta el resumen programado; respeta el silencio |
| Normal | Notificación corriente |

## Catálogo

| ID | Nombre | Nivel | Cabecera del push | Prioridad por defecto | Estado | Resumen |
|---|---|---|---|---|---|---|
| `turn_on_failed` | Error encendido | Válvula | Error | Alta | Implementada: entidad event, evento de bus y push configurable | La switch no llega a `on` tras 1 intento y 3 reintentos. Se descarta el trabajo y la cola sigue. |
| `turn_off_failed` | Error apagado | Válvula | Error | Crítica (mínimo alta) | Implementada: entidad event, evento de bus y push configurable | La switch no llega a `off` tras 1 intento y 3 reintentos. Puede seguir regando. |
| `no_water` | Sin agua | Válvula | Error | Alta | Implementada: entidad event, evento de bus y push configurable | El sensor de suministro de la válvula pasa de `off` a `on`. Si riega o se enciende, se cierra como ⏸. La fila muestra «Sin agua» mientras el sensor siga en `on`. |
| `overrun_restart` | Exceso con HA parado | Válvula | Alerta | Alta | Implementada: entidad event, evento de bus y push configurable | Al arrancar HA, una válvula abierta ya pasó su fin previsto. Se apaga. |
| `overrun_running` | Exceso de tiempo | Válvula | Alerta | Alta | Implementada: entidad event, evento de bus y push configurable | El latido ve una válvula propia abierta más de 1 min pasado su fin. Se apaga. |
| `manual_overrun` | Exceso manual | Válvula | Alerta | Alta | Implementada: entidad event, evento de bus y push configurable | Una switch encendida fuera de la integración supera su `duration_min` + 1 min. Se apaga. |
| `sensor_unavailable` | Sensor caído | Zona | Alerta | Normal | Implementada: entidad event, evento de bus y push configurable | Un sensor de la zona pasa a `unavailable` o `unknown`. Solo avisa. |
| `rain_skipped` | Omitido por lluvia | Zona | Info | Normal | Implementada: entidad event, evento de bus y push configurable | Un bloque de la zona no se riega porque la lluvia pasada o prevista supera su umbral. Episodio por zona: push al abrirlo (máx. 1 por zona cada 24 h), agrupado por lote. |
| `rain_source_unavailable` | Sin datos de lluvia | Instalación | Alerta | Normal | Implementada: entidad event, evento de bus y push configurable | Al evaluar un lote, el pluviómetro o la `weather` falla. Una alerta por lote; si fallan las dos, se riega. |
| `valve_switched` | Encendido/apagado | Válvula | Info | Normal | Implementada: solo push (sin entidad event, sin evento de bus, sin marca en el histórico) | Un push al encender y otro al apagar la switch, sea cual sea el origen (programado, manual o externo). El de apagado lleva el tiempo abierta. Casilla «Histórico» bloqueada. |

La cabecera del push (Error, Alerta, Info) es la misma severidad que el color de la marca en la
tarjeta de histórico (`alerts.py` `ALERT_TYPES`, `frontend/src/shared/alert-icons.ts`).

«Implementada» significa que el tipo registra su disparo en la entidad `event`, emite su evento
de bus y envía su push según la configuración por tipo. Todos los tipos del catálogo están implementados.
