# Lluvia pasada estimada desde la previsión — diseño

Estado: **aplicado** (2026-10-03, commit `0eb62cb`). Amplía [`spec.md`](spec.md).

## 1. Problema

Noche del 2026-10-02 al 03: llovió desde las 23:00 y se ejecutaron los riegos de las 07:00 y las 08:00.

- La instalación no tiene pluviómetro (`rain_sensor`), solo entidad weather.
- La condición de previsión mira solo hacia delante: `forecast_rain_mm(slots, utcnow(), rain_forecast_hours)`
  (`custom_components/irrigation_scheduler/engine/rain_control.py:105`). La lluvia ya caída no cuenta.
- La lluvia pasada solo se mide con pluviómetro (`05-rain-skip.md` §4.1).

## 2. Restricciones de la fuente (Met.no, integración por defecto de HA)

Fuentes: código de `home-assistant/core` (`components/met`, `components/onboarding/views.py`) y
https://www.home-assistant.io/integrations/met/ — revisado el 2026-10-03, rama `dev`.

- Met.no es la integración meteorológica que HA configura en el onboarding.
- La entidad weather **no** expone precipitación actual ni observada en sus atributos. No crea sensores.
- `weather.get_forecasts` (hourly) empieza en la hora siguiente al último refresco y cubre 48 h.
  Cada hora trae `precipitation` (mm) y `precipitation_probability`.
- Refresca cada 55–65 min.
- El recorder no guarda previsiones. No hay histórico de mm del que tirar: hay que construirlo.

## 3. Decisiones tomadas

| # | Decisión |
|---|---|
| D1 | Se acepta una **estimación en mm** de la lluvia pasada, construida con las previsiones horarias ya vencidas. No es una medida. |
| D2 | La estimación usa la **misma ventana H** (`rain_forecast_hours`) y el **mismo umbral Z** (`rain_forecast_threshold_mm`) que la previsión. No se añaden ajustes. |
| D3 | La **previsión hacia delante no cambia**: omite el bloque si se prevén ≥ Z mm en las próximas H h, haya o no pluviómetro. |
| D4 | El **pluviómetro** sigue siendo la fuente de lluvia pasada cuando existe y funciona. |
| D5 | La estimación se usa **solo si no hay pluviómetro o está caído** (respaldo). Con pluviómetro operativo no se evalúa. |
| D6 | Descartados: sensor plantilla del usuario (exige YAML y mezcla papeles con el pluviómetro) y convertir horas `rainy`/`pouring` a mm (cifra inventada). |
| D7 | La estimación se guarda en un **registro propio** en el runtime, alimentado con cada consulta de previsión (§5). |
| D8 | Sin tests automatizados: regla del proyecto para features. Validación en el HA del usuario. |

## 4. Regla de decisión

Valores calculados a T−10:

| Valor | Fuente | Cuándo |
|---|---|---|
| `past_mm` (medida) | pluviómetro, últimas `rain_past_hours` | hay pluviómetro |
| `forecast_mm` (prevista) | previsión, próximas H h | hay weather |
| `estimated_mm` (estimada, **nuevo**) | registro de previsiones, últimas H h | se calcula si hay weather; cuenta solo si `past_mm` no está disponible |

Se omite el bloque si se cumple cualquiera. El motivo es el primero que se cumpla:

1. `past_mm ≥ rain_past_threshold_mm` → `rain_past`.
2. `estimated_mm ≥ rain_forecast_threshold_mm` → **`rain_estimated`** (nuevo).
3. `forecast_mm ≥ rain_forecast_threshold_mm` → `rain_forecast`.

Fallos:

- Pluviómetro caído: se emite `rain_source_unavailable` como hoy; la decisión usa la estimación.
- «Todas las fuentes fallan» (§8.19) solo si no hay `past_mm`, ni `forecast_mm`, ni `estimated_mm`.
- Registro vacío o incompleto: se suma lo disponible; las horas sin dato cuentan 0. No es fallo (como §8.7).

`rain_estimated` sale en el evento `block_skipped` y en el push con texto propio, por ejemplo
«Riego saltado por lluvia estimada (6.2 mm en las últimas 24 h)».

## 5. Registro de previsiones

### 5.1 Qué se guarda

- Campo nuevo en `RuntimeState` (`domain/runtime.py:83`): `forecast_log: dict[datetime, float]`.
  Clave: inicio de la hora en UTC. Valor: mm previstos para esa hora.
