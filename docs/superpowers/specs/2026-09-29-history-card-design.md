# Tarjeta de histórico de riego — diseño

Fecha: 2026-09-29.

## Problema

No hay forma de ver qué válvulas se han encendido y cuánto tiempo real han estado encendidas.
La integración no guarda histórico: al cerrar una válvula su registro sale de `open_valves`
(`custom_components/irrigation_scheduler/manager.py:348`) y el `batch_started` de la zona se
poda (`manager.py:416-425`). `OpenValve.ends_at` es el fin previsto, no el real
(`runtime.py:25-29`). Las encendidas a mano no dejan registro (`manager.py:356-367`).

## Objetivo

Una tarjeta Lovelace propia, `irrigation-history-card`, que muestra en una ventana de tiempo
las válvulas encendidas, agrupadas por zona, y su tiempo real encendido
(**tiempo real = hora real de apagado − hora real de encendido**). Tres vistas: lista, línea de
tiempo y totales.

## Decisiones

1. **Fuente: el recorder de HA**, sin histórico propio. Los cambios `on`/`off` de cada switch
   son la hora real y cubren todos los orígenes (bloques, «regar ahora», manual). Retención por
   defecto de 10 días: suficiente.
2. **Ventana máxima: 7 días** (`MAX_WINDOW_DAYS`, definida solo en `shared/time-window.ts`).
3. **Tarjeta nueva e independiente**, no una sección de `irrigation-card.ts`.
4. **Vistas con chips** dentro de la tarjeta; la configuración fija solo la vista inicial.
5. **Ventana relativa y rango absoluto**: chips relativos por defecto y modo «Rango».
6. **Solo frontend**: la tarjeta llama a `history/history_during_period` de HA. Sin comando WS
   nuevo, sin dependencia `recorder` en `manifest.json`, sin cambios de backend.
7. **Sin tests.** Solo gates estáticos baratos (ver «Verificación»).

## Arquitectura

```
recorder ──► api.ts: fetchValveHistory()      transiciones crudas por entity_id
                │
snapshot ──►  shared/valve-history.ts          función pura → ZoneHistory[]
(store.ts)      │
                ▼
          card/history-card.ts                 estado: ventana y vista; carga y refresco
                │
                └─► card/history-views.ts      historyList / historyTimeline / historyTotals
```

El cálculo no pinta y las vistas no calculan. Un cambio en la regla de «tiempo real» toca solo
`valve-history.ts`.

### Unidades

| Fichero | Responsabilidad | Depende de |
|---|---|---|
| `frontend/src/api.ts` (se amplía) | `fetchValveHistory(hass, entityIds, start, end)`: `history/history_during_period` con `minimal_response: true`, `no_attributes: true`. Solo transporte y tipos de la respuesta. | `Hass` |
| `frontend/src/shared/time-window.ts` | Tipo `TimeWindow` y `resolveWindow(window, now)` → `{ start, end }` acotado. `MAX_WINDOW_DAYS = 7`. Conversión fecha/hora local de HA ↔ instante y marcas del eje. | nada |
| `frontend/src/shared/valve-history.ts` | `buildHistory(history, zones, range)` → `ZoneHistory[]`: intervalos, recorte, «en curso», totales y recuentos. | tipos de `api.ts` |
| `frontend/src/card/history-views.ts` | Tres funciones de render sobre `ZoneHistory[]` y sus estilos. | `i18n`, `shared/styles.ts`, `shared/controls.ts` |
| `frontend/src/card/window-picker.ts` | Elemento `irrigation-window-picker`: chips de ventana, «Otra» y, con `allow-range`, «Rango». Emite `window-changed`. Lo usan la tarjeta y el editor. | `shared/time-window.ts`, `i18n` |
| `frontend/src/card/history-card.ts` | Elemento `irrigation-history-card`: chips de vista, selector de ventana, carga, refresco, errores. | todo lo anterior, `SnapshotController`, `TickController` |
| `frontend/src/card/history-editor.ts` | Editor visual: zonas, vista inicial, ventana inicial, título. | `shared/card-config.ts`, `card/window-picker.ts` |
| `frontend/src/shared/card-config.ts` | Configuración común de tarjetas, extraída de `card/card-editor.ts:39-94` e `irrigation-card.ts:60-67,144-153`: validar y resolver `zones`, selector de zonas, título, `config-changed`, avisos del store. La usan las dos tarjetas y los dos editores. | `i18n`, `store.ts`, `shared/controls.ts`, `shared/ha-components.ts` |

