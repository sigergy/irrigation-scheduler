# Informe de citas de `docs/features/alerts/spec.md`

Rutas de código relativas a `custom_components/irrigation_scheduler/`. Las citas del doc usan nombre corto
(`manager.py`, `notify.py`...); aquí, en la última columna, va la ruta real.

Resumen: 112 citas revisadas. 77 corregidas, 12 ya correctas, 23 sin tocar (dudas, al final).
Solo se han cambiado números de línea. Las líneas del doc no se han movido.

## Citas corregidas y verificadas

| Línea del doc | Cita antes | Cita después | Qué describe | Verificado en |
|---|---|---|---|---|
| 18 | `alerts.py:80-87` | `alerts.py:82-89` | `push_targets` | `domain/alerts.py:82-89` |
| 19 | `alerts.py:76-77` | `alerts.py:78-79` | `alert_priority` | `domain/alerts.py:78-79` |
| 20 | `alerts.py:36-48` | `alerts.py:36-50` | catálogo `ALERT_TYPES` con la severidad de cada tipo | `domain/alerts.py:36-50` |
| 29 | `model.py:120` | `model.py:130` | campo `notify_targets` | `domain/model.py:130` |
| 41 | `alerts.py:42-50` | `alerts.py:53-61` | clase `Alert` y su campo `data` | `domain/alerts.py:53-61` |
| 45 | `event.py:93` | `event.py:91` | unique_id de la entidad event de válvula (clave `valve_alerts`) | `event.py:91` |
| 48 | `event.py:104` | `event.py:102` | entidad event de zona (clave `alerts`) | `event.py:102` |
| 49 | `event.py:117` | `event.py:115` | entidad event de instalación (clave `alerts`) | `event.py:115` |
| 64 | `notify.py:27-29` | `notify.py:37-39` | cabeceras `title_error/warning/info` | `adapters/notify.py:37-39` (en: 83-85) |
| 70 | `notify.py:24-86` | `notify.py:34-121` | dict `MESSAGES` | `adapters/notify.py:34-121` |
| 87 | `const.py:78` | `const.py:96` | `EVENT_VALVE_ERROR` | `const.py:96` |
| 89 | `notify.py:31` | `notify.py:41` | texto `turn_on_failed` | `adapters/notify.py:41` |
| 98 | `manager.py:672-698` | `manager.py:773-808` | `_async_open_job` | `engine/manager.py:773-808` |
| 103 | `manager.py:682-694` | `manager.py:791-803` | bloque con lock: libera hueco y despacha el siguiente | `engine/manager.py:791-803` |
| 118 | `const.py:87` | `const.py:96` | `EVENT_VALVE_ERROR` (turn_off) | `const.py:96` |
| 143 | `manager.py:610-615`, `626-638` | `manager.py:822-827`, `838-849` | `_async_close_due`, `_async_finish_close` | `engine/manager.py:822-827`, `838-849` |
| 144 | `manager.py:864-893` | `manager.py:1084-1115` | `_async_pause` | `engine/manager.py:1084-1115` |
| 145 | `manager.py:744-765` | `manager.py:959-984` | `async_delete_zone` | `engine/manager.py:959-984` |
| 146 | `manager.py:593-594` | `manager.py:804-805` | cancelación mientras abría → `_async_finish_close` | `engine/manager.py:804-805` |
| 147 | `manager.py:236-239` | `manager.py:323-326` | latido: `gather` de `_async_finish_close` / `_async_close_manual` | `engine/manager.py:323-326` |
| 147 | `manager.py:676-684` | `manager.py:887-895` | `_async_close_manual` | `engine/manager.py:887-895` |
| 150 | `manager.py:640-649` | `manager.py:851-860` | `_async_close_failed` | `engine/manager.py:851-860` |
| 151 | `manager.py:647` | `manager.py:858` | llamada a `Incidents.valve_error(..., False)` | `engine/manager.py:858` |
| 153 | `manager.py:630-637` | `manager.py:842-848` | libera el hueco aunque falle el apagado | `engine/manager.py:842-848` |
| 156 | `manager.py:744-765` | `manager.py:959-984` | `async_delete_zone` | `engine/manager.py:959-984` |
| 161 | `manager.py:748` | `manager.py:963` | llamada a `_async_pause` en el borrado | `engine/manager.py:963` |
| 164 | `manager.py:749-751`, `const.py:85` | `manager.py:964-966`, `const.py:94` | `ZoneDeleteError` `valves_not_off` | `engine/manager.py:964-966`, `const.py:94` |
| 167 | `manager.py:752-757`, `const.py:84` | `manager.py:967-972`, `const.py:93` | `ZoneDeleteError` `zone_busy` | `engine/manager.py:967-972`, `const.py:93` |
| 168 | `manager.py:761` | `manager.py:976` | borra la zona | `engine/manager.py:976` |
| 188, 217, 247 | `const.py:79` | `const.py:97` | `EVENT_VALVE_OVERRUN` | `const.py:97` |
| 190 | `notify.py:38` | `notify.py:57` | texto `overrun_restart` | `adapters/notify.py:57` |
| 195 | `manager.py:144` | `manager.py:132` | `async_at_started` | `engine/manager.py:132` |
| 197 | `manager.py:179-226` | `manager.py:241-302` | `_async_recover` | `engine/manager.py:241-302` |
| 198 | `manager.py:184` | `manager.py:254` | condición `now >= valve.ends_at` | `engine/manager.py:254` |
| 203 | `manager.py:193` | `manager.py:263` | datos `zone_id`, `entity_id` de `overrun_restart` | `engine/manager.py:263` |
| 204 | `manager.py:194` | `manager.py:264` | `{minutes}` = `ends_at − started_at` | `engine/manager.py:264` |
| 219 | `notify.py:39` | `notify.py:58` | texto `overrun_running` | `adapters/notify.py:58` |
| 223 | `const.py:60` | `const.py:75` | `OVERRUN_MARGIN` | `const.py:75` |
| 225 | `const.py:57` | `const.py:72` | `HEARTBEAT_INTERVAL` | `const.py:72` |
| 227 | `manager.py:227-270` | `manager.py:304-343` | `_async_heartbeat` | `engine/manager.py:304-343` |
| 233 | `manager.py:260` | `manager.py:333` | datos de `overrun_running` | `engine/manager.py:333` |
| 249 | `notify.py:40` | `notify.py:59` | texto `manual_overrun` | `adapters/notify.py:59` |
| 266 | `manager.py:764-772` | `manager.py:887-895` | `_async_close_manual` | `engine/manager.py:887-895` |
| 269 | `manager.py:268` | `manager.py:341` | datos `manual: true` | `engine/manager.py:341` |
| 270 | `manager.py:269` | `manager.py:342` | minutos del push de `manual_overrun` | `engine/manager.py:342` |
| 283 | `const.py:80` | `const.py:98` | `EVENT_SENSOR_UNAVAILABLE` | `const.py:98` |
| 285 | `notify.py:35` | `notify.py:54` | texto `sensor_unavailable` | `adapters/notify.py:54` |
| 289 | `const.py:29` | `const.py:31` | `SENSOR_KINDS` | `const.py:31` |
| 294 | `manager.py:361-376` | `manager.py:384-399` | `_async_sensor_changed` | `engine/manager.py:384-399` |
| 295 | `manager.py:368-369` | `manager.py:391-392` | no salta si el estado anterior ya era malo | `engine/manager.py:391-392` |
| 299 | `manager.py:374` | `manager.py:398` | datos con `state` | `engine/manager.py:398` |
| 314 | `const.py:81` | `const.py:99` | `EVENT_BLOCK_SKIPPED` | `const.py:99` |
| 316 | `notify.py:41`, `45` | `notify.py:60`, `67` | textos `rain_skipped` y `rain_zone` | `adapters/notify.py:60`, `67` |
| 320 | `model.py:73` | `model.py:78` | ajuste `rain_skip` | `domain/model.py:78` |
| 339 | `manager.py:532` | `manager.py:489` | `_async_evaluate_lot` | `engine/manager.py:489` |
| 340 | `manager.py:539-540` | `manager.py:496-497` | recálculo con `async_refresh_rain` | `engine/manager.py:496-497` |
| 341 | `schedule.py:18-20` | `schedule.py:12-14` | `block_runs` | `domain/schedule.py:12-14` |
| 343 | `manager.py:342` | `manager.py:365` | `_async_block_fired` llama a `_async_evaluate_lot` | `engine/manager.py:365` |
| 343 | `manager.py:526` | `manager.py:483` | `_async_recover_rain` llama a `_async_evaluate_lot` | `engine/manager.py:483` |
| 343 | `manager.py:159-160` | `manager.py:150-151` | el arranque llama a `_async_evaluate_lot(soon)` | `engine/manager.py:150-151` |
| 348 | `manager.py:578-586` | `manager.py:513-522` | datos de `rain_skipped` | `engine/manager.py:513-522` |
| 378 | `runtime.py:89-90` | `runtime.py:114-115` | campo `rain_episodes` | `domain/runtime.py:114-115` |
| 394 | `const.py:82` | `const.py:100` | `EVENT_RAIN_SOURCE_UNAVAILABLE` | `const.py:100` |
| 396 | `notify.py:36` | `notify.py:55` | texto `rain_source_unavailable` | `adapters/notify.py:55` |
| 417 | `manager.py:532` | `manager.py:489` | `_async_evaluate_lot` | `engine/manager.py:489` |
| 419 | `manager.py:539-540` | `manager.py:496-497` | recálculo con `async_refresh_rain` | `engine/manager.py:496-497` |
| 420 | `manager.py:477-480` | `manager.py:439-442` | `async_refresh_rain` no dispara alertas | `engine/manager.py:439-442` |
| 435 | `rain_source.py:19-24` | `rain_source.py:10-15` | constantes de motivo de fallo | `adapters/rain_source.py:10-15` |
| 467 | `notify.py:42-43` | `notify.py:61-62` | textos `valve_on` / `valve_off` | `adapters/notify.py:61-62` |
| 477 | `notify.py:53-55` | `notify.py:77-79` | textos de `{origin}` | `adapters/notify.py:77-79` |
| 478 | `notify.py:98-106` | `notify.py:133-141` | `duration_text` | `adapters/notify.py:133-141` |

