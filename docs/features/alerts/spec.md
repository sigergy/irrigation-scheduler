# Alertas — especificación por tipo

> Estado: **en diseño** · Última actualización: 2026-10-06
> Resumen y catálogo: [`README.md`](README.md). Rutas de código relativas a
> `custom_components/irrigation_scheduler/`. Las citas llevan el nombre corto del fichero
> (`manager.py:773-808`); con subcarpeta (`engine/incidents.py:94-114`) cuando el nombre se repite o
> hace falta para distinguir.

## 0. Común a todas

### 0.1 Ciclo de una alerta

1. Un componente detecta la condición (ver cada alerta).
2. Dispara la entidad `event` de su nivel con el ID de la alerta como `event_type` y sus datos
   (§0.3). **Siempre**, sea cual sea la configuración.
3. Emite su evento de bus (ver cada alerta). **Siempre.**
4. Si la configuración del tipo da algún destino, envía el aviso. Lo registra `Incidents.alert`
   (`engine/incidents.py:94-114`), que envía si hay destinos de algún tipo (`engine/incidents.py:112`).
   `Incidents._targets` (`engine/incidents.py:48-51`) resuelve dos tipos de destino:
   - **Móviles** (push): con el push activo del tipo, la prioridad configurada y los móviles
     configurados, de `notify_targets`. Los resuelve `alerts.push_targets` (`alerts.py:82-89`).
   - **Altavoces de voz**: con la voz activa del tipo (apagada por defecto, `model.py:117`) y un
     motor TTS (`tts_entity`) configurado. Son los de `speaker_targets`, o el subconjunto elegido
     para el tipo. Los resuelve `alerts.voice_targets` (`alerts.py:92-99`). `compose_notice` los
     descarta si no hay `tts_entity` (`adapters/notify.py:182`). La prioridad solo afecta al
     push (`adapters/notify.py:181`).

   `Incidents._send` (`engine/incidents.py:63-92`) toma la prioridad con `alerts.alert_priority`
   (`alerts.py:78-79`). `compose_notice` (`adapters/notify.py:158-185`) compone el aviso y
   `Notifier.send` (`adapters/notify.py:198-204`) lo envía; sin destinos de ninguno de los dos tipos
   no hace nada. Cada canal va por su lado (`adapters/notify.py:206-211`). El altavoz dice el título y
   el mensaje (`adapters/notify.py:219-228`; `speech_text`, `adapters/speak.py:24-26`).
   La cabecera del push es la severidad del tipo (`AlertType.severity`,
   `alerts.py:36-50`): **Error**, **Alerta** o **Info**, la misma que el color de su marca en el
   histórico (§0.5).
5. La tarjeta de histórico la pinta en la fila de su nivel si el tipo tiene «mostrar en histórico».

### 0.2 Configuración por tipo

| Ajuste | Valores | Defecto |
|---|---|---|
| Push | sí / no | sí |
| Móviles | subconjunto de `notify_targets` (`model.py:130`) | todos |
| Prioridad | crítica / alta / normal | la del catálogo |
| Mostrar en histórico | sí / no | sí |
| Voz | sí / no (`model.py:117`) | no |
| Altavoces | subconjunto de `speaker_targets` (`model.py:119`, `132`) | todos |

Suelo: `turn_off_failed` no admite prioridad normal.

Se guarda en `Settings.alerts`, un `AlertConfig` por ID; un ID ausente usa estos valores por
defecto. Detalle: `../superpowers/specs/2026-09-29-incidents-design.md`, «Modelo de datos».

### 0.3 Datos de la entidad `event`

Los atributos de cada disparo son exactamente los datos del evento de bus (`Alert.data`,
`alerts.py:53-61`; se envían en `engine/incidents.py:110-111`).

Entidades (`event.py`; unique_id y dispositivo en `entities/base.py`):

- válvula: unique_id `<zone_id>_valve_alerts_<switch>` (`event.py:91`, `entities/base.py:100`), nombre
  «Alertas <válvula>», en el dispositivo de la switch; si no tiene, en el de la zona
  (`entities/base.py:103-108`);
