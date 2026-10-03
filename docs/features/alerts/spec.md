# Alertas — especificación por tipo

> Estado: **en diseño** · Última actualización: 2026-09-29
> Resumen y catálogo: [`README.md`](README.md). Rutas de código relativas a
> `custom_components/irrigation_scheduler/`.

## 0. Común a todas

### 0.1 Ciclo de una alerta

1. Un componente detecta la condición (ver cada alerta).
2. Dispara la entidad `event` de su nivel con el ID de la alerta como `event_type` y sus datos
   (§0.3). **Siempre**, sea cual sea la configuración.
3. Emite su evento de bus (ver cada alerta). **Siempre.**
4. Si la configuración del tipo tiene push activo y hay destinos, envía el push con la prioridad
   configurada a los móviles configurados. El envío lo hace `async_push` (`notify.py:109-136`),
   llamado desde `IrrigationManager._async_alert` (`manager.py:791-827`), que resuelve destinos y
   prioridad con `alerts.push_targets` (`alerts.py:80-87`) y `alerts.alert_priority`
   (`alerts.py:76-77`). La cabecera del push es la severidad del tipo (`AlertType.severity`,
   `alerts.py:36-48`): **Error**, **Alerta** o **Info**, la misma que el color de su marca en el
   histórico (§0.5).
5. La tarjeta de histórico la pinta en la fila de su nivel si el tipo tiene «mostrar en histórico».

### 0.2 Configuración por tipo

| Ajuste | Valores | Defecto |
|---|---|---|
| Push | sí / no | sí |
| Móviles | subconjunto de `notify_targets` (`model.py:120`) | todos |
| Prioridad | crítica / alta / normal | la del catálogo |
| Mostrar en histórico | sí / no | sí |

Suelo: `turn_off_failed` no admite prioridad normal.

Se guarda en `Settings.alerts`, un `AlertConfig` por ID; un ID ausente usa estos valores por
defecto. Detalle: `../superpowers/specs/2026-09-29-incidents-design.md`, «Modelo de datos».

### 0.3 Datos de la entidad `event`

Los atributos de cada disparo son exactamente los datos del evento de bus (`Alert.data`,
`alerts.py:42-50`; se envían en `manager.py:807-808`).

Entidades (`event.py`; unique_id y dispositivo en `entity.py`):

- válvula: unique_id `<zone_id>_valve_alerts_<switch>` (`event.py:93`, `entity.py:88`), nombre
  «Alertas <válvula>», en el dispositivo de la switch; si no tiene, en el de la zona
  (`entity.py:91-96`);
- zona: `<zone_id>_alerts` (`event.py:104`, `entity.py:36`);
- instalación: `installation_alerts` (`event.py:117`, `entity.py:57`).

### 0.4 Reintentos de switch

`turn_on_failed` y `turn_off_failed` dependen de `async_set_valve` (`valves.py:17-34`): llama al
servicio `switch.turn_on`/`turn_off`, espera `VERIFY_DELAY_S` = 2 s (`const.py:54`) y lee el
estado. Repite hasta 1 + `SWITCH_RETRIES` = 4 intentos (`const.py:53`). Un estado `unavailable`
cuenta como fallo. Cada intento fallido deja un `warning` en el log (`valves.py:27`); eso **no** es
una alerta.

---

### 0.5 Texto del push

- Cabecera: `Error`, `Alerta` o `Info` según la severidad del tipo (`notify.py:27-29`). En inglés:
  `Error`, `Warning`, `Info`.
- Cuerpo: `Zona · Válvula: qué pasa. Qué hacer.` La parte «qué hacer» solo va en los tipos que
  piden acción al usuario: `turn_on_failed`, `turn_off_failed`, `no_water`, `sensor_unavailable` y
  `rain_source_unavailable`.
- `{time}` es la hora del envío (`HH:MM`), la pone `async_push` (`notify.py:126`).
- Textos en `MESSAGES` (`notify.py:24-86`), en español e inglés según el idioma de HA.

| Severidad | Cabecera | Color de la marca | Tipos |
|---|---|---|---|
| `error` | Error | Rojo | `turn_on_failed`, `turn_off_failed`, `no_water` |
| `warning` | Alerta | Naranja | `overrun_restart`, `overrun_running`, `manual_overrun`, `sensor_unavailable`, `rain_source_unavailable` |
| `info` | Info | Azul | `rain_skipped`, `valve_switched` (sin marca) |