### Tipos

```ts
// shared/time-window.ts
type WindowUnit = "hours" | "days";
type TimeWindow =
  | { kind: "relative"; amount: number; unit: WindowUnit }
  | { kind: "range"; start: string; end: string }; // ISO

// shared/valve-history.ts
interface ValveRun extends TimeSpan {   // TimeSpan de api.ts:76, ya recortado a la ventana
  seconds: number;
  ongoing: boolean;       // último estado `on`: fin = fin de la ventana (now si es relativa)
  startsBefore: boolean;  // recortado por el inicio de la ventana
}
interface ValveHistory { valve: Valve; runs: ValveRun[]; seconds: number }
interface ZoneHistory { zone: Zone; valves: ValveHistory[]; seconds: number; count: number }
```

### Reutilización (sin duplicar)

- Intervalo: `ValveRun extends TimeSpan` (`api.ts:76`). No hay un segundo tipo de intervalo.
- Duración: `formatDuration` (`i18n.ts:315`).
- Fecha y hora: `formatDateTime` nueva en `i18n.ts`, reutiliza `langOf` y `dayKey`
  (`i18n.ts:275-294`) con el patrón `Intl` de `formatNextRun`.
- Chips: clases `.chip` / `.chip.on` de `shared/styles.ts:133-145`.
- Chevron de plegar: `CHEVRON_DOWN` / `CHEVRON_UP` y `svgIcon` de `shared/controls.ts`.
- Mapa válvula → zona: snapshot compartido (`SnapshotController`, `store.ts:74`), sin suscripción nueva.
- Repintado cada segundo: `TickController` (`store.ts:115`).
- Selector de zonas, título, `config-changed` y avisos del store: se extraen a
  `shared/card-config.ts`; `card-editor.ts` e `irrigation-card.ts` pasan a usarlo.
- Registro en `window.customCards` (`irrigation-card.ts:340-348`): se extrae a
  `registerCard()` en `shared/ha-components.ts`.

## Reglas de cálculo

Viven solo en `valve-history.ts` y `time-window.ts`.

**Consulta.** Los `entity_id` de las válvulas de las zonas filtradas, en `[start, end]`. HA
incluye el estado vigente en `start`. Hora de cada transición: `lc` si viene, si no `lu`
(formato comprimido de `minimal_response`, en segundos epoch).

**Intervalo.**
1. Empieza al pasar a `on`.
2. Termina en el primer estado posterior distinto de `on` (`off`, `unavailable`, `unknown`).
3. Un `on` tras un `unavailable` es un encendido nuevo.
4. Si el último estado es `on`: fin = `now`, `ongoing = true`. La duración se recalcula en cada
   render sin volver a consultar; se reutilizan las transiciones en caché.

**Bordes.** Los intervalos se recortan a la ventana; totales y línea de tiempo cuentan solo el
tiempo dentro. Un intervalo recortado por el inicio lleva `startsBefore = true` y la lista lo
muestra con «←» delante de la hora.

**Ventana.**
- Relativa: `[now − amount·unit, now]`. Chips 6 h · 24 h · 3 d · 7 d y «Otra» (número + horas/días).
- Rango: inicio y fin dentro de los últimos 7 días, fin > inicio. Se eligen en la zona horaria
  de HA (`hass.config.time_zone`), la misma con que se muestran.
- `resolveWindow` acota siempre: duración ≤ 7 días, inicio ≥ `now − 7 d`, fin ≤ `now`. El
  selector no deja elegir fuera de rango; la acotación es la red de seguridad.

**Agrupación.** Por la configuración actual del snapshot. V7 (`validation.py:60-75`) garantiza
una switch por zona. Zonas: las de `zones` de la tarjeta, o todas si está vacía (misma regla que
`irrigation-card.ts:149`). Una zona configurada que ya no existe se omite. `ZoneHistory`
incluye todas las válvulas; cada vista decide qué muestra.

**Refresco.**
- Nueva consulta al cambiar la ventana o las zonas.
- Ventana relativa: también al llegar un snapshot nuevo, con debounce de 2 s (el snapshot se
  emite en cada cambio de estado de las válvulas, `manager.py:254-255`).
- Rango: una sola consulta.
- Una respuesta de una consulta anterior a la vigente se descarta.