## Citas ya correctas (sin cambio)

| Línea del doc | Cita | Qué describe | Verificado en |
|---|---|---|---|
| 53 | `valves.py:18-49` | `async_set_valve` | `adapters/valves.py:18-49` |
| 54 | `const.py:56` | `VERIFY_DELAY_S` | `const.py:56` |
| 55 | `const.py:55` | `SWITCH_RETRIES` | `const.py:55` |
| 56 | `valves.py:38` | `warning` por intento fallido | `adapters/valves.py:38` |
| 120 | `notify.py:42-44` | texto `turn_off_failed` | `adapters/notify.py:42-44` |
| 151 | `engine/incidents.py:116-131` | `Incidents.valve_error` | `engine/incidents.py:116-131` |
| 170 | `api/websocket.py:102-110` | comando WS `delete_zone` | `api/websocket.py:102-110` |
| 171 | `api/websocket.py:65-67` | `ZoneDeleteError` → `send_error` | `api/websocket.py:65-67` |
| 526 | `notify.py:63-65`, `notify.py:103-105` | texto `restart_not_resumed` (es, en) | `adapters/notify.py:63-65`, `103-105` |
| 534 | `manager.py:611-627` | `_not_resumed_locked` | `engine/manager.py:611-627` |
| 535 | `incidents.py:190-196` | `Incidents.push_not_resumed` | `engine/incidents.py:190-196` |