---

## 1. `turn_on_failed` — Error encendido

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_error` con `action: "turn_on"` (`const.py:78`) |
| Cabecera del push | Error |
| Texto de push | «{zone} · {entity}: no enciende ({time}). Se salta su riego. Revisa la válvula.» (`notify.py:31`) |
| Spec de origen | `docs/specs/03-valves-execution.md` §6, §7.2 |

**Cuándo salta.** Al abrir una válvula de un trabajo de la cola, la switch no llega a `on` tras
los 4 intentos (§0.4).

**Disparadores.** Todo trabajo que pasa por la cola: bloque programado, bloque perdido recuperado
al arrancar, «regar zona ahora» y «regar válvula ahora».

**Componente que lo evalúa.** `IrrigationManager._async_open_job` (`manager.py:672-698`): si
`async_set_valve(..., turn_on=True)` devuelve `False`, llama a `_async_valve_error(..., True)`
(`manager.py:697-698`, `774-789`).

**Acción de la integración.** Descarta el trabajo, libera el hueco y la cola sigue con el
siguiente (`manager.py:682-694`).

**Datos.** `zone_id`, `entity_id`, `action`, `priority` (`manager.py:782-788`).

**Repetición.** Una alerta por trabajo fallido. Sin agrupación.

---

## 2. `turn_off_failed` — Error apagado

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Crítica. **No admite normal** |
| Evento de bus | `irrigation_scheduler_valve_error` con `action: "turn_off"` (`const.py:78`) |
| Cabecera del push | Error |
| Texto de push | «{zone} · {entity}: no se apaga ({time}). Puede seguir regando. Ciérrala a mano ya.» (`notify.py:32-34`) |
| Spec de origen | `docs/specs/03-valves-execution.md` §6, §7.2 |

**Cuándo salta.** Al apagar una válvula, la switch no llega a `off` tras los 4 intentos (§0.4).

**Disparadores y componente que lo evalúa.**

| Disparador | Código |
|---|---|
| Fin del tiempo programado | `_async_close_due` → `_async_finish_close` (`manager.py:720-749`) |
| Pausar, detener (válvula, zona o todo) | `_async_pause` (`manager.py:1065-1098`) → `_async_finish_close` / `_async_close_manual` |
| Borrar una zona con válvulas abiertas | `async_delete_zone` (`manager.py:910-935`) → `_async_pause` |
| Cancelación mientras abría | `_async_open_job` (`manager.py:695-696`) → `_async_finish_close` |
| Latido: tiempo excedido o encendida a mano | `_async_heartbeat` (`manager.py:250-253`) → `_async_finish_close` / `_async_close_manual` (`manager.py:764-772`) |
| Arranque de HA: tiempo excedido | `_async_recover` (`manager.py:184`, `196-197`) |

Todos acaban en `_async_valve_error(..., False)` (`manager.py:774-789`).

**Acción de la integración.** Libera el hueco igualmente (`manager.py:742-748`); la válvula puede
seguir regando.

**Borrado de zona.** `async_delete_zone` (`manager.py:910-935`) no borra la zona hasta que sus
válvulas están apagadas, para que la entidad `event` de la válvula siga existiendo si el apagado
falla:

1. Detiene la zona y envía la orden de apagado a sus válvulas con `_async_pause`
   (`manager.py:914`).
2. Si alguna falla, **la zona no se borra**: salta `turn_off_failed` en la entidad `event` de la
   válvula, y `async_delete_zone` lanza `ZoneDeleteError` con el código `valves_not_off`
   (`manager.py:915-917`, `const.py:76`).
3. Con el lock tomado, si una apertura en curso o un bloque disparado durante el apagado dejó
   válvulas abiertas o abriéndose, lanza `ZoneDeleteError` con el código `zone_busy`
   (`manager.py:918-923`, `const.py:75`).
4. Si no, borra la zona (`manager.py:927`).

El comando WS `delete_zone` (`websocket.py:146-154`) devuelve el código como código de error y los
nombres de las válvulas afectadas como mensaje (`websocket.py:110-113`). El panel lo muestra en
un modal emergente con las válvulas que no apagaron.

**Datos.** `zone_id`, `entity_id`, `action`, `priority`.

**Repetición.** Una alerta por intento de apagado fallido. Puede coincidir con `overrun_restart`,
`overrun_running` o `manual_overrun` si el apagado que estas provocan también falla.

---

## 3. `overrun_restart` — Exceso con HA parado

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_overrun` (`const.py:79`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: más de {minutes} min encendida mientras HA estaba caído.» (`notify.py:38`) |
| Spec de origen | `docs/specs/03-valves-execution.md` §5.2, §7.2 |

**Cuándo salta.** Al arrancar HA, una válvula del runtime persistido tiene `ends_at` ya pasado.

**Disparador.** Arranque de HA (`async_at_started`, `manager.py:144`).

**Componente que lo evalúa.** `IrrigationManager._async_recover` (`manager.py:179-226`): condición
`now >= valve.ends_at` (`manager.py:184`).

**Acción de la integración.** Quita la válvula del runtime y la apaga. Si el apagado falla, salta
además `turn_off_failed`.

**Datos.** `zone_id`, `entity_id` (`manager.py:193`). El push lleva además `{minutes}`: los
minutos programados de la válvula, `ends_at − started_at` (`manager.py:194`).

**Repetición.** Una por válvula excedida en cada arranque.

---

## 4. `overrun_running` — Exceso de tiempo

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_overrun` (`const.py:79`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: abierta más de lo previsto. Apagada a las {time}.» (`notify.py:39`) |
| Spec de origen | `docs/specs/03-valves-execution.md` §5.3.1, §7.2 |

**Cuándo salta.** Una válvula gestionada por la integración sigue abierta más de `OVERRUN_MARGIN`
= 1 min (`const.py:60`) después de su `ends_at`: su temporizador de cierre no actuó.

**Disparador.** Latido cada `HEARTBEAT_INTERVAL` = 5 min (`const.py:57`).

**Componente que lo evalúa.** `IrrigationManager._async_heartbeat` (`manager.py:227-270`):
condición `now > valve.ends_at + OVERRUN_MARGIN` (`manager.py:239`).

**Acción de la integración.** Apaga la válvula. Si el apagado falla, salta además
`turn_off_failed`.

**Datos.** `zone_id`, `entity_id` (`manager.py:260`).

**Repetición.** Una por válvula y latido en que se detecta. La válvula sale de `open_valves` al
cerrarse, así que no se repite en el latido siguiente.

---

## 5. `manual_overrun` — Exceso manual

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_overrun` con `manual: true` (`const.py:79`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: más de {minutes} min encendida a mano. Apagada a las {time}.» (`notify.py:40`) |
| Spec de origen | `docs/specs/03-valves-execution.md` §5.3.2, §7.2 |

**Cuándo salta.** Una switch configurada está en `on` fuera de la gestión de la integración y
lleva encendida más de su `duration_min` + `OVERRUN_MARGIN`.

**Disparador.** Latido cada 5 min.

Lo normal es que no salte. Al pasar a `on`, `_track_manual` programa el apagado en
`last_changed + duration_min` (`_manual_ends`), y `_async_manual_due` lo ejecuta sin alerta
propia: solo el push `valve_switched` de apagado. Esta alerta queda como red de seguridad si el
temporizador no actúa.

**Componente que lo evalúa.** `IrrigationManager._manual_on` (`manager.py:751-762`) detecta las
switch en `on` que no están abiertas, abriéndose ni cerrándose; `_async_heartbeat`
(`manager.py:242-246`) compara con `state.last_changed`.

**Acción de la integración.** Apaga la switch con `_async_close_manual` (`manager.py:764-772`), sin
ocupar hueco. Si falla, salta además `turn_off_failed`.

**Datos.** `zone_id`, `entity_id`, `manual: true` (`manager.py:268`); el push lleva los minutos
(`manager.py:269`).

**Repetición.** Una por switch y latido.

---

## 6. `sensor_unavailable` — Sensor caído

| | |
|---|---|
| Nivel | Zona |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Normal |
| Evento de bus | `irrigation_scheduler_sensor_unavailable` (`const.py:80`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: sensor sin datos desde las {time}. Revisa el sensor.» (`notify.py:35`) |
| Spec de origen | `docs/specs/03-valves-execution.md` §7.2 |

**Cuándo salta.** Un sensor de la zona (`temperature`, `humidity`, `soil_moisture`;
`const.py:29`) pasa de un estado válido a `unavailable` o `unknown`.

**Disparador.** Cambio de estado del sensor, escuchado con `async_track_state_change_event`
(`manager.py:279-284`).

**Componente que lo evalúa.** `IrrigationManager._async_sensor_changed` (`manager.py:361-376`). No
salta si el estado anterior ya era `unavailable`/`unknown` (`manager.py:368-369`).

**Acción de la integración.** Ninguna; solo avisa.

**Datos.** `zone_id`, `entity_id` del sensor, `state` (`manager.py:374`). El push no muestra el
estado: dice «sin datos» tanto para `unavailable` como para `unknown`.

**Repetición.** Una por transición a estado malo. Si el sensor vuelve y cae otra vez, salta de
nuevo.

---

## 7. `rain_skipped` — Omitido por lluvia

| | |
|---|---|
| Nivel | Zona |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Normal |
| Evento de bus | `irrigation_scheduler_block_skipped` (`const.py:81`) |
| Cabecera del push | Info |
| Texto de push | «Riego saltado por lluvia: {zones}. No se repite el aviso hasta el próximo riego.»; cada zona con `rain_zone` (`notify.py:41`, `45`) |
| Spec de origen | `docs/specs/05-rain-skip.md` §4, §5, §7 y §8 |

**Cuándo salta.** Al evaluar un bloque de una zona con `rain_skip = true` (ajuste por zona,
`model.py:73`; `05-rain-skip.md` §8.10), la lluvia pasada o la prevista alcanza su umbral
(`05-rain-skip.md` §4).

- Lluvia pasada: la de las últimas `rain_past_hours`, según el tipo de `rain_sensor` (acumulado o
  intensidad; `05-rain-skip.md` §8.13).
- Lluvia prevista: la del pronóstico horario en las próximas `rain_forecast_hours` (6–24 h,
  global) desde la evaluación (`05-rain-skip.md` §8.6, §8.17).
- Umbrales guardados en mm; cada fuente se convierte a mm con su unidad (`05-rain-skip.md` §8.12).

**Disparadores.** La evaluación de un **lote**: todas las zonas con un bloque a la misma hora de
inicio (`05-rain-skip.md` §8.11). Dos casos:

- lote programado, **10 min antes** de su hora; la decisión queda fijada y a la hora del bloque
  no se reevalúa (`05-rain-skip.md` §8.16). Un cambio en la zona anula la decisión y el bloque se
  evalúa a su hora (§8.22);
- lote de bloques perdidos, al arrancar HA, tras esperar a las fuentes (`05-rain-skip.md` §8.15).

Nunca en «regar zona ahora» ni en «regar válvula ahora» (`05-rain-skip.md` §5).

**Componente que lo evalúa.** `IrrigationManager._async_evaluate_lot` (`manager.py:532`). Antes de
decidir, el lote recalcula el estado de lluvia único con `async_refresh_rain` (`manager.py:539-540`;
`05-rain-skip.md` §8.9); la decisión lee ese estado. `block_runs` (`schedule.py:18-20`) sigue
sin mirar la lluvia: la decisión fijada se consume aparte. Se llama desde `_async_block_fired`
(`manager.py:342`), `_async_recover_rain` (`manager.py:526`) y el arranque (`manager.py:159-160`).

**Acción de la integración.** El bloque de esa zona no genera trabajos; las colas no cambian.
Todas las válvulas de la zona se omiten juntas.

**Datos.** Los del evento de bus (`manager.py:578-586`); son también los atributos de la entidad
`event` de la zona. Si se cumplen las dos condiciones, `reason` es `rain_past`.

| Campo | Tipo | Qué |
|---|---|---|
| `zone_id` | str | Zona |
| `start_time` | str | Hora del bloque, `"HH:MM"` |
| `date` | str | Día del bloque, `"YYYY-MM-DD"` (`05-rain-skip.md` §8.26) |
| `reason` | str | `rain_past` \| `rain_forecast` |
| `rain_mm` | float | mm del motivo, redondeados a 0.1 |
| `past_mm` | float \| null | Lluvia caída; `null` si la fuente no está o falla |
| `forecast_mm` | float \| null | Lluvia prevista; `null` si la fuente no está o falla |

**Repetición.**

- Entidad `event` y evento de bus: **una por bloque omitido**.
- Episodio de lluvia **por zona** (`05-rain-skip.md` §8.19):
  - **Abre** el episodio de una zona la omisión de un bloque de esa zona con su episodio cerrado.
  - **Cierra** el episodio de una zona: un bloque de esa zona se evalúa y no se omite por lluvia
    bajo los umbrales (regar porque fallan todas las fuentes **no** cierra); lleva **más de 24 h
    abierto** (se comprueba al evaluar el bloque, antes de decidir); la zona pasa a
    `rain_skip = false` o se borra; se guardan ajustes sin ninguna fuente de lluvia (cierra todos).
- Push: **uno por lote**, con las zonas del lote que abren episodio, cada una con su hora, su
  motivo y sus mm (`05-rain-skip.md` §8.11, §8.20). Las zonas con el episodio ya abierto no salen.
  Sin zonas que abran episodio, no hay push. Como mucho, un push por zona cada 24 h. Ejemplo:
  «Riego saltado por lluvia: Huerto 20:00 (6.2 mm previstos), Césped 20:00 (8.0 mm caídos). No se
  repite el aviso hasta el próximo riego».
- La entidad `event` y el evento de bus salen por bloque sin push; el push del lote se envía
  aparte (`_async_alert(..., push=False)`, `manager.py:587`; push en `_async_push_rain_skipped`,
  `manager.py:590`).
- Runtime: hora de apertura por zona (`zone_id → hora`) en `rain_episodes` (`runtime.py:89-90`).
  Un reinicio de HA no repite el push.
- La predicción del próximo riego (`05-rain-skip.md` §8.21) **no** dispara esta alerta: solo la
  decisión fijada.

**Histórico.** En la fila de la zona, una vez por bloque. No se repite en sus válvulas.

---

## 8. `rain_source_unavailable` — Sin datos de lluvia

| | |
|---|---|
| Nivel | Instalación |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Normal |
| Evento de bus | `irrigation_scheduler_rain_source_unavailable` (`const.py:82`) |
| Cabecera del push | Alerta |
| Texto de push | «Sin datos de lluvia: {sources}. {outcome} Revisa la fuente.» (`notify.py:36`) |
| Spec de origen | `docs/specs/05-rain-skip.md` §6 y §8 |

**Cuándo salta.** Al evaluar un lote, una fuente de lluvia configurada falla:

- la entidad (`rain_sensor` o `weather_entity`) está `unavailable` o `unknown`;
- su unidad no se reconoce (`05-rain-skip.md` §8.12, §8.13);
- lluvia pasada: no hay en el recorder un estado del `rain_sensor` en o antes de
  `now − rain_past_hours`. Si la entidad está excluida del recorder, falla siempre
  (`05-rain-skip.md` §8.3);
- lluvia prevista: `weather.get_forecasts` no da pronóstico horario.

**Disparadores.**

- Lote programado: al evaluarlo, 10 min antes de su hora (`05-rain-skip.md` §8.2, §8.11, §8.16).
- Lote de bloques perdidos al arrancar HA: solo si la fuente sigue fallando tras reintentar cada
  30 s durante 5 min (`05-rain-skip.md` §8.15). Sin bloques perdidos no hay espera ni alerta.
- Los recálculos periódicos del estado de lluvia (cada hora y al cambiar el `rain_sensor`,
  `05-rain-skip.md` §8.9) ponen las entidades de lluvia en `unavailable`, pero **no** disparan la
  alerta.

**Componente que lo evalúa.** `IrrigationManager._async_evaluate_lot` (`manager.py:532`) la
dispara con `_async_rain_source_alert` (`manager.py:592`) tras el recálculo que hace
`async_refresh_rain` (`manager.py:539-540`; `05-rain-skip.md` §8.9). `async_refresh_rain` **no** la
dispara (`manager.py:477-480`).

**Acción de la integración.** Ignora esa fuente y decide con la otra. Si fallan todas las
configuradas, **se riega** (`05-rain-skip.md` §6).

**Datos.** Los del evento de bus (`manager.py:623-629`); son también los atributos de la entidad
`event` de la instalación.

| Campo | Tipo | Qué |
|---|---|---|
| `failures` | list | Una entrada por fuente caída: `{"source", "entity_id", "reason"}` |
| `failures[].source` | str | `rain_sensor` \| `weather_entity` |
| `failures[].reason` | str | `unavailable` \| `unit` \| `no_history` \| `no_hourly` \| `error` |
| `watering` | bool | `true` si fallan todas: el lote riega (`05-rain-skip.md` §6) |

Motivos de fallo de una fuente (`rain_source.py:19-24`):

- `unavailable`: la entidad no existe o está `unavailable` o `unknown`;
- `unit`: su unidad no se reconoce (`05-rain-skip.md` §8.12, §8.13);
- `no_history`: no hay estado en o antes de `now − rain_past_hours` (`05-rain-skip.md` §8.3);
- `no_hourly`: la `weather` no da pronóstico horario;
- `error`: el recorder o el servicio lanzan un error.

**Repetición.** **Una vez por lote** en que falla alguna fuente, no una por zona, sin episodio
(`05-rain-skip.md` §8.11). Si fallan las dos, **una sola alerta** que lista ambas y dice que se
riega. Ejemplo de push: «Sin datos de lluvia: pluviómetro y pronóstico. Se riega igual.
Revisa la fuente».

**Histórico.** En la fila «Instalación».

**No es alerta.**

- Un pronóstico que no cubre las `rain_forecast_hours`: se suma lo disponible y se deja
  un aviso en el log (`05-rain-skip.md` §8.7).
- Una `weather_entity` sin pronóstico horario en su `supported_features`: aviso en ajustes al
  elegirla (`05-rain-skip.md` §8.4).

---

## 9. `valve_switched` — Encendido/apagado

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: solo push (sin entidad event, sin evento de bus, sin marca en el histórico) |
| Prioridad por defecto | Normal |
| Cabecera del push | Info |
| Texto de push | `valve_on`: «{zone} · {entity}: encendida a las {time}{origin}.»; `valve_off`: «{zone} · {entity}: apagada a las {time}, {duration} regando{origin}.» (`notify.py:42-43`) |

**Cuándo salta.** Una switch configurada pasa de `off` a `on` o de `on` a `off`, sea cual sea el
origen. El arranque de HA y los paso por `unavailable`/`unknown` no avisan
(`manager.py:379-403`).

**Componente.** `IrrigationManager._async_push_switched` (`manager.py:405-433`). Llama a
`async_push` con el tipo `valve_switched` y `kind` = `valve_on` o `valve_off`.

**Datos del push.** `{origin}`: « (programado)», « (manual)» o « (externo)»; vacío si no se sabe
(`notify.py:53-55`). `{duration}`: tiempo abierta, `45 s`, `3 min`, `1 h 5 min` o `1 h`
(`notify.py:98-106`).

---

## 10. `no_water` — Sin agua

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_no_water` (`const.py`) |
| Cabecera del push | Error |
| Texto de push | Con cierre: «{zone} · {entity}: sin agua ({time}). Válvula cerrada. Revisa el suministro.»; sin cierre: «{zone} · {entity}: sin agua ({time}). Revisa el suministro.» (`notify.py`, `no_water_closed` / `no_water`) |
| Spec de origen | `docs/superpowers/specs/2026-09-30-no-water-design.md` |

**Cuándo salta.**
- El `supply_sensor` de la válvula pasa de `off` a `on`.
- O la switch pasa a `on` con el sensor ya en `on`.

El arranque de HA y la vuelta desde `unavailable`/`unknown` no avisan.

**Componente.**
- `IrrigationManager._async_supply_changed` y la rama `on` de `_async_valve_state_changed`.
- Los dos llaman a `_async_no_water`.

**Acción de la integración.**
- Si la válvula está abierta, encendiéndose o encendida a mano, la cierra con `async_pause_valve`
  (el mismo camino que ⏸) y la cola sigue.
- Si el apagado falla, salta además `turn_off_failed`.

**Datos.** `zone_id`, `entity_id`, `closed`.

**Repetición.**
- Una alerta por transición del sensor.
- Una alerta por apertura con el sensor en `on`.
- El indicador «Sin agua» del snapshot (`no_water`) sigue al sensor sin avisar.

---

## Pendiente

Nada pendiente en los tipos actuales.
