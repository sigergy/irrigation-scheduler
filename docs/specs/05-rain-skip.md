# 05 · Omisión de riego por lluvia

> Estado: **implementada** · Fase 5 · Última actualización: 2026-09-29 (§8 prevalece sobre §1-§7)
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
| `rain_forecast_hours` | int | **6–24; defecto 24** (§8.17). Hoy 1–48 con defecto 12 (`validation.py:113`, `const.py:27`) |
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

- **Entidades:** sustituidas por §8.5, §8.18, §8.21 y §8.28. Versión original:
  - `binary_sensor` «lluvia suficiente»: `on` si ahora mismo se omitiría un bloque;
  - `sensor` lluvia pasada (mm);
  - `sensor` lluvia prevista (mm).
- **Evento HA:** `irrigation_scheduler_block_skipped`, con `zone_id`, `start_time`,
  `reason` (`rain_past` | `rain_forecast`) y los mm medidos.
- **Push** (prioridad normal):
  - riego omitido por lluvia (§7.1);
  - fuente de lluvia no disponible.

### 7.1 Agrupación del push de omisión

> Sustituido en parte por §8.19 (episodio **por zona**) y §8.20 (un push por lote). Precisado por
> §8.11 (lotes) y §8.14 (cierres extra).

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


## 8. Revisión 2026-09-29

Decisiones nuevas de la sesión de diseño de alertas (`docs/alerts/`). **Prevalecen sobre §1-§7**
donde choquen; se integrarán en sus secciones al implementar la fase 5.

1. **Ventana de lluvia prevista: `rain_forecast_hours` global.** *Sustituido por §8.17.* Se
   mantiene el parámetro con rango 6–24 h (§3.1).
2. **Fallo de fuente (§6):** la alerta solo salta al evaluar un lote, sin episodio: una vez por
   lote (punto 11). Los recálculos periódicos (punto 9) no la disparan.
3. **Histórico suficiente (§6):** existe en el recorder un estado del `rain_sensor` en o antes de
   `now − rain_past_hours`. Una entidad excluida del recorder falla siempre.
4. **Ajustes:** al elegir la `weather_entity`, si su `supported_features` no incluye pronóstico
   horario, se avisa de que la lluvia prevista no funcionará.
5. **Entidades de lluvia (§7):** *precisado por §8.18 y §8.21.*
   - por zona, en el dispositivo de la zona: `binary_sensor` «se omitirá el próximo riego»;
   - global, en el dispositivo de la instalación: `sensor` lluvia pasada (últimas
     `rain_past_hours`) y `sensor` lluvia prevista (próximas `rain_forecast_hours`), en mm;
   - desaparece el `binary_sensor` global «lluvia suficiente». No hay `sensor` de lluvia por zona.
6. **Tramos del pronóstico en los extremos de la ventana:** cuentan en proporción al trozo que cae
   dentro. Ejemplo: ventana desde 07:30, tramo 07:00-08:00 con 1.0 mm → cuenta 0.5 mm.
7. **Pronóstico más corto que la ventana (§4.2):** se suma lo disponible y se deja un aviso en el
   log. No es alerta.
8. **Siguiente bloque:** se reutiliza `next_run` (`schedule.py:31-42`) para el «próximo riego»
   (§8.21).
9. **Estado de lluvia único, calculado por la integración.** Sustituye a la versión anterior de
   este punto (decisión consultando las fuentes por su cuenta).
   - La integración calcula un solo estado de lluvia: lluvia pasada, lluvia prevista (ventana
     global, §8.17), pronóstico horario en caché, estado de cada fuente y predicción por zona
     (§8.21). Las entidades de lluvia (punto 5) lo publican tal cual.
   - La decisión de omitir un bloque **lee ese estado**, sin consultas propias. En la evaluación
     (T−10), los `sensor` globales muestran exactamente los mm que usa la decisión.
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
    - Un solo push de omisión por lote, con las zonas del lote que abren episodio (§8.19, §8.20).
    - `rain_source_unavailable` salta una vez por lote, no por zona.
    - Los bloques perdidos que se evalúan al arrancar HA forman su propio lote.
