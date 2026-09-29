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


## 8. Revisión 2026-09-29

Decisiones nuevas de la sesión de diseño de alertas (`docs/alerts/`). **Prevalecen sobre §1-§7**
donde choquen; se integrarán en sus secciones al implementar la fase 5.

1. **Ventana de lluvia prevista: hasta el siguiente bloque de la zona.** Desaparece el parámetro
   `rain_forecast_hours` (§3.1; D26 en `00-overview.md`). Al evaluar un bloque, la lluvia prevista
   es la suma del pronóstico horario entre ahora y el siguiente bloque de esa misma zona. Un
   `rain_forecast_hours` ya guardado se ignora al cargar.
2. **Fallo de fuente (§6):** la alerta solo salta al evaluar un lote, sin episodio: una vez por
   lote (punto 11). Los recálculos periódicos (punto 9) no la disparan.
3. **Histórico suficiente (§6):** existe en el recorder un estado del `rain_sensor` en o antes de
   `now − rain_past_hours`. Una entidad excluida del recorder falla siempre.
4. **Ajustes:** al elegir la `weather_entity`, si su `supported_features` no incluye pronóstico
   horario, se avisa de que la lluvia prevista no funcionará.
5. **Entidades de lluvia (§7):**
   - por zona, en el dispositivo de la zona: `sensor` «lluvia prevista hasta el próximo riego» (mm)
     y `binary_sensor` «se omitirá el próximo riego»;
   - global, en el dispositivo de la instalación: `sensor` lluvia pasada (mm), porque
     `rain_past_hours` es global;
   - desaparecen el `binary_sensor` global «lluvia suficiente» y el `sensor` global de lluvia
     prevista.
6. **Tramos del pronóstico en los extremos de la ventana:** cuentan en proporción al trozo que cae
   dentro. Ejemplo: ventana desde 07:30, tramo 07:00-08:00 con 1.0 mm → cuenta 0.5 mm.
7. **Pronóstico más corto que la ventana (§4.2):** se suma lo disponible y se deja un aviso en el
   log. No es alerta.
8. **Siguiente bloque:** se reutiliza `next_run` (`schedule.py:31-42`).
9. **Estado de lluvia único, calculado por la integración.** Sustituye a la versión anterior de
   este punto (decisión consultando las fuentes por su cuenta).
   - La integración calcula un solo estado de lluvia: lluvia pasada, lluvia prevista por zona y
     estado de cada fuente. Las entidades de lluvia (punto 5) lo publican tal cual.
   - La decisión de omitir un bloque **lee ese estado**, sin consultas propias. Lo que muestran
     las entidades es lo que usa la decisión.
   - Recálculo: cada hora, al cambiar el `rain_sensor` y **justo antes de evaluar un bloque**, para
     que la decisión nunca use un dato viejo. Una consulta al recorder y una a
     `weather.get_forecasts` por recálculo, compartidas por todas las zonas.
   - Si una fuente falla, sus entidades pasan a `unavailable` hasta el siguiente cálculo correcto.
10. **«Omitir por lluvia» sigue siendo por zona** (`model.py:71`, `switch.py:30`). Todas las
    válvulas de la zona se omiten o riegan juntas.
11. **Lotes: un disparador por hora de inicio.** Sustituye al «mismo minuto» de §7.1.
    - Hay un disparador por cada hora de inicio distinta, no uno por zona. El **lote** son todas
      las zonas con un bloque a esa hora; se calcula desde la config (`block_runs` y
      `valves_for_block`, `schedule.py:12-20`), sin esperas ni acumuladores.
    - Por lote: se recalcula el estado de lluvia una vez (punto 9) y se decide zona por zona.
    - Un solo push de omisión por lote, con todas sus zonas omitidas, si el lote abre episodio
      (§7.1).
    - `rain_source_unavailable` salta una vez por lote, no por zona.
    - Los bloques perdidos que se evalúan al arrancar HA forman su propio lote.
