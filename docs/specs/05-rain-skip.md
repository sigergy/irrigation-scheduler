# 05 · Omisión de riego por lluvia

> Estado: **decisiones cerradas** · Fase 5 · Última actualización: 2026-09-28
> Depende de: `00-overview.md` (modelo §4) y `03-valves-execution.md` (disparo §2, reinicio §5, notificaciones §7).

## 1. Propósito

La integración sabe si ha llovido o si va a llover. Cuando se supera un umbral configurado, omite
los riegos programados.

## 2. Fuentes de lluvia

Hay dos fuentes independientes y las dos son opcionales. Si no se configura ninguna, la función
está apagada.

| Fuente | Entidad HA | Dato |
|---|---|---|
| **Lluvia pasada** | `sensor` de precipitación acumulada (mm), p. ej. un pluviómetro | Lluvia caída en las últimas X h |
| **Lluvia prevista** | `weather` | Suma de `precipitation` del pronóstico horario en las próximas Y h |

Una entidad `weather` solo da pronóstico, no la lluvia ya caída. Por eso la lluvia pasada necesita
un `sensor` aparte.

## 3. Configuración

### 3.1 Global (ajustes del panel)

| Parámetro | Tipo | Regla |
|---|---|---|
| `rain_sensor` | `sensor.*` \| null | Opcional |
| `rain_past_hours` | int | 1–24; **defecto 24** |
| `rain_past_threshold_mm` | número | > 0; **defecto 5** |
| `weather_entity` | `weather.*` \| null | Opcional |
| `rain_forecast_hours` | int | 1–48; **defecto 12** |
| `rain_forecast_threshold_mm` | número | > 0; **defecto 5** |

### 3.2 Por zona

| Parámetro | Tipo | Defecto | Uso |
|---|---|---|---|
| `rain_skip` | bool | `true` | `false` en un invernadero o una zona cubierta: esa zona nunca se omite por lluvia |

## 4. Regla de decisión

Al disparar un bloque de una zona con `rain_skip = true`, el bloque **se omite** si se cumple
**cualquiera** de estas condiciones:

1. **Pasada:** `lluvia_pasada ≥ rain_past_threshold_mm`, donde `lluvia_pasada` es el valor actual
   del `rain_sensor` menos su valor de hace `rain_past_hours`, leído del histórico (recorder).
   Si el contador se reinicia dentro de la ventana, se suman los tramos crecientes.
2. **Prevista:** `lluvia_prevista ≥ rain_forecast_threshold_mm`, donde `lluvia_prevista` es la suma
   de `precipitation` de `weather.get_forecasts` (tipo `hourly`) para las próximas
   `rain_forecast_hours`.
   Si el pronóstico cubre menos horas de las configuradas, se suma lo disponible y se registra un
   aviso. Esto **no** cuenta como fallo de la fuente (§6).

Si se cumplen las dos, el motivo que se registra es `rain_past`.

## 5. Ejecuciones afectadas

| Ejecución | ¿Se evalúa la lluvia? |
|---|---|
| Bloque programado | Sí, en el momento del disparo |
| Bloque perdido que se recupera al arrancar HA (`03-valves-execution.md` §5.2) | Sí, en el momento del arranque |
| «Regar zona ahora» | No: la orden manual manda |
| «Regar válvula ahora» | No: la orden manual manda |

Un bloque omitido no genera trabajos. Las colas no cambian.

## 6. Fallo de una fuente

Una fuente falla si:
- la entidad está `unavailable` o `unknown`;
- no hay histórico suficiente (lluvia pasada);
- la entidad `weather` no da pronóstico horario (lluvia prevista).

| Situación | Decisión |
|---|---|
| Falla **una** fuente y la otra es válida | La que falla se ignora; se decide solo con la válida (§4) |
| Fallan **todas** las fuentes configuradas | **Se riega**: el bloque no se omite |
| Solo hay una fuente configurada y falla | **Se riega** (equivale a «fallan todas») |

Cada fallo de fuente se notifica con prioridad normal (§7).

## 7. Entidades, eventos y notificaciones

- **Entidades globales:**
  - `binary_sensor` «lluvia suficiente»: `on` si ahora mismo se omitiría un bloque;
  - `sensor` lluvia pasada (mm);
  - `sensor` lluvia prevista (mm).
- **Evento HA:** `irrigation_scheduler_block_skipped`, con `zone_id`, `start_time`,
  `reason` (`rain_past` | `rain_forecast`) y los mm medidos.
- **Push** (prioridad normal):
  - riego omitido por lluvia (§7.1);
  - fuente de lluvia no disponible.

### 7.1 Agrupación del push de omisión

- La omisión se decide **por bloque**, nunca por válvula. Una zona con 30 válvulas genera como
  máximo una omisión por bloque, no 30.
- Se envía **un único push por episodio de lluvia**:
  - **Empieza un episodio** con la primera omisión por lluvia. En ese momento se envía el push, que
    incluye todas las omisiones decididas en ese mismo minuto (varias zonas con la misma hora, o
    los bloques perdidos evaluados al arrancar HA).
  - **Durante el episodio**, las omisiones siguientes no envían push.
  - **Termina el episodio** cuando un bloque de una zona con `rain_skip = true` se evalúa y **no**
    se omite, porque la lluvia queda por debajo de los umbrales. La siguiente omisión abre un
    episodio nuevo con su push.
  - Un bloque que se riega porque fallan todas las fuentes (§6) **no** cierra el episodio.
  - El estado del episodio (abierto o cerrado) se persiste en el runtime, para que un reinicio de
    HA no genere un push repetido.
- El evento HA `irrigation_scheduler_block_skipped` se emite igualmente una vez por bloque
  omitido, porque es para automatizaciones y no llega al móvil.
- Ejemplo de push: «Riego omitido por lluvia (6.2 mm previstos): Huerto 07:00, Césped 07:00,
  Setos 07:00. No se avisará de más omisiones hasta que vuelva a regarse».