12. **Unidades: las del sistema de HA** (mm o in, según su configuración).
    - Se **guarda siempre en mm** (`rain_past_threshold_mm`, `rain_forecast_threshold_mm`). Así, al
      cambiar el sistema de HA no hay que convertir nada guardado.
    - Ajustes muestra y acepta los umbrales en la unidad del sistema y convierte a mm al guardar.
    - Cada fuente se convierte a mm con su unidad (`unit_of_measurement` del `rain_sensor`, unidad de
      precipitación del pronóstico de `weather`). Unidad no reconocida → la fuente falla (§6).
    - Las entidades de lluvia se muestran en la unidad del sistema. Mecanismo:
      - las fuentes convierten a mm por su cuenta (`rain.py:19-20`, `rain.py:86-101`);
      - los `sensor` globales (`RainPastSensor`, `RainForecastSensor`, `sensor.py:99`, `119`) guardan
        mm y HA los convierte por su `device_class` de precipitación (`sensor.py:94-95`; HA 2026.9.4,
        `util/unit_system.py:368-369`);
      - los umbrales de ajustes se convierten en el panel (`settings-view.ts:12-17`).
13. **Tipo de `rain_sensor`: se deduce de su unidad.**
    - **Acumulado** (unidad de longitud: `mm`, `cm`, `in`), total o con reinicio: regla de §4.1.
    - **Intensidad** (longitud/tiempo: `mm/h`, `mm/d`, `in/h`, `in/d`): la integración calcula los
      mm integrando el histórico del recorder en la ventana. Cada estado vale hasta el siguiente
      cambio (suma escalonada). Los tramos `unavailable` o `unknown` cuentan 0.
    - Histórico suficiente: el mismo criterio para los dos tipos (punto 3).
    - Unidad no reconocida → la fuente falla (§6).
14. **Cierre extra del episodio de lluvia (§7.1).** *Pasa a episodio por zona: ver §8.19.*
    Además de los cierres de §7.1, el episodio de una zona se cierra:
    - al guardar ajustes sin ninguna fuente de lluvia (cierra los de todas las zonas);
    - cuando esa zona pasa a `rain_skip = false`, o se borra;
    - si lleva **más de 24 h abierto** (fijo, sin parámetro). Se comprueba al evaluar el bloque de
      la zona, antes de decidir: si ha caducado se cierra, y la omisión de ese bloque abre uno nuevo
      con push. Con lluvia de varios días hay, como mucho, un push por zona cada 24 h.
    - El runtime guarda una hora de apertura por zona: `rain_episode_open: bool`
      (`runtime.py:55-56`) pasa a un diccionario `zone_id → hora de apertura`. Sin entrada =
      episodio cerrado.
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
      **queda fijada**. La ventana de lluvia prevista empieza en ese momento (punto 17).
    - Si se omite, en ese momento salen `rain_skipped` y, si abre episodio, su push (§8.19, §8.20).
    - A la hora del bloque no se vuelve a evaluar: si se omitió no se riega; si no, se riega como
      hoy.
    - Las decisiones fijadas se guardan en el runtime; un reinicio de HA entre la evaluación y la
      hora del bloque no las pierde.
    - `ZoneNextRunSensor` y el `binary_sensor` «se omitirá el próximo riego»: ver §8.21.
    - Si un bloque se crea o se cambia de hora con menos de 10 min de margen, se evalúa a su hora.
    - Bloques perdidos al arrancar HA: se evalúan en el momento (punto 15). «Regar ahora» no se
      evalúa nunca (§5).

### 8.1 Ampliación 2026-09-29 (revisión de huecos)

Precisan los puntos 1-16. Prevalecen sobre ellos donde choquen.

