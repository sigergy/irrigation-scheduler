# Contraste de `rain-skip/rain-estimated-design.md` con el código

Fecha: 2026-10-06. Rama: `sigergy/ha-restart-fallbacks-impl`. Solo lectura: ni el doc ni el código se tocaron.
Rutas de código relativas a `custom_components/irrigation_scheduler/`.

## 1. Citas `archivo:línea` mal

| Línea doc | Cita del doc | Estado | Cita corregida |
|---|---|---|---|
| 11 | `engine/rain_control.py:105` | OK | `engine/rain_control.py:105` (usa `dt_util.utcnow()`) |
| 68 | `domain/runtime.py:83` (`RuntimeState`) | Mal | clase en `domain/runtime.py:109`; campo `forecast_log` en `domain/runtime.py:123` |
| 81 | `domain/rain.py:125` (`forecast_rain_mm`) | Mal | `domain/rain.py:145` |
| 83 | `domain/rain.py:152` (`predict`) | Mal | `domain/rain.py:215` |
| 100 | `adapters/store.py:44` (`schedule_save_runtime`) | OK | `adapters/store.py:44` |
| 106 | `sensor.py:162` (junto a `rain_past` y `rain_forecast`) | Mal | `RainPastSensor` `sensor.py:157`, `RainForecastSensor` `sensor.py:177`, `RainEstimatedSensor` `sensor.py:196`; mapa `RAIN_SENSORS` `sensor.py:218-222`; alta condicionada `sensor.py:56-62` |
| 113 | `adapters/notify.py:47` (`{zone} {start} ({amount} {reason})`) | Mal | `adapters/notify.py:67` (ES) y `adapters/notify.py:106` (EN) |
| 123 | `engine/incidents.py:164` (`rain_other`) | Mal | texto en `adapters/notify.py:75` (ES) y `adapters/notify.py:114` (EN); selección en `engine/incidents.py:238-244` (`_outcome`) |
| 134 | `engine/manager.py:383-397` (evento `block_skipped`) | Mal | `engine/manager.py:507-524`; diccionario `engine/manager.py:513-522`; `estimated_mm` en `engine/manager.py:521` |
| 139 | `frontend/src/i18n.ts:171` | Mal | `frontend/src/i18n.ts:205-206` (ES) y `frontend/src/i18n.ts:445-446` (EN) |
| 139 | `settings-view.ts:317` | Mal | `frontend/src/panel/settings-view.ts:513-519` (uso de `rain_forecast_rule`) |
| 148 | `strings.json`, `translations/*.json` | OK | `strings.json:71`, `translations/en.json:71`, `translations/es.json:71` |

Nota: la l.99 cita `manager.async_refresh_rain`. Existe en `engine/manager.py:439`.

## 2. Afirmaciones de comportamiento que no coinciden

1. Doc l.61-62 (§4): push con texto «Riego saltado por lluvia estimada (6.2 mm en las últimas 24 h)».
   Código: `adapters/notify.py:60` compone «Riego saltado por lluvia: {zones}…» con `rain_zone` (`adapters/notify.py:67`) y motivo corto «estimados» (`adapters/notify.py:70`).
   El texto de §4 no existe. §6.1 del propio doc sí coincide. §4 y §6.1 se contradicen; manda §6.1.
2. Doc l.47 (§4): `estimated_mm` «se calcula si hay weather».
   Código: `engine/manager.py:445-446` exige `forecast_configured` y `engine/manager.py:462-463` exige además previsión válida (`state.forecast is not None`). Con weather configurado pero caído, `estimated_mm` es `None`.
3. Doc l.74 (§5.2): fusión «en cada `refresh()` con previsión válida».
   Código: no está en `RainControl.refresh()` (`engine/rain_control.py:84`). Está en `IrrigationManager._async_estimate_rain` (`engine/manager.py:450-464`), llamado desde `async_refresh_rain` (`engine/manager.py:444-446`). Mismo efecto, otro lugar. §5.5 lo dice bien.
