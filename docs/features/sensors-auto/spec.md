# Sensores y modo auto — especificación

> Estado: **pospuesto** (fase 6) · Última actualización: 2026-10-03
> Depende de: [`docs/overview.md`](../../overview.md).

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
  prioridad normal ([`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §7.2). Esto aplica ya desde la fase 4.

## 2. Pendiente

- Catálogo de métodos de cálculo y sus fórmulas.
- Cómo modifica `auto` el riego: tiempo, frecuencia u omisión de bloques.
- Qué hace `auto` si falta un sensor en el momento del disparo.
