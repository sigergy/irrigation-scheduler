# Pop up de eventos en la línea de tiempo del histórico — diseño

Fecha: 2026-09-30.

## Problema

En la vista «Línea de tiempo» de la tarjeta de histórico, cada barra lleva solo un `<title>`
nativo del SVG con horas y duración (`frontend/src/card/history-views.ts:94-97`). Faltan tres cosas:

1. **Saber el origen del riego.** El recorder solo guarda on/off de la switch
   (`history-card.ts:142`, `api.ts:223-231`). La integración no guarda el origen: `Job`
   (`runtime.py:13-21`) y `OpenValve` (`runtime.py:25-29`) no tienen ese campo.
2. **Ver las alertas.** La tarjeta no pinta ninguna, aunque la spec de alertas lo prevé
   (`docs/alerts/README.md:18`). Son los errores de encendido y apagado, la omisión por lluvia, etc.
3. **Un pop up legible.** El `<title>` tarda ~1 s en salir, no admite estilo y no funciona en el
   móvil.

## Objetivo

Al pasar el ratón, o al tocar en el móvil, sobre una barra o una marca de la línea de tiempo, se
abre un pop up:
- en un riego: el título (Riego programado / manual / externo), el inicio y el fin, y el
  **tiempo real regado**;
- en una alerta: el título del tipo y la hora.

## Decisiones

1. **El origen lo registra el backend como estado de una entidad por válvula**, para que el
   recorder de HA lo guarde. Es un `sensor` enum nuevo. Se descarta usar un tipo más en la
   entidad `event`, porque mezclaría riegos con alertas y dispararía las automatizaciones de
   alertas.
2. **Pop up propio**, con estilo de HA, que sustituye al `<title>` nativo.
3. **Marcas en su fila** para las alertas, con un icono por tipo. Se descartan las barras de
   color, porque una alerta no tiene duración.
4. **Riego sin origen conocido** (anterior a la actualización, o con el sensor no disponible):
   título «Riego».
5. **Alcance: solo la vista «Línea de tiempo».** Las vistas Lista y Totales no cambian.
6. **Sin tests.** Solo gates estáticos (ver «Verificación»).

## Backend

### Sensor «Modo riego» (uno por válvula configurada)

| Campo | Valor |
|---|---|
| `entity_id` | `sensor.modo_riego_{nombre_disp}` |
| Nombre visible | «Modo riego» (HA antepone el dispositivo en las listas globales) |
| `device_class` | `enum` |
| Estados | `idle` · `scheduled` · `manual` · `external` |
| Textos ES | Parado · Programado · Manual · Externo |
| Textos EN | Idle · Scheduled · Manual · External |
| Dispositivo | El mismo que la entidad `event` de alertas de válvula: el de la switch o, si la switch no tiene, el de la zona (`event.py:105-109`) |
| `unique_id` | Prefijo `zone_id`, igual que `event.py:100`, para que borrar la zona lo borre (`manager._remove_zone_entities`) |

`{nombre_disp}` es el nombre del dispositivo de la switch. Si la switch no tiene dispositivo, se
usa el nombre de la válvula.

Significado de cada estado:
- `idle`: válvula cerrada;
- `scheduled`: la abre un bloque del horario;
- `manual`: la abre «Regar zona/válvula ahora», desde el panel, la tarjeta o los servicios
  `run_zone` y `run_valve`;
- `external`: la switch se enciende fuera de la integración, el caso de `_manual_on`
  (`manager.py:682`).

### Origen en la ejecución

- `Job` y `OpenValve` ganan un campo `origin` con los valores `scheduled`, `manual` o `external`.
- `OpenValve.to_dict`/`from_dict` lo persisten. Si un dato guardado no lo trae, se lee como
  `manual`.
- Una pausa seguida de reanudación conserva el origen del trabajo.
- El sensor pasa al origen **antes** del `turn_on`. Vuelve a `idle` al cerrar la válvula y también
  si el encendido falla (`turn_on_failed`).
- En `external`, el sensor pasa a `external` al detectar la switch encendida y vuelve a `idle` al
  apagarse.

### Renombrado de las entidades de alertas

| Nivel | `entity_id` | Nombre visible |
|---|---|---|
| Válvula | `event.alertas_riego_{nombre_disp}` | «Alertas riego» |
| Zona | `event.alertas_riego_{zona}` | «Alertas riego» |
| Instalación | `event.alertas_riego_instalacion` | «Alertas riego» |

Hoy los nombres son «Alertas {valve}» (`translations/es.json:39-40`) y «Alertas»
(`translations/es.json:22-23`). Las entidades ya creadas conservan su `entity_id` en el registro;
el nuevo solo se aplica al crearlas otra vez. El nombre visible sí cambia para todas.

**VERIFICAR en el plan**, contra las fuentes de HA 2026.9: cómo proponer un `entity_id` exacto
(`modo_riego_…`, `alertas_riego_…`) cuando la entidad tiene `has_entity_name` y dispositivo. Si
HA no lo permite sin efectos secundarios, parar y preguntar.

### Snapshot

El snapshot del websocket añade los `entity_id` que necesita la tarjeta, resueltos en el registro
de entidades por `unique_id`:
- por válvula: el del sensor «Modo riego» y el de su `event` de alertas;
- por zona: el de su `event` de alertas;
- global: el `event` de alertas de instalación.

