# 04 · Sensores y modo `auto`

> Estado: **pospuesto** (última fase) · Fase 6 · Última actualización: 2026-09-28
> Depende de: `00-overview.md`.

## 1. Decidido

- Sensores opcionales por zona:

| Sensor | Tipo HA | Obligatorio |
|---|---|---|
| Temperatura | `sensor` | No |
| Humedad ambiental | `sensor` | No |
| Humedad del suelo | `sensor` | No |

- Los métodos de cálculo disponibles dependen de los sensores configurados. Una zona sin
  sensores no tiene ningún método.
- `auto` está deshabilitado si la zona no tiene método (V8).
- Si un sensor configurado pasa a `unavailable` o `unknown`, se envía una notificación push de
  prioridad normal (`03-valves-execution.md` §7.2). Esto aplica ya desde la fase 4.

## 2. Pendiente

- Catálogo de métodos de cálculo y sus fórmulas.
- Cómo modifica `auto` el riego: tiempo, frecuencia u omisión de bloques.
- Qué hace `auto` si falta un sensor en el momento del disparo.