12. **Unidades: las del sistema de HA** (mm o in, según su configuración).
    - Se **guarda siempre en mm** (`rain_past_threshold_mm`, `rain_forecast_threshold_mm`). Así, al
      cambiar el sistema de HA no hay que convertir nada guardado.
    - Ajustes muestra y acepta los umbrales en la unidad del sistema y convierte a mm al guardar.
    - Cada fuente se convierte a mm con su unidad (`unit_of_measurement` del `rain_sensor`, unidad de
      precipitación del pronóstico de `weather`). Unidad no reconocida → la fuente falla (§6).
    - Las entidades de lluvia se muestran en la unidad del sistema. Mecanismo (conversión propia
      o la de HA por `device_class` de precipitación): **verificar contra HA 2026.9 en el plan**.
13. **Tipo de `rain_sensor`: se deduce de su unidad.**
    - **Acumulado** (unidad de longitud: `mm`, `cm`, `in`), total o con reinicio: regla de §4.1.
    - **Intensidad** (longitud/tiempo: `mm/h`, `mm/d`, `in/h`, `in/d`): la integración calcula los
      mm integrando el histórico del recorder en la ventana. Cada estado vale hasta el siguiente
      cambio (suma escalonada). Los tramos `unavailable` o `unknown` cuentan 0.
    - Histórico suficiente: el mismo criterio para los dos tipos (punto 3).
    - Unidad no reconocida → la fuente falla (§6).
14. **Cierre extra del episodio de lluvia (§7.1).** Además de los cierres de §7.1, el episodio se
    cierra:
    - al guardar ajustes sin ninguna fuente de lluvia, o cuando ninguna zona queda con
      `rain_skip = true`;
    - si lleva **más de 24 h abierto** (fijo, sin parámetro). Se comprueba al evaluar cada lote,
      antes de decidir: si ha caducado se cierra, y la omisión de ese lote abre uno nuevo con push.
      Con lluvia de varios días hay, como mucho, un push cada 24 h.
    - El runtime guarda la hora de apertura en vez de un booleano: `rain_episode_open: bool`
      (`runtime.py:55-56`) pasa a una hora de inicio o nulo.
15. **Arranque de HA: esperar a las fuentes.** Aplica solo al lote de bloques perdidos que se
    recupera en `_async_on_started` (`manager.py:96-99`, `async_at_started`).
    - Si hay bloques perdidos que evaluar y alguna fuente configurada falla, se reintenta cada 30 s
      durante un máximo de **5 min** (fijos, sin parámetro). En cuanto todas responden, se evalúa.
    - Si pasados los 5 min alguna sigue fallando, se decide con §6 y salta
      `rain_source_unavailable`, con su push según la configuración de «Errores y avisos» (por
      defecto, activado).
    - Sin bloques perdidos no hay espera.
16. **Decisión 10 min antes del bloque.** Resuelve el hueco del «próximo riego».
    - Cada lote programado (punto 11) se evalúa **10 min antes** de su hora (fijo, sin
      parámetro). Ahí se recalcula el estado de lluvia, se decide zona por zona y la decisión
      **queda fijada**. La ventana de lluvia prevista empieza en ese momento (punto 1).
    - Si se omite, en ese momento salen `rain_skipped` y su push (§7.1).
    - A la hora del bloque no se vuelve a evaluar: si se omitió no se riega; si no, se riega como
      hoy.
    - Las decisiones fijadas se guardan en el runtime; un reinicio de HA entre la evaluación y la
      hora del bloque no las pierde.
    - `ZoneNextRunSensor` salta los bloques ya omitidos y muestra el siguiente. El `binary_sensor`
      «se omitirá el próximo riego» (punto 5) muestra `on` con la decisión fijada.
    - Si un bloque se crea o se cambia de hora con menos de 10 min de margen, se evalúa a su hora.
    - Bloques perdidos al arrancar HA: se evalúan en el momento (punto 15). «Regar ahora» no se
      evalúa nunca (§5).