- zona: `<zone_id>_alerts` (`event.py:102`, `entities/base.py:48`);
- instalación: `installation_alerts` (`event.py:115`, `entities/base.py:69`).

### 0.4 Reintentos de switch

`turn_on_failed` y `turn_off_failed` dependen de `async_set_valve` (`valves.py:18-49`): llama al
servicio `switch.turn_on`/`turn_off`, espera `VERIFY_DELAY_S` = 2 s (`const.py:56`) y lee el
estado. Repite hasta 1 + `SWITCH_RETRIES` = 4 intentos (`const.py:55`). Un estado `unavailable`
cuenta como fallo. Cada intento fallido deja un `warning` en el log (`valves.py:38`); eso **no** es
una alerta. Si falla un apagado, siguen 10 reintentos en segundo plano (`engine/close_retry.py`,
`CLOSE_RETRY_OFFSETS_S` en `const.py`); ver §2.

---

### 0.5 Texto del push

- Cabecera: `Error`, `Alerta` o `Info` según la severidad del tipo (`notify.py:37-39`). En inglés:
  `Error`, `Warning`, `Info`.
- Cuerpo: `Zona · Válvula: qué pasa. Qué hacer.` La parte «qué hacer» solo va en los tipos que
  piden acción al usuario: `turn_on_failed`, `turn_off_failed`, `no_water`, `sensor_unavailable` y
  `rain_source_unavailable`.
- `{time}` es la hora en que se compone el aviso (`HH:MM`), la pone `compose_notice`
  (`adapters/notify.py:171`, `179`).
- Textos en `MESSAGES` (`notify.py:34-121`), en español e inglés según el idioma de HA.

| Severidad | Cabecera | Color de la marca | Tipos |
|---|---|---|---|
| `error` | Error | Rojo | `turn_on_failed`, `turn_off_failed`, `no_water` |
| `warning` | Alerta | Naranja | `overrun_restart`, `overrun_running`, `manual_overrun`, `sensor_unavailable`, `rain_source_unavailable` |
| `info` | Info | Azul | `rain_skipped`, `valve_switched` y `restart_not_resumed` (sin marca) |

---