**Errores.**
- Falla la llamada WS (recorder no cargado u otro error): «Histórico no disponible».
- Una switch excluida del recorder sale sin encendidos; la ayuda del editor lo advierte.
- Sin snapshot: los mismos mensajes que la tarjeta actual (`not_loaded`, `load_error`,
  `loading`; `irrigation-card.ts:145-147`).

## Interfaz

### Configuración

```yaml
type: custom:irrigation-history-card
title: Histórico de riego            # opcional
zones: [zona_a, zona_b]              # vacío = todas
view: list                           # list | timeline | totals; por defecto list
window: { amount: 24, unit: hours }  # solo relativa; por defecto 24 h
```

`setConfig` valida `zones` como la tarjeta actual (`irrigation-card.ts:60-67`) y aplica los
valores por defecto; un `window` inválido cae en 24 h tras pasar por `resolveWindow`. El rango
absoluto no se guarda en configuración: vive en el estado de la tarjeta.

### Tarjeta

```
┌ Histórico de riego ───────────────────────┐
│ [Lista] [Línea de tiempo] [Totales]       │
│ [6 h] [24 h] [3 d] [7 d] [Otra…] [Rango…] │
│   Otra:  [ 12 ] [horas ▾]                 │  solo con «Otra»
│   Rango: [desde] [hasta]                  │  solo con «Rango»
│ ───────────────────────────────────────── │
│   vista activa                            │
└───────────────────────────────────────────┘
```

El rango usa `<input type="datetime-local">` nativo con `min`/`max` (hoy − 7 d … ahora),
leído y mostrado en la zona horaria de HA. `ha-selector` `datetime` no admite límites.

### Vista Lista

```
▾ Jardín delantero                 3 · 1:42:10
    Goteo seto
      lun 07:00 → 07:29            29:02
      lun 20:00 → en curso         12:40
    Aspersor césped
      ← 07:00 → 07:22              22:05
▸ Huerto                           1 · 0:30:00
```

Zonas plegables, plegadas al inicio. Encendidos del más reciente al más antiguo. Oculta las
válvulas sin encendidos; una zona sin ninguno muestra «Sin riegos en la ventana».

### Vista Línea de tiempo

Una fila por válvula con encendidos, agrupadas bajo su zona. SVG al ancho de la tarjeta, sin
scroll horizontal. Eje en horas si la ventana es ≤ 24 h, en días si es mayor. Barra mínima del
0,6 % del eje (~2 px); las barras en curso con otro tono. `<title>` por barra: «inicio → fin · duración». Zona
sin encendidos: «Sin riegos en la ventana».

### Vista Totales

```
Jardín delantero     3 encendidos   1:42:10
  Goteo seto         2              0:58:00
  Aspersor césped    1              0:44:10
Huerto               1 encendido    0:30:00
  Goteo tomates      1              0:30:00
```

Muestra todas las válvulas, también con 0.

### Editor

Zonas (`zonePicker` de `shared/card-config.ts`), vista inicial (3 chips), ventana inicial (chips relativos y
«Otra»), título (`ha-selector` de texto, como `card-editor.ts:86-94`). Ayuda: «Datos del
recorder de HA. Las switch excluidas del recorder aparecen sin riegos».

### Textos y registro

- Claves nuevas en `ES` y `EN` de `i18n.ts`; sin textos fijos en el código.
- `main.ts` importa `./card/history-card` y `./card/history-editor`. Mismo bundle y mismo
  recurso Lovelace (`card_resource.py`); el backend no cambia.
- `window.customCards` recibe la entrada `irrigation-history-card` con `preview: true`.

## Fuera de alcance

- Origen del encendido (bloque, manual, «regar ahora»): `minimal_response` no trae `context`.
- Comparación con la duración prevista.
- Ventanas de más de 7 días e histórico propio persistido.
- Válvulas que cambiaron de zona o zonas borradas: se agrupa por la configuración actual.

## Verificación

Sin tests (excepción del usuario a TDD, `docs/superpowers/plans/2026-09-28-frontend.md:15`).
Checks baratos:

- Por tarea: `npx tsc --noEmit` en `frontend/`.
- Al final: `npm run lint` (`--max-warnings 0`) y `npm run build`, que regenera
  `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js` (se commitea).
- El backend no se toca: sin ruff ni compileall.

Revisión inline al cerrar cada tarea: el cálculo solo en `valve-history.ts` y `time-window.ts`;
las vistas sin cálculo; `MAX_WINDOW_DAYS` definida una vez; `card-editor.ts` usa
`shared/card-config.ts` y no conserva su copia.

El usuario valida en su HA 2026.9.