4. Doc l.75 (§5.2): «tramo con inicio ≥ la hora en curso sobreescribe».
   Código: `domain/rain.py:173` compara `slot.start >= now` (instante actual, no inicio de la hora en curso). Redacción ambigua, no error de fondo.
5. Doc l.130 (§6.2): el evento añade `"estimated": true`.
   Código: `engine/incidents.py:231` añade siempre la clave `"estimated"` con `state.estimate_in_use`; puede ser `false`.
6. Doc l.123-124 (§6.2): desenlace `rain_estimate` si la estimación entra de respaldo.
   Código: `engine/incidents.py:242-243` exige `state.past_configured and state.estimate_in_use`. Falta la condición `past_configured` en el doc.
7. Sin diferencias (verificado OK):
   - Orden de motivos y D5: `domain/rain.py:202-209`.
   - `all_failed`: `domain/rain.py:79-85`, `domain/rain.py:210-212` (código añade `configured`).
   - Purga 25 h / 24 h: `domain/rain.py:28-29`, `domain/rain.py:175-179`.
   - Sensor solo con weather: `sensor.py:61`, `adapters/registry.py:48-50`; atributo `hours` `sensor.py:215`.
   - Textos del panel §6.4: idénticos a `frontend/src/i18n.ts:206` y `frontend/src/i18n.ts:446`.
   - Persistencia `to_dict`/`from_dict`: `domain/runtime.py:198`, `domain/runtime.py:227-229`.
   - Predicción con el registro desde `evaluate_at`: `domain/rain.py:222-225`.

## 3. Nombres que cambiaron o no existen

- `05-rain-skip.md` (doc l.12, §4.1): no existe en `docs/`. La spec vigente es `docs/features/rain-skip/spec.md`. En ella, la «regla de §4.1» (`docs/features/rain-skip/spec.md:178`) no tiene encabezado `### 4.1`; solo existe `## 4.` (`docs/features/rain-skip/spec.md:44`).
- `settings-view.ts` (l.139): ruta real `frontend/src/panel/settings-view.ts`.
- `estimated_rain_mm(log, now, hours) -> float` (l.96): `log` ya no es el dict. Recibe `slots: Iterable[ForecastSlot]` (`domain/rain.py:186`). Función extra `log_slots` convierte dict a tuplas (`domain/rain.py:182`).
- `decide(...)` (l.97): firma real `decide(settings, past_mm, forecast_mm, estimated_mm=None)` (`domain/rain.py:192-197`).
- Símbolos nuevos no citados en el doc:
  - `REASON_ESTIMATED` (`domain/rain.py:14`).
  - `LOG_KEEP_PAST`, `LOG_KEEP_AHEAD` (`domain/rain.py:28-29`).
  - `RainState.forecast_log` (`domain/rain.py:72`) y `RainState.estimate_in_use` (`domain/rain.py:88`).
  - `RainControl.set_estimate` (`engine/rain_control.py:124`): guarda `estimated_mm` y el registro; el manager lo llama.
  - `IrrigationManager._async_estimate_rain` (`engine/manager.py:450`).
- Existen tal como dice el doc: `merge_forecast` (`domain/rain.py:163`), `RainState.estimated_mm` (`domain/rain.py:70`), `RuntimeState.forecast_log` (`domain/runtime.py:123`), claves `rain_estimated` / `rain_estimate` (`adapters/notify.py:70,76,109,115`), sensor `rain_estimated` (`sensor.py:196`), commit `0eb62cb` (existe en el repo).

## 4. Dudas

1. Cita `05-rain-skip.md §4.1`: no se sabe a qué apartado de `spec.md` apunta. Decide el autor.
2. §5.2 «a T−10»: el código refresca cada hora (`const.py:44`), con debounce de 60 s al cambiar el pluviómetro (`const.py:45`) y en `_async_evaluate_lot` solo si no llega estado (`engine/manager.py:496-497`). No encontré un refresco programado aparte a T−10 en `engine/manager.py`. No se leyó `engine/triggers.py` entero (no hay coincidencias de `refresh`, `soon` ni `evaluate` en él).
3. D8 y §7 («sin tests automatizados»): existe `engine/tests/`. No se comprobó si cubre `rain_estimated`. Fuera del alcance.
4. Gates de §7 (`uvx ruff check`, `py -3.14 -m compileall`, build del frontend): no se ejecutaron ni se contrastaron con la configuración actual.