## 1. `turn_on_failed` — Error encendido

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_error` con `action: "turn_on"` (`const.py:96`) |
| Cabecera del push | Error |
| Texto de push | «{zone} · {entity}: no enciende ({time}). Se salta su riego. Revisa la válvula.» (`notify.py:41`) |
| Spec de origen | [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §6, §7.2 |

**Cuándo salta.** Al abrir una válvula de un trabajo de la cola, la switch no llega a `on` tras
los 4 intentos (§0.4).

**Disparadores.** Todo trabajo que pasa por la cola: bloque programado, bloque perdido recuperado
al arrancar, «regar zona ahora» y «regar válvula ahora».

**Componente que lo evalúa.** `IrrigationManager._async_open_job` (`manager.py:773-808`): si
`async_set_valve(..., turn_on=True)` devuelve `False` y además el trabajo no se canceló y HA no
está parando, llama a `Incidents.valve_error(..., True)` (`engine/manager.py:806-808`; cuerpo en
`engine/incidents.py:116-131`). Si se pausó mientras reintentaba o HA está parando, no es un
fallo y no avisa.

**Acción de la integración.** Descarta el trabajo, libera el hueco y la cola sigue con el
siguiente (`manager.py:791-803`).

**Datos.** `zone_id`, `entity_id`, `action`, `priority` (`engine/incidents.py:124-130`).

**Repetición.** Una alerta por trabajo fallido. Sin agrupación.

---

## 2. `turn_off_failed` — Error apagado

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Crítica. **No admite normal** |
| Evento de bus | `irrigation_scheduler_valve_error` con `action: "turn_off"` (`const.py:96`) |
| Cabecera del push | Error |
| Texto de push | «{zone} · {entity}: no se apaga ({time}). Puede seguir regando. Ciérrala a mano ya.» (`notify.py:42-44`) |
| Spec de origen | [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §6, §7.2 |

**Cuándo salta.** Al apagar una válvula, la switch no llega a `off` tras los 4 intentos (§0.4).

**Reintentos en segundo plano.** Tras el aviso, `CloseRetry` (`engine/close_retry.py`) reintenta
10 veces: a los 10, 20 y 30 s y luego cada minuto hasta los 450 s. Si la switch pasa de
`unavailable`/`unknown` a `on`, hace un intento extra al momento. No avisa por cada fallo.

- Si fallan los 10: vuelve a saltar `turn_off_failed` (entidad event, evento de bus con
  `action: "turn_off_gave_up"` y push) con el texto «{zone} · {entity}: error en cierre de válvula.
  Se ha superado el límite de reintentos ({time}). Ciérrala a mano.»
- Si la switch pasa a `off`: solo push, cabecera Info, prioridad normal, mismos destinos:
  «{zone} · {entity}: cerrada por reintento a las {time}. Ya no hace falta cerrarla a mano.»
- Mientras dura, la switch no cuenta como encendida a mano. Si la integración la vuelve a abrir,
  los reintentos paran sin aviso. Se pierden si HA se reinicia.

Spec: [`01-close-retry/spec.md`](../06-10-2026-ha-restart-fallbacks/01-close-retry/spec.md).

**Disparadores y componente que lo evalúa.**

| Disparador | Código |
|---|---|
| Fin del tiempo programado | `_async_close_due` → `_async_finish_close` (`manager.py:822-827`, `838-849`) |
| Pausar, detener (válvula, zona o todo) | `_async_pause` (`manager.py:1084-1115`) → `_async_finish_close` / `_async_close_manual` |
| Borrar una zona con válvulas abiertas | `async_delete_zone` (`manager.py:959-984`) → `_async_pause` |
| Cancelación mientras abría | `_async_open_job` (`manager.py:804-805`) → `_async_finish_close` |
| Latido: tiempo excedido o encendida a mano | `_async_heartbeat` (`manager.py:323-326`) → `_async_finish_close` / `_async_close_manual` (`manager.py:887-895`) |
| Arranque de HA: tiempo excedido | `_async_recover` (`engine/manager.py:254`) → `_async_close_failed` (`engine/manager.py:266-267`) |

Todos acaban en `_async_close_failed` (`manager.py:851-860`), que llama a
`Incidents.valve_error(..., False)` (`manager.py:858`, `engine/incidents.py:116-131`).

**Acción de la integración.** Libera el hueco igualmente (`manager.py:842-848`); la válvula puede
seguir regando.

**Borrado de zona.** `async_delete_zone` (`manager.py:959-984`) no borra la zona hasta que sus
válvulas están apagadas, para que la entidad `event` de la válvula siga existiendo si el apagado
falla:

1. Detiene la zona y envía la orden de apagado a sus válvulas con `_async_pause`
   (`manager.py:963`).
2. Si alguna falla, **la zona no se borra**: salta `turn_off_failed` en la entidad `event` de la
   válvula, y `async_delete_zone` lanza `ZoneDeleteError` con el código `valves_not_off`
   (`manager.py:964-966`, `const.py:94`).
3. Con el lock tomado, si una apertura en curso o un bloque disparado durante el apagado dejó
   válvulas abiertas o abriéndose, lanza `ZoneDeleteError` con el código `zone_busy`
   (`manager.py:967-972`, `const.py:93`).
4. Si no, borra la zona (`manager.py:976`).

El comando WS `delete_zone` (`api/websocket.py:102-110`) devuelve el código como código de error y los
nombres de las válvulas afectadas como mensaje (`api/websocket.py:65-67`). El panel lo muestra en
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
| Evento de bus | `irrigation_scheduler_valve_overrun` (`const.py:97`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: más de {minutes} min encendida mientras HA estaba caído.» (`notify.py:57`) |
| Spec de origen | [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §5.2, §7.2 |

**Cuándo salta.** Al arrancar HA, una válvula del runtime persistido tiene `ends_at` ya pasado.

**Disparador.** Arranque de HA (`async_at_started`, `manager.py:132`).

**Componente que lo evalúa.** `IrrigationManager._async_recover` (`manager.py:241-302`): condición
`now >= valve.ends_at` (`manager.py:254`).

**Acción de la integración.** Quita la válvula del runtime y la apaga. Si el apagado falla, salta
además `turn_off_failed`.

**Datos.** `zone_id`, `entity_id` (`manager.py:263`). El push lleva además `{minutes}`: los
minutos programados de la válvula, `ends_at − started_at` (`manager.py:264`).

**Repetición.** Una por válvula excedida en cada arranque.

---

## 4. `overrun_running` — Exceso de tiempo

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_overrun` (`const.py:97`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: abierta más de lo previsto. Apagada a las {time}.» (`notify.py:58`) |
| Spec de origen | [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §5.3.1, §7.2 |

**Cuándo salta.** Una válvula gestionada por la integración sigue abierta más de `OVERRUN_MARGIN`
= 1 min (`const.py:75`) después de su `ends_at`: su temporizador de cierre no actuó.

**Disparador.** Latido cada `HEARTBEAT_INTERVAL` = 5 min (`const.py:72`).

**Componente que lo evalúa.** `IrrigationManager._async_heartbeat` (`manager.py:304-343`):
condición `now > valve.ends_at + OVERRUN_MARGIN` en `status.overdue_valves`
(`engine/status.py:65-74`, condición en `73`), llamada desde el latido (`engine/manager.py:313-317`).

**Acción de la integración.** Apaga la válvula. Si el apagado falla, salta además
`turn_off_failed`.

**Datos.** `zone_id`, `entity_id` (`manager.py:333`).

**Repetición.** Una por válvula y latido en que se detecta. La válvula sale de `open_valves` al
cerrarse, así que no se repite en el latido siguiente.

---

## 5. `manual_overrun` — Exceso manual

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Alta |
| Evento de bus | `irrigation_scheduler_valve_overrun` con `manual: true` (`const.py:97`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: más de {minutes} min encendida a mano. Apagada a las {time}.» (`notify.py:59`) |
| Spec de origen | [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §5.3.2, §7.2 |

**Cuándo salta.** Una switch configurada está en `on` fuera de la gestión de la integración y
lleva encendida más de su `duration_min` + `OVERRUN_MARGIN`.

**Disparador.** Latido cada 5 min.

Lo normal es que no salte. `Triggers.track_manual` (`engine/triggers.py:85-93`) programa el
apagado en dos casos:

- la switch pasa a `on` encendida fuera de la integración (origen externo): apagado en
  `last_changed + duration_min` (`engine/triggers.py:146-148`);
- al registrar la vigilancia de una zona (arranque de HA o zona guardada) con switches ya
  encendidas a mano (`IrrigationManager.manual_on`, `engine/manager.py:862-868`): apagado en su
  último paso a `on` + `duration_min` (`engine/triggers.py:76-79`).

El fin lo calcula `manual_ends` (`engine/manual.py:27-29`). `_async_manual_due`
(`engine/manager.py:870-885`) ejecuta el apagado sin alerta propia: solo el push `valve_switched`
de apagado. Esta alerta queda como red de seguridad si el
temporizador no actúa.

**Componente que lo evalúa.** `IrrigationManager.manual_on` (`engine/manager.py:862-868`), que
delega en `manual_on` (`engine/manual.py:14-24`), detecta las switch en `on` que no están abiertas,
abriéndose ni cerrándose, ni con reintentos de cierre en curso (`CloseRetry.active`,
`engine/close_retry.py:49-51`; el conjunto `busy` lo arma `engine/manager.py:867` con
`ValveSlots.busy`, `engine/slots.py:177-179`); `_async_heartbeat` (`engine/manager.py:319`) llama a
`status.manual_overdue` (`engine/status.py:77-85`), que compara con `state.last_changed`
(`engine/manual.py:23`, `27-29`).

**Acción de la integración.** Apaga la switch con `_async_close_manual` (`manager.py:887-895`), sin
ocupar hueco. Si falla, salta además `turn_off_failed`.

**Datos.** `zone_id`, `entity_id`, `manual: true` (`manager.py:341`); el push lleva los minutos
(`manager.py:342`).

**Repetición.** Una por switch y latido.

---

## 6. `sensor_unavailable` — Sensor caído

| | |
|---|---|
| Nivel | Zona |
| Estado | Implementada: entidad event, evento de bus y push configurable |
| Prioridad por defecto | Normal |
| Evento de bus | `irrigation_scheduler_sensor_unavailable` (`const.py:98`) |
| Cabecera del push | Alerta |
| Texto de push | «{zone} · {entity}: sensor sin datos desde las {time}. Revisa el sensor.» (`notify.py:54`) |
| Spec de origen | [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md) §7.2 |

**Cuándo salta.** Un sensor de la zona (`temperature`, `humidity`, `soil_moisture`;
`const.py:31`) pasa de un estado válido a `unavailable` o `unknown`.

**Disparador.** Cambio de estado del sensor, escuchado con `async_track_state_change_event`
(`engine/triggers.py:54-58`).

**Componente que lo evalúa.** `IrrigationManager._async_sensor_changed` (`manager.py:384-399`). No
salta si el estado anterior ya era `unavailable`/`unknown` (`manager.py:391-392`).

**Acción de la integración.** Ninguna; solo avisa.

**Datos.** `zone_id`, `entity_id` del sensor, `state` (`manager.py:398`). El push no muestra el
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
| Evento de bus | `irrigation_scheduler_block_skipped` (`const.py:99`) |
| Cabecera del push | Info |
| Texto de push | «Riego saltado por lluvia: {zones}. No se repite el aviso hasta el próximo riego.»; cada zona con `rain_zone` (`notify.py:60`, `67`) |
| Spec de origen | [`docs/features/rain-skip/spec.md`](../rain-skip/spec.md) §4, §5, §7 y §8 |

**Cuándo salta.** Al evaluar un bloque de una zona con `rain_skip = true` (ajuste por zona,
`model.py:78`; `05-rain-skip.md` §8.10), la lluvia pasada, la estimada o la prevista alcanza su
umbral (`05-rain-skip.md` §4; `domain/rain.py:192-212`).

- Lluvia pasada: la de las últimas `rain_past_hours`, según el tipo de `rain_sensor` (acumulado o
  intensidad; `05-rain-skip.md` §8.13).
- Lluvia estimada: la de las últimas `rain_forecast_hours`, calculada con el registro de
  previsiones (`domain/rain.py:69-70`, `186-189`). Solo cuenta sin lluvia medida: sin `rain_sensor`
  o con él caído (`domain/rain.py:200-203`). Usa el umbral de la lluvia prevista
  (`domain/rain.py:206`). Ver `docs/features/rain-skip/rain-estimated-design.md`.
- Lluvia prevista: la del pronóstico horario en las próximas `rain_forecast_hours` (6–24 h,
  global) desde la evaluación (`05-rain-skip.md` §8.6, §8.17).
- Umbrales guardados en mm; cada fuente se convierte a mm con su unidad (`05-rain-skip.md` §8.12).

**Disparadores.** La evaluación de un **lote**: todas las zonas con un bloque a la misma hora de
inicio (`05-rain-skip.md` §8.11). Cuatro casos:

- lote programado, **10 min antes** de su hora; la decisión queda fijada y a la hora del bloque
  no se reevalúa (`05-rain-skip.md` §8.16). Un cambio en la zona anula la decisión y el bloque se
  evalúa a su hora (§8.22);
- lote de bloques perdidos, al arrancar HA, tras esperar a las fuentes (`05-rain-skip.md` §8.15);
- lote al acabar el horario silencioso: las zonas que necesitan lluvia y tienen trabajos
  programados retenidos en la cola, como bloques `(zona, fin de franja, hoy)`. Lo manual no mira
  la lluvia (`_async_quiet_end`, `engine/manager.py:725-771`; el lote, `734-758`;
  `docs/features/quiet-hours/spec.md` §B.4);
- al decidir si se retoma un riego interrumpido tras un reinicio: si es programado y su zona
  necesita lluvia, se evalúa un lote de un bloque `(zona, hora de T, hoy)`. Si es manual o la zona
  no mira la lluvia, no se evalúa (`_async_resume`, `engine/manager.py:539-584`; la evaluación,
  `558-567`;
  [`04-resume-after-restart`](../06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md)
  §4.4).

Nunca en «regar zona ahora» ni en «regar válvula ahora» (`05-rain-skip.md` §5).

**Componente que lo evalúa.** `IrrigationManager._async_evaluate_lot` (`manager.py:489`). Antes de
decidir, el lote recalcula el estado de lluvia único con `async_refresh_rain` (`manager.py:496-497`;
`05-rain-skip.md` §8.9); la decisión lee ese estado. `block_runs` (`schedule.py:12-14`) sigue
sin mirar la lluvia: la decisión fijada se consume aparte. Se llama desde `_async_block_fired`
(`manager.py:365`), `_async_rain_eval_fired` (`manager.py:382`), `_async_recover_rain`
(`manager.py:483`), `_async_resume` (`manager.py:567`), `_async_quiet_end` (`manager.py:758`) y el
arranque (`manager.py:150-151`).

**Acción de la integración.** El bloque de esa zona no genera trabajos; las colas no cambian.
Todas las válvulas de la zona se omiten juntas.

**Datos.** Los del evento de bus (`manager.py:513-522`); son también los atributos de la entidad
`event` de la zona. Si se cumplen varias condiciones, `reason` es la primera en este orden: pasada
(`rain_past`), estimada (`rain_estimated`), prevista (`rain_forecast`) (`domain/rain.py:202-209`).

| Campo | Tipo | Qué |
|---|---|---|
| `zone_id` | str | Zona |
| `start_time` | str | Hora del bloque, `"HH:MM"` |
| `date` | str | Día del bloque, `"YYYY-MM-DD"` (`05-rain-skip.md` §8.26) |
| `reason` | str | `rain_past` \| `rain_estimated` \| `rain_forecast` (`domain/rain.py:11-14`) |
| `rain_mm` | float | mm del motivo, redondeados a 0.1 |
| `past_mm` | float \| null | Lluvia caída; `null` si la fuente no está o falla |
| `forecast_mm` | float \| null | Lluvia prevista; `null` si la fuente no está o falla |
| `estimated_mm` | float \| null | Lluvia estimada con el registro de previsiones; `null` sin previsión válida |

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
  Sin zonas que abran episodio, no hay push. Como mucho, un push por zona cada 24 h. El motivo
  sale como «caídos» (`rain_past`), «estimados» (`rain_estimated`) o «previstos» (`rain_forecast`)
  (`adapters/notify.py:68-70`; inglés `107-109`). Ejemplo:
  «Riego saltado por lluvia: Huerto 20:00 (6.2 mm previstos), Césped 20:00 (8.0 mm caídos). No se
  repite el aviso hasta el próximo riego».
- La entidad `event` y el evento de bus salen por bloque sin push; el push del lote se envía
  aparte (`Incidents.alert(..., push=False)`, `engine/manager.py:508-524`; push en
  `Incidents.push_rain_skipped`, `engine/incidents.py:198-212`, llamado en `engine/manager.py:526`).
- Runtime: hora de apertura por zona (`zone_id → hora`) en `rain_episodes` (`runtime.py:114-115`).
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
| Evento de bus | `irrigation_scheduler_rain_source_unavailable` (`const.py:100`) |
| Cabecera del push | Alerta |
| Texto de push | «Sin datos de lluvia: {sources}. {outcome} Revisa la fuente.» (`notify.py:55`) |
| Spec de origen | [`docs/features/rain-skip/spec.md`](../rain-skip/spec.md) §6 y §8 |

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

**Componente que lo evalúa.** `IrrigationManager._async_evaluate_lot` (`manager.py:489`) la
dispara con `Incidents.rain_source_alert` (`engine/incidents.py:214-235`; llamada en
`engine/manager.py:527-528`) tras el recálculo que hace
`async_refresh_rain` (`manager.py:496-497`; `05-rain-skip.md` §8.9). `async_refresh_rain` **no** la
dispara (`manager.py:439-442`).

**Acción de la integración.** Ignora esa fuente y decide con la otra. Si fallan todas las
configuradas, **se riega** (`05-rain-skip.md` §6).

**Datos.** Los del evento de bus (`engine/incidents.py:224-232`); son también los atributos de la entidad
`event` de la instalación.

| Campo | Tipo | Qué |
|---|---|---|
| `failures` | list | Una entrada por fuente caída: `{"source", "entity_id", "reason"}` |
| `failures[].source` | str | `rain_sensor` \| `weather_entity` |
| `failures[].reason` | str | `unavailable` \| `unit` \| `no_history` \| `no_hourly` \| `error` |
| `watering` | bool | `true` si fallan todas: el lote riega (`05-rain-skip.md` §6) |
| `estimated` | bool | `true` si la estimación con la previsión sustituye al pluviómetro (no hay o está caído) |

Motivos de fallo de una fuente (`rain_source.py:10-15`):

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
| Texto de push | `valve_on`: «{zone} · {entity}: encendida a las {time}{origin}.»; `valve_off`: «{zone} · {entity}: apagada a las {time}, {duration} regando{origin}.» (`notify.py:61-62`) |

**Cuándo salta.** Una switch configurada pasa de `off` a `on` o de `on` a `off`, sea cual sea el
origen. El arranque de HA y los paso por `unavailable`/`unknown` no avisan
(`engine/triggers.py:129-133`).

**Componente.** `Incidents.push_switched` (`engine/incidents.py:169-188`), llamado desde el oyente
de switches `Triggers._async_valve_state_changed` (`engine/triggers.py:124-166`; llamadas en
`138-141` y `163-166`). Llama a `Incidents._send` con el tipo `valve_switched` y `kind` = `valve_on`
o `valve_off` (`engine/incidents.py:188`).

**Datos del push.** `{origin}`: « (programado)», « (manual)» o « (externo)»; vacío si no se sabe
(`notify.py:77-79`). `{duration}`: tiempo abierta, `45 s`, `3 min`, `1 h 5 min` o `1 h`
(`notify.py:133-141`).

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
| Spec de origen | [`docs/features/no-water/spec.md`](../no-water/spec.md) |

**Cuándo salta.**
- El `supply_sensor` de la válvula pasa de `off` a `on`.
- O la switch pasa a `on` con el sensor ya en `on`.

El arranque de HA y la vuelta desde `unavailable`/`unknown` no avisan.

**Componente.**
- `Triggers._async_supply_changed` (`engine/triggers.py:169-179`) y la rama `on` de
  `Triggers._async_valve_state_changed` (`engine/triggers.py:135-158`).
- Los dos llaman a `IrrigationManager._async_no_water` (`engine/manager.py:401-425`;
  llamadas en `engine/triggers.py:158` y `179`).

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

## 11. `restart_not_resumed` — No retomado tras reinicio

| | |
|---|---|
| Nivel | Válvula |
| Estado | Implementada: solo push (sin entidad event, sin evento de bus, sin marca en el histórico) |
| Prioridad por defecto | Normal |
| Cabecera del push | Info |
| Texto de push | «{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se retoma.» (`notify.py:63-65`, inglés `notify.py:103-105`) |

**Cuándo salta.** Al arrancar HA, una válvula interrumpida por la parada ordenada no se retoma:
HA o su `switch` tardaron más de 60 min, llegó el siguiente bloque de esa válvula, la zona o la
válvula están deshabilitadas o es hora de silencio
([`04-resume-after-restart`](../06-10-2026-ha-restart-fallbacks/04-resume-after-restart/spec.md) §4.3).
Pausar, detener o regar a mano la válvula mientras espera la descarta sin aviso.

**Componente.** `IrrigationManager._not_resumed_locked` (`manager.py:611-627`) llama a
`Incidents.push_not_resumed` (`incidents.py:190-196`).

**Datos del push.** `{minutes}`: minutos que faltaban, redondeados hacia arriba.

---

## Pendiente

Nada pendiente en los tipos actuales.