- Se persiste en el store del runtime con `to_dict` / `from_dict`, como `rain_episodes`. Sobrevive a reinicios.

### 5.2 Cómo se llena

- En cada `refresh()` con previsión válida: cada hora, al cambiar el pluviómetro (§8.27) y a T−10.
- Cada tramo con inicio ≥ la hora en curso sobreescribe su entrada.
- Las horas ya empezadas no se tocan: se congelan con la última previsión vista antes de empezar.
  Con Met.no (empieza en la hora siguiente) es la previsión a 1 h vista.

### 5.3 Cómo se lee

- `estimated_mm` = suma del registro en `[ahora − H, ahora]` con `forecast_rain_mm` (`domain/rain.py:125`).
  Los tramos de los extremos cuentan en proporción (§8.6).
- La predicción del `binary_sensor` «se omitirá el próximo riego» (`predict`, `domain/rain.py:152`)
  usa el mismo registro desde su `evaluate_at`. Las horas entre ahora y `evaluate_at` son previsión,
  así que predicción y decisión salen coherentes.

### 5.4 Purga

- Fuera las entradas con inicio anterior a ahora − 25 h (H máxima 24 + la hora en curso).
- Fuera las entradas con inicio posterior a ahora + 24 h.

### 5.5 Reparto de código

- `domain/rain.py` (sin HA), funciones puras:
  - `merge_forecast(log, slots, now) -> dict[datetime, float]`: fusiona y purga.
  - `estimated_rain_mm(log, now, hours) -> float`.
  - `decide(...)` recibe `estimated_mm` y solo lo usa si `past_mm is None` (D5).
- `RainState` gana `estimated_mm: float | None`.
- `manager.async_refresh_rain`: tras `RainControl.refresh()`, toma el lock del manager, fusiona en
  `runtime.forecast_log`, calcula `estimated_mm` y programa el guardado diferido
  (`schedule_save_runtime`, `adapters/store.py:44`).

### 5.6 Visibilidad

- Sensor nuevo `rain_estimated` (mm, atributo `hours`), junto a `rain_past` y `rain_forecast`
  (`sensor.py:162`). Solo existe si hay weather configurado.
- Permite ver en el historial de HA qué estimó la integración.

## 6. Textos y avisos

### 6.1 Push `rain_skipped`

Cada zona se compone como `{zone} {start} ({amount} {reason})` (`adapters/notify.py:47`). Motivo nuevo:

| Clave | ES | EN |
|---|---|---|
| `rain_estimated` | `estimados` | `estimated` |

Ejemplo: «Riego saltado por lluvia: Césped 07:00 (6.2 mm estimados)».

### 6.2 Alerta `rain_source_unavailable` con el pluviómetro caído

Hoy el desenlace es `rain_other` («Se usa la otra fuente.», `engine/incidents.py:164`).
Si la estimación entra de respaldo, el desenlace es una clave nueva:

| Clave | ES | EN |
|---|---|---|
| `rain_estimate` | `Se usa la lluvia estimada con la previsión.` | `Using rain estimated from the forecast.` |

El evento añade `"estimated": true`.

### 6.3 Evento `block_skipped`

Añade `"estimated_mm"` junto a `past_mm` y `forecast_mm` (`engine/manager.py:383-397`).
`reason` puede valer `rain_estimated`.

### 6.4 Panel de ajustes, sección Previsión

Sin campos nuevos. Cambia la regla visible (`frontend/src/i18n.ts:171`, `settings-view.ts:317`):

- ES: «No riega si se prevén {amount} {unit} o más en las próximas {hours} horas. Sin pluviómetro,
  o si falla, tampoco si se estimaron {amount} {unit} o más en las últimas {hours} horas.»
- EN: «Does not water if {amount} {unit} or more is forecast in the next {hours} hours. Without a
  rain gauge, or if it fails, also not if {amount} {unit} or more was estimated in the last {hours} hours.»

### 6.5 Sensor `rain_estimated`

Nombre: ES «Lluvia estimada», EN «Estimated rain» (`strings.json`, `translations/*.json`).

## 7. Validación

- **Sin tests automatizados** (D8). Regla del proyecto para features.
- Gates: `uvx ruff check custom_components`, `py -3.14 -m compileall -q custom_components` y build del frontend.
- Validación funcional en el HA del usuario: con lluvia real, el sensor `rain_estimated` debe subir
  y los bloques a T−10 deben omitirse con motivo `rain_estimated`.