La sección 11 (líneas 518-537) está verificada y no se ha cambiado.

## Dudas (citas sin tocar)

El código se refactorizó: el envío de alertas pasó de `manager.py` a `engine/incidents.py` y
`adapters/notify.py` (`Notifier`, `compose_notice`); la vigilancia de switches y sensores, a
`engine/triggers.py`; el cálculo de excesos, a `engine/status.py` y `engine/manual.py`.
Las frases nombran símbolos que ya no existen o viven en otro fichero. No se reescribe el texto.
Proposición de número entre paréntesis, por si se decide editar la frase.

| Línea del doc | Cita | Problema |
|---|---|---|
| 16 | `notify.py:109-136` | `async_push` ya no existe. Hoy: `compose_notice` (`adapters/notify.py:158-185`) y `Notifier.send` (`adapters/notify.py:198-204`). |
| 17 | `manager.py:791-827` | `IrrigationManager._async_alert` ya no existe. Hoy: `Incidents.alert` (`engine/incidents.py:94-114`). Los destinos los resuelve `Incidents._targets` (`engine/incidents.py:48-51`). |
| 41 | `manager.py:807-808` | Dispatcher y evento de bus se disparan ahora en `engine/incidents.py:110-111`. |
| 45 | `entity.py:88` | `entity.py` no existe. El unique_id de válvula se construye en `entities/base.py:100`. |
| 47 | `entity.py:91-96` | Ídem. Dispositivo de la switch o el de la zona: `entities/base.py:103-108`. |
| 48 | `entity.py:36` | Ídem. unique_id de zona: `entities/base.py:48`. |
| 49 | `entity.py:57` | Ídem. unique_id de instalación: `entities/base.py:69`. |
| 69 | `notify.py:126` | `{time}` ya no lo pone `async_push` sino `compose_notice` (`adapters/notify.py:179`). La frase nombra `async_push`. |
| 100 | `manager.py:697-698`, `774-789` | `_async_valve_error` ya no existe. La llamada es `self._incidents.valve_error(job.zone_id, job.entity_id, True)` (`engine/manager.py:806-808`). El cuerpo vive en `engine/incidents.py:116-131`. |
| 105 | `manager.py:782-788` | Los datos (`zone_id`, `entity_id`, `action`, `priority`) se arman en `engine/incidents.py:124-130`. |
| 148 | `manager.py:170`, `179-180` | No apuntan a lo que dice la fila. Ya estaban mal antes del refactor: `manager.py:170` es `_close_unsubs.clear()` / `_close_retry.cancel_all()`. El apagado por exceso al arrancar está en `engine/manager.py:253-267`. |
| 228 | `manager.py:239` | La condición `now > valve.ends_at + OVERRUN_MARGIN` está ahora en `engine/status.py:110` (`overdue_valves`), llamada desde `engine/manager.py:313-317`. |
| 262 | `manager.py:751-762` | `_manual_on` es hoy `manual_on` (`engine/manager.py:862-868`), que delega en `engine/manual.py:14-24`. |
| 264 | `manager.py:242-246` | La comparación con `last_changed` está en `engine/manual.py:27-29` y `engine/status.py:114-122`, llamada desde `engine/manager.py:319`. |
| 292 | `manager.py:279-284` | El `async_track_state_change_event` de sensores está en `engine/triggers.py:53-58`. |
| 376 | `manager.py:587` | `_async_alert(..., push=False)` es hoy `self._incidents.alert(..., push=False)` (`engine/manager.py:508-523`). |
| 377 | `manager.py:590` | `_async_push_rain_skipped` es hoy `Incidents.push_rain_skipped` (`engine/incidents.py:198-212`), llamado en `engine/manager.py:526`. |
| 418 | `manager.py:592` | `_async_rain_source_alert` es hoy `Incidents.rain_source_alert` (`engine/incidents.py:214-235`), llamado en `engine/manager.py:528`. |
| 425 | `manager.py:623-629` | Los datos de `rain_source_unavailable` se arman en `engine/incidents.py:224-232`. |
| 471 | `manager.py:379-403` | El oyente de switches (`_async_valve_state_changed`) está en `engine/triggers.py:123-166`. |
| 473 | `manager.py:405-433` | `_async_push_switched` es hoy `Incidents.push_switched` (`engine/incidents.py:169-188`), llamado desde `engine/triggers.py:138-141` y `163-166`. |