17. **Ventana de lluvia prevista: global, `rain_forecast_hours` desde la evaluación.** Sustituye
    al punto 1.
    - Al evaluar un lote (T−10, punto 16), la lluvia prevista es la suma del pronóstico horario de
      las próximas `rain_forecast_hours` desde ese momento. Es la misma ventana para todas las zonas
      y la misma que publica el `sensor` global de lluvia prevista (§8.18).
    - Bloques perdidos al arrancar (punto 15) y bloques del punto 24: desde el momento de la
      evaluación.
    - `rain_forecast_hours`: 6–24 h, defecto 24 (§3.1). Un valor guardado fuera de rango se ajusta
      al extremo más cercano al cargar (hoy se admite 1–48, `validation.py:113`).
    - Ejemplo (ventana 6 h, umbral 5 mm): riego a las 20:00 → se evalúa a las 19:50 y suma de 19:50
      a 01:50. 6 mm → se omite; 3 mm → se riega.
18. **Sensores globales de lluvia.** En el dispositivo de la instalación:
    - `sensor` lluvia pasada: mm caídos en las últimas `rain_past_hours` hasta ahora;
    - `sensor` lluvia prevista: mm previstos en las próximas `rain_forecast_hours` desde ahora.
    - Son informativos: su ventana se mueve con el reloj. Coinciden con la decisión en el momento
      de la evaluación (punto 9). No hay sensores de lluvia por zona.
19. **Episodio de lluvia por zona.** Sustituye al episodio global de §7.1.
    - Cada zona tiene su episodio: **abierto** o **cerrado**.
    - **Abre** el episodio de una zona la omisión de un bloque de esa zona con su episodio cerrado.
      Abrir envía push (punto 20). Con el episodio abierto, las omisiones siguientes de la zona no
      envían push.
    - **Cierra** el episodio de una zona:
      - un bloque de esa zona se evalúa y **no** se omite porque la lluvia queda por debajo de los
        umbrales. Regar porque fallan todas las fuentes (§6) **no** cierra;
      - lleva más de 24 h abierto, esa zona pasa a `rain_skip = false` o se borra (punto 14);
      - se guardan ajustes sin ninguna fuente de lluvia: cierra todos.
    - Runtime: un diccionario `zone_id → hora de apertura` (punto 14). Un reinicio de HA no repite
      el push.
    - `rain_skipped` (entidad `event` y evento de bus) sale igualmente una vez por bloque omitido.
20. **Un push por lote con las zonas que abren episodio.** Sustituye al push y al ejemplo de §7.1.
    - Tras decidir un lote, si alguna zona ha abierto episodio, sale **un** push con todas ellas.
      Las zonas omitidas con el episodio ya abierto no salen.
    - Cada zona lleva su hora, sus mm y su motivo (`caídos` = `rain_past`, `previstos` =
      `rain_forecast`).
    - Ejemplo: «Riego saltado por lluvia: Huerto 20:00 (6.2 mm previstos), Césped 20:00 (8.0 mm
      caídos). No se repite el aviso hasta el próximo riego».
21. **Predicción del próximo riego.** Por zona, antes de la evaluación.
    - **Próximo bloque P** de la zona: el primero de `next_run` (punto 8) que no tenga decisión
      fijada «omitir».
    - **Antes de T−10 de P**: la integración predice la decisión de P con el estado de lluvia
      actual (punto 9): lluvia pasada de ahora y pronóstico en caché sumado en la ventana que usará
      P (desde T−10 de P durante `rain_forecast_hours`). Sin consultas extra: se recalcula con cada
      recálculo del estado.
    - **Desde T−10 de P**: se muestra la **decisión fijada**.
    - `binary_sensor` «se omitirá el próximo riego»: `on` si la predicción o la decisión de P es
      «omitir». Atributos: hora de P, mm y motivo, y si es predicción o decisión.
    - `ZoneNextRunSensor`: si P se omite (predicho o decidido), muestra el bloque siguiente a P.
      Ese bloque no se predice: se muestra tal cual está programado.
    - La predicción puede cambiar hasta T−10: es orientativa. Solo la decisión fija dispara
      `rain_skipped` y push.
    - Zona con `rain_skip = false`, sin fuentes o con todas fallando: `off`, sin predicción.
    - Ejemplo (6 h, 5 mm, riegos 20:00 y 07:00). A las 15:00 el pronóstico da 7 mm entre 19:50 y
      01:50: «se omitirá» `on`, próximo riego 07:00. A las 18:00 baja a 3 mm: `off`, próximo riego
      20:00. A las 19:50 se fija con 3 mm: se riega.
