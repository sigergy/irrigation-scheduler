# 4. Retomar el riego tras un reinicio

> Estado: **en diseño** · 2026-10-06
> Depende de: [02-shutdown-close](../02-shutdown-close/spec.md),
> [03-remaining-time](../03-remaining-time/spec.md).

## 1. Objetivo

Al volver HA tras un reinicio ordenado, decidir si una válvula en pausa completa el tiempo que le
faltaba o se da por terminada.

## 2. Decisiones

Tomadas con el usuario el 2026-10-06.

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

## 3. Puntos abiertos

Se deciden en el brainstorming de este cambio:

- Si se pausa y retoma un riego manual igual que uno programado.
- Qué pasa si al retomar la zona o la válvula está deshabilitada, o es hora de silencio.