Dudas de contenido (no son citas; no tocadas):

- Línea 343: la lista de llamadores de `_async_evaluate_lot` está incompleta. Faltan `_async_rain_eval_fired` (`engine/manager.py:382`) y `_async_resume` (`engine/manager.py:567`).
- Líneas 351-359: la tabla de datos de `rain_skipped` no lleva `estimated_mm` (`engine/manager.py:521`).
- Líneas 428-433: la tabla de datos de `rain_source_unavailable` no lleva `estimated` (`engine/incidents.py:231`).
- Línea 4: «Rutas relativas a `custom_components/irrigation_scheduler/`» no vale para los nombres cortos (`manager.py`, `notify.py`, `alerts.py`...). Las rutas reales llevan subcarpeta (`engine/`, `adapters/`, `domain/`). Se mantuvo el formato corto de las vecinas.

## Reescritura (2.ª pasada)

Se reescribieron las 21 filas de la tabla de dudas, más los tres puntos de contenido y la cabecera.
Números de «línea del doc» = los del doc antes de esta pasada (el doc ha ganado líneas al editar).
Rutas del código relativas a `custom_components/irrigation_scheduler/`.

| línea del doc | antes | después | verificado en (archivo:línea) |
|---|---|---|---|
| 4-5 (cabecera) | «Rutas de código relativas a `custom_components/irrigation_scheduler/`.» | Añade: las citas llevan nombre corto (`manager.py:773-808`); subcarpeta (`engine/incidents.py:94-114`) cuando el nombre se repite o hace falta para distinguir | `find` de ficheros `.py`: no hay nombres repetidos salvo `__init__.py` |
| 16-18 | `async_push` (`notify.py:109-136`), `IrrigationManager._async_alert` (`manager.py:791-827`) | `Incidents.alert` (`engine/incidents.py:94-114`), `Incidents._targets` (`engine/incidents.py:48-51`), `Incidents._send` (`engine/incidents.py:63-92`), `compose_notice` (`adapters/notify.py:158-185`), `Notifier.send` (`adapters/notify.py:198-204`) | `engine/incidents.py:48-51`, `63-92`, `83` (`alert_priority`), `94-114`; `adapters/notify.py:158-185`, `198-204` |
| 41 | `manager.py:807-808` | `engine/incidents.py:110-111` | `engine/incidents.py:110` (dispatcher), `111` (bus) |
| 43 | `entity.py` (sin línea) | `entities/base.py` | `entities/base.py:18-107` |
| 45 | `entity.py:88` | `entities/base.py:100` | `entities/base.py:100` (`valve_uid`) |
| 47 | `entity.py:91-96` | `entities/base.py:103-108` | `entities/base.py:103-108` |
| 48 | `entity.py:36` | `entities/base.py:48` | `entities/base.py:48` |
| 49 | `entity.py:57` | `entities/base.py:69` | `entities/base.py:69` |
| 69 | «hora del envío», `async_push` (`notify.py:126`) | «hora en que se compone el aviso», `compose_notice` (`adapters/notify.py:171`, `179`) | `adapters/notify.py:171` (docstring), `179` (`dt_util.now()`) |
| 100 | `_async_valve_error(..., True)` (`manager.py:697-698`, `774-789`) | `Incidents.valve_error(..., True)` (`engine/manager.py:807-808`; cuerpo `engine/incidents.py:116-131`) | `engine/manager.py:807-808`; `engine/incidents.py:116-131` |
| 105 | `manager.py:782-788` | `engine/incidents.py:124-130` | `engine/incidents.py:124-130` |
| 148 | `_async_recover` (`manager.py:170`, `179-180`) | `_async_recover` (`engine/manager.py:254`) → `_async_close_failed` (`engine/manager.py:266-267`) | `engine/manager.py:253-267` |
| 228 | condición en `manager.py:239` | `status.overdue_valves` (`engine/status.py:65-74`, condición `73`), llamada en `engine/manager.py:313-317` | `engine/status.py:73`; `engine/manager.py:315` |
| 262 | `_manual_on` (`manager.py:751-762`) | `IrrigationManager.manual_on` (`engine/manager.py:862-868`) → `manual_on` (`engine/manual.py:14-24`) | `engine/manager.py:862-868`; `engine/manual.py:14-24` |
| 264 | `manager.py:242-246` | latido (`engine/manager.py:319`) → `status.manual_overdue` (`engine/status.py:77-85`); `last_changed` en `engine/manual.py:23`, `27-29` | `engine/manager.py:319`; `engine/status.py:77-85`; `engine/manual.py:23`, `27-29` |
| 292 | `manager.py:279-284` | `engine/triggers.py:54-58` | `engine/triggers.py:54-58` |
| 343 | llamadores: `_async_block_fired`, `_async_recover_rain`, arranque | añade `_async_rain_eval_fired` (`manager.py:382`), `_async_resume` (`manager.py:567`), `_async_quiet_end` (`manager.py:758`) | `grep _async_evaluate_lot`: `engine/manager.py:151`, `365`, `382`, `483`, `567`, `758` |
| 351-359 | tabla sin `estimated_mm` | fila `estimated_mm` (float \| null) | `engine/manager.py:521`; `domain/rain.py:69-70` (comentario: `None` sin previsión válida), `229-230` (`round_mm`) |
| 376 | `_async_alert(..., push=False)` (`manager.py:587`) | `Incidents.alert(..., push=False)` (`engine/manager.py:508-524`) | `engine/manager.py:508-524` |
| 377 | `_async_push_rain_skipped` (`manager.py:590`) | `Incidents.push_rain_skipped` (`engine/incidents.py:198-212`), llamado en `engine/manager.py:526` | `engine/incidents.py:198-212`; `engine/manager.py:525-526` |
| 418 | `_async_rain_source_alert` (`manager.py:592`) | `Incidents.rain_source_alert` (`engine/incidents.py:214-235`), llamada en `engine/manager.py:527-528` | `engine/incidents.py:214-235`; `engine/manager.py:527-528` |
| 425 | `manager.py:623-629` | `engine/incidents.py:224-232` | `engine/incidents.py:224-232` |
| 428-433 | tabla sin `estimated` | fila `estimated` (bool) | `engine/incidents.py:231`; `domain/rain.py:87-90` (`estimate_in_use`) |
| 471 | `manager.py:379-403` | `engine/triggers.py:129-133` (filtro off↔on) | `engine/triggers.py:129-133` |
| 473 | `_async_push_switched` (`manager.py:405-433`), `async_push` | `Incidents.push_switched` (`engine/incidents.py:169-188`), llamado desde `Triggers._async_valve_state_changed` (`engine/triggers.py:124-166`; `138-141`, `163-166`), que llama a `Incidents._send` (`engine/incidents.py:188`) | `engine/incidents.py:169-188`; `engine/triggers.py:124-166` |