## Correcciones aplicadas

Líneas del doc anteriores a la edición (algunas crecen por las citas añadidas).

- l.12: `05-rain-skip.md` → `spec.md` (el `§4.1` se deja; ver duda 1).
- l.47: `estimated_mm` «si hay weather» → «si hay weather con previsión válida».
- l.61-62: ejemplo de push de §4 → el de §6.1 («Riego saltado por lluvia: Césped 07:00 (6.2 mm estimados)»).
- l.68: `domain/runtime.py:83` → clase `:109`, campo `:123`.
- l.74: «En cada `refresh()`» → `_async_estimate_rain` (`engine/manager.py:450`) llamado desde `async_refresh_rain`.
- l.75: «≥ la hora en curso» → «≥ ahora (`slot.start >= now`, `domain/rain.py:173`)».
- l.81: `domain/rain.py:125` → `:145`.
- l.83: `domain/rain.py:152` → `:215`.
- l.96: `estimated_rain_mm(log, ...)` → `estimated_rain_mm(slots, ...)`; añadida `log_slots`.
- l.97: `decide(...)` → firma real `decide(settings, past_mm, forecast_mm, estimated_mm=None)`.
- l.98: `RainState` cita también `forecast_log` y `estimate_in_use`; añadidos `RainControl.set_estimate` (`engine/rain_control.py:124`) y `REASON_ESTIMATED`, `LOG_KEEP_PAST`, `LOG_KEEP_AHEAD`.
- l.99: `async_refresh_rain` → cita `_async_estimate_rain` como quien fusiona.
- l.106: `sensor.py:162` → clases `:157`, `:177`, `:196` y `RAIN_SENSORS` `:218-222`.
- l.113: `adapters/notify.py:47` → `:67` (ES), `:106` (EN).
- l.123: `engine/incidents.py:164` → `adapters/notify.py:75` / `:114` y `_outcome` `engine/incidents.py:238-244`.
- l.124: «Si la estimación entra de respaldo» → añade «hay pluviómetro configurado» (`past_configured and estimate_in_use`).
- l.130: `"estimated": true` → clave `"estimated"` con `estimate_in_use` (`engine/incidents.py:231`).
- l.134: `engine/manager.py:383-397` → `:507-524` (`estimated_mm` en `:521`).
- l.139: `i18n.ts:171` → `:205-206` ES y `445-446` EN; `settings-view.ts:317` → `frontend/src/panel/settings-view.ts:513-519`.
- l.148: `strings.json`, `translations/*.json` → añade `:71`.

Sin tocar: dudas 1-4 de §4 de este informe.

## Dudas resueltas (revisión del orquestador)

1. `spec.md` §4.1 (doc l.12): es la condición 1 («Pasada») de la lista de §4. La propia spec usa
   esa notación: «regla de §4.1» en `docs/features/rain-skip/spec.md:178`. Sin cambio.
2. «a T−10» (doc l.74): existe. `_async_rain_eval_fired` (`engine/manager.py:373-374`) llama a
   `_async_evaluate_lot` sin estado, que llama a `async_refresh_rain` (`engine/manager.py:448-449`),
   y esta a `_async_estimate_rain` (`engine/manager.py:446`). Sin cambio.
3. «sin tests automatizados» (D8, §7): ningún test de `engine/tests/` cita `rain_estimated`,
   `estimated_rain_mm` ni `REASON_ESTIMATED`. La afirmación vale para esta feature. Sin cambio.
4. Gates de §7: `uvx ruff check custom_components`, `py -3.14 -m compileall -q custom_components`
   y el build del frontend son los gates actuales del proyecto. Sin cambio.
