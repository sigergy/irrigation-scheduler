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

## Prioridades de push

| Prioridad | Efecto en el móvil |
|---|---|
| Crítica | Suena con el móvil en silencio o en «No molestar» (iOS: requiere autorizar alertas críticas) |
| Alta | Salta el resumen programado; respeta el silencio |
| Normal | Notificación corriente |

## Catálogo

| ID | Nombre | Nivel | Prioridad por defecto | Estado | Resumen |
|---|---|---|---|---|---|
| `turn_on_failed` | La válvula no enciende | Válvula | Alta | Implementada | La switch no llega a `on` tras 1 intento y 3 reintentos. Se descarta el trabajo y la cola sigue. |
| `turn_off_failed` | La válvula no apaga | Válvula | Crítica (mínimo alta) | Implementada | La switch no llega a `off` tras 1 intento y 3 reintentos. Puede seguir regando. |
| `overrun_restart` | Tiempo excedido con HA parado | Válvula | Alta | Implementada | Al arrancar HA, una válvula abierta ya pasó su fin previsto. Se apaga. |
| `overrun_running` | Tiempo excedido con HA en marcha | Válvula | Alta | Implementada | El latido ve una válvula propia abierta más de 1 min pasado su fin. Se apaga. |
| `manual_overrun` | Encendida a mano demasiado tiempo | Válvula | Alta | Implementada | Una switch encendida fuera de la integración supera su `duration_min` + 1 min. Se apaga. |
| `sensor_unavailable` | Sensor de zona caído | Zona | Normal | Implementada | Un sensor de la zona pasa a `unavailable` o `unknown`. Solo avisa. |
| `rain_skipped` | Riego omitido por lluvia | Zona | Normal | Fase 5 | Un bloque de la zona no se riega porque la lluvia pasada o prevista supera su umbral. Un push por episodio de lluvia (máx. 1 cada 24 h). |
| `rain_source_unavailable` | Fuente de lluvia no disponible | Instalación | Normal | Fase 5 | Al evaluar un lote, el pluviómetro o la `weather` falla. Una alerta por lote; si fallan las dos, se riega. |

«Implementada» significa que hoy ya emite su evento de bus y su push. El registro en la entidad
`event` y la configuración por tipo son nuevos para las ocho.