Correcciones a esta tabla de la 1.ª pasada: las líneas de `engine/status.py` que daba (`110`, `114-122`) estaban mal;
el fichero tiene 85 líneas. Las reales son `engine/status.py:65-74` y `77-85`. Faltaba el llamador
`_async_quiet_end` (`engine/manager.py:758`) de `_async_evaluate_lot`.

### Dudas que quedan (no tocadas)

- §7, `reason` (doc líneas 349 y 356): hoy puede valer también `rain_estimated`
  (`domain/rain.py:14`, `206-207`). El orden de decisión es pasada, estimada, prevista
  (`domain/rain.py:202-209`). El doc dice «`rain_past` \| `rain_forecast`» y «si se cumplen las dos
  condiciones, `reason` es `rain_past`». Cambió el sentido, no solo el sitio. Ver
  `docs/features/rain-skip/rain-estimated-design.md`.
- §7, disparadores (doc líneas 329-337): el doc lista dos casos (T−10 y bloques perdidos). El código
  evalúa lotes también al acabar la franja de horario silencioso (`engine/manager.py:758`) y al
  decidir una reanudación (`engine/manager.py:567`). Solo se añadieron a la lista de llamadores.
- §0.1 punto 4 (doc líneas 15-21): `Incidents._targets` también resuelve altavoces de voz
  (`engine/incidents.py:48-51`, `adapters/notify.py:150-155`, `208`). El doc solo habla de móviles.
- §5 (doc líneas 257-258): `_track_manual` y `_manual_ends` son hoy `Triggers.track_manual`
  (`engine/triggers.py:85`) y `manual_ends` (`engine/manual.py:27`). Sin cita de línea; no tocado.
  `_async_manual_due` sigue en `engine/manager.py:870`.
- §10 (doc líneas 501-502): `_async_supply_changed` y `_async_valve_state_changed` viven en
  `engine/triggers.py:169` y `124`; `_async_no_water` en `engine/manager.py:401`. Sin cita de línea; no tocado.
- §5 (doc línea 262): `manual_on` también excluye switches con reintentos de cierre
  (`engine/manager.py:867`). La frase dice solo «abiertas, abriéndose ni cerrándose». Es cierto pero incompleto.
- §1 (doc línea 99): la llamada a `valve_error` solo ocurre si además no se canceló y HA no está parando
  (`engine/manager.py:807`). La frase dice solo «devuelve `False`». Es cierto pero incompleto.
- Línea 69: «hora del envío» pasó a «hora en que se compone el aviso». El docstring de `compose_notice`
  dice «con la hora de ahora, no la del envío» (`adapters/notify.py:171`). Cambio de redacción mío; revisar.