22. **Cambios después de fijar la decisión.** Entre la evaluación y la hora del bloque:
    - cambiar la zona (guardarla, o `rain_skip`, `enabled` o `mode` desde sus entidades) o sus
      bloques **anula** la decisión de esa zona; el bloque se evalúa a su hora (como el último
      caso del punto 16);
    - quitar la última fuente de lluvia anula todas las decisiones «omitir»: esos bloques riegan;
    - borrar la zona borra sus decisiones;
    - si la decisión anulada ya había emitido `rain_skipped`, no se retira: el registro es
      histórico.
23. **Clave de la decisión fijada.** Se guarda en el runtime con la clave
    `(zone_id, "HH:MM", fecha del bloque)`, no con el índice de bloque, que cambia al reordenar
    `start_times`. Las decisiones de bloques ya pasados se purgan al pasar su hora.
24. **HA caído a T−10 y arrancado antes de T.** El bloque no es perdido y no tiene decisión. Al
    arrancar, los bloques con hora en `(ahora, ahora + 10 min]` sin decisión se evalúan en ese
    momento, con las fuentes tal como estén (sin la espera del punto 15).
25. **Bloque perdido con decisión fijada.** HA cae entre la evaluación y la hora del bloque y
    arranca después. La recuperación (03 §5.2) respeta la decisión: «omitir» no riega y no repite
    `rain_skipped`; «regar» riega sin evaluar. Solo los bloques perdidos **sin** decisión pasan
    por el punto 15.
26. **Día del bloque.** Un bloque entre 00:00 y 00:09 se evalúa el día anterior. Las condiciones
    de disparo (`block_runs`, `schedule.py:18-20`) se comprueban con el día **del bloque**, no con
    el de la evaluación.
27. **Coste del recálculo (punto 9).**
    - Los cambios del `rain_sensor` se agrupan con un debounce de **60 s** (fijo): una ráfaga de
      cambios da un solo recálculo.
    - El recálculo previo a un lote no espera al debounce.
    - La espera del arranque (punto 15) corre en segundo plano: no retrasa los disparos de las
      zonas ni el latido (`manager.py:96-104`).
28. **Casos menores.**
    - El paso de una zona a `rain_skip = false` (punto 14) se detecta al guardar la zona y al
      cambiar la switch `rain_skip`.
    - Una fuente **no configurada** no crea sus entidades de lluvia: sin `rain_sensor` no hay
      `sensor` global de lluvia pasada; sin `weather_entity` no hay `sensor` global de lluvia
      prevista. El `binary_sensor` por zona existe si hay al menos una fuente.
    - Los datos de `rain_skipped` son el evento de bus `irrigation_scheduler_block_skipped`
      (`zone_id`, `start_time`, `date`, `reason`, `rain_mm`, `past_mm`, `forecast_mm`;
      `manager.py:512-527`) y los de `rain_source_unavailable`, el evento
      `irrigation_scheduler_rain_source_unavailable` (`failures[]` con `source`, `entity_id`,
      `reason`, y `watering`; `manager.py:557-571`). Tablas de campos: `docs/alerts/spec.md` §7 y §8.