Una entidad que no esté en el registro va como `null`. La tarjeta la omite.

## Frontend

### Datos

`history-card.ts` hace dos llamadas en paralelo sobre la misma ventana:
1. switch + sensores «Modo riego», en formato mínimo (como `fetchValveHistory` hoy);
2. entidades `event` de alertas, **con atributos** (`event_type`).

Si falla la segunda, se pintan los riegos sin marcas y no se muestra error. Si falla la primera,
se comporta como hoy (`_error`).

### Origen de cada barra

Cada barra es un periodo on de la switch (`ValveRun`, `shared/valve-history.ts`). Su origen es el
del primer estado del sensor distinto de `idle` que se solape con la barra.

| Estado del sensor | Título |
|---|---|
| `scheduled` | Riego programado |
| `manual` | Riego manual |
| `external` | Riego externo |
| sin dato / `unavailable` / `unknown` | Riego |

El cruce es una función pura en `shared/`, junto a `valve-history.ts`.

### Tiempo regado

Es `ValveRun.seconds`: la duración real on→off de la switch, que ya se calcula.
- Una pausa con reanudación da dos barras, cada una con su tiempo.
- Si el riego empezó antes de la ventana (`startsBefore`), se cuenta solo la parte visible y el
  pop up añade «desde antes de la ventana».
- Si sigue en curso, el fin se muestra como «en curso».

### Marcas de alerta

Cada cambio de estado de una entidad `event` es una alerta, situada en su `last_changed`. Su tipo
viene del atributo `event_type`. Solo se pintan los tipos con `show_in_history` activo
(`alertConfig`, `frontend/src/alerts.ts`).

| Tipo | Título | Icono mdi | Color | Fila |
|---|---|---|---|---|
| `turn_on_failed` | La válvula no enciende | `mdi:water-off` | `--error-color` | Válvula |
| `turn_off_failed` | La válvula no apaga | `mdi:water-alert` | `--error-color` | Válvula |
| `overrun_restart` | Tiempo excedido con HA parado | `mdi:timer-alert-outline` | `--warning-color` | Válvula |
| `overrun_running` | Tiempo excedido con HA en marcha | `mdi:timer-alert-outline` | `--warning-color` | Válvula |
| `manual_overrun` | Encendida a mano demasiado tiempo | `mdi:hand-back-right-outline` | `--warning-color` | Válvula |
| `sensor_unavailable` | Sensor de zona caído | `mdi:access-point-network-off` | `--warning-color` | Zona |
| `rain_skipped` | Riego omitido por lluvia | `mdi:weather-pouring` | `--info-color` | Zona |
| `rain_source_unavailable` | Fuente de lluvia no disponible | `mdi:weather-cloudy-alert` | `--warning-color` | Instalación |

- Los títulos reutilizan las claves `alert_<tipo>` que ya existen en `frontend/src/i18n.ts` (por
  ejemplo, `i18n.ts:133`).
- Los iconos son trazados SVG en línea, como `shared/controls.ts:13-16`. **VERIFICAR** cada nombre
  contra `@mdi/js`. Si alguno no existe, parar y preguntar; no se sustituye por otro.
- Criterio de color: rojo si la válvula hace lo contrario de lo pedido; naranja para lo que ya se
  resolvió o solo avisa; azul para la omisión por lluvia, que es una decisión correcta.

### Filas

- Válvula: se muestra si tiene riegos **o** marcas en la ventana. Hoy `withRuns`
  (`history-views.ts:41`) oculta las válvulas sin riegos.
- Zona: si tiene marcas de zona, su título pasa a ser título + pista. Si no, queda como hoy.
- Instalación: fila «Instalación» encima de las zonas, solo si hay marcas de instalación.

### Pop up

```
┌────────────────────────┐    ┌──────────────────────────┐
│ Riego programado       │    │ La válvula no enciende   │
│ lun 30 07:00 → 07:03   │    │ lun 30 07:00             │
│ Tiempo regado: 3 min   │    └──────────────────────────┘
└────────────────────────┘
```

- Hay un único pop up por tarjeta, con `--card-background-color`, sombra y borde redondeado.
- Ratón: aparece al entrar en la barra o la marca y se va al salir.
- Táctil: aparece al tocar y se cierra al tocar fuera.
- Se coloca encima del elemento. Si no cabe, va debajo, y se ajusta al ancho de la tarjeta.
- Las marcas tienen una zona sensible más ancha que el icono.
- Se retira el `<title>` de `history-views.ts:95-97`.
- Todos los textos van vía `t(hass, key)`, en ES y EN.

## Documentación

- `README.md` (lo muestra HACS, `hacs.json`: `render_readme: true`), sección «Entidades»:
  - añadir «Modo riego» (por válvula) y «Alertas riego» (por válvula, zona e instalación);
  - añadir la tabla de marcas del histórico (tipo, título, icono, color y fila).
- `docs/alerts/README.md`: nombres nuevos de las entidades `event`.
- `docs/specs/02-frontend.md` (sección del histórico): el pop up y las marcas.

## Verificación

- Backend: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
- Frontend (en `frontend/`): `npx tsc --noEmit`, `npm run lint` y `npm run build`. El bundle se
  commitea.
- El usuario valida en su HA 2026.9. Aquí no se levantan servidores ni navegador.
