# 02 · Frontend — panel estilo Chronos

> Estado: **decisiones cerradas** (D16, D28–D37) · Fase 3 · Última actualización: 2026-09-28
> Depende de: `00-overview.md` y `01-backend.md` (API WebSocket).
> Mockups de referencia: `docs/mockups/` (abrir `index.html`).

## 1. Decisiones cerradas que afectan a la UI

- Panel lateral propio (D7).
- Días por zona, como un único selector `L M X J V S D` (D2).
- El selector de entidad de válvula **oculta** las `switch` ya asignadas a otra válvula (D11, V7).
- Selector múltiple de `notify.mobile_app_*` en los ajustes globales (D13).
- `auto` aparece deshabilitado si la zona no tiene método de cálculo (V8).
- Interruptor «omitir por lluvia» en el editor de zona (D20).
- Ajustes de lluvia en los ajustes globales: `rain_sensor`, `weather_entity`, horas y umbrales;
  los campos de horas y umbral se validan con V10 y V11. Vienen rellenos con sus valores por
  defecto: lluvia pasada 24 h y 5 mm; lluvia prevista 12 h y 5 mm.
- Cada válvula elige sus bloques con chips (D38, `00-overview.md` §4.2).

## 2. Diseño (D16, aprobado el 2026-09-28)

- Tecnología: Lit, como los paneles nativos de HA.
- Vistas: lista de zonas, editor de zona y ajustes globales (§4).
- Textos en español e inglés (§6).

## 3. Arquitectura (D28–D30, aprobada el 2026-09-28)

### 3.1 Build (D28)

- TypeScript + Lit + Vite. El fuente vive en `frontend/`, fuera de la integración.
- `npm run build` genera **un único** módulo ES en
  `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`, que se **commitea**.
  HACS lo instala sin compilar.
- Lit va dentro del bundle; no se usa el Lit de HA.
- Tipos de `hass` mínimos y propios; sin `custom-card-helpers`.
- Se usan los componentes nativos de HA por etiqueta (`ha-card`, `ha-entity-picker`,
  `ha-selector`, `ha-switch`…). Antes de pintar se fuerza su carga perezosa.
- Variables CSS del tema de HA: claro y oscuro automáticos.

```
frontend/
  package.json, tsconfig.json, vite.config.ts, eslint.config.js
  src/
    main.ts               entrada: registra panel, tarjeta y editor de tarjeta
    api.ts                tipos del snapshot y llamadas WebSocket
    store.ts              suscripción compartida y estado en vivo
    i18n.ts               textos ES/EN
    panel/
      irrigation-panel.ts shell: pestañas Zonas / Ajustes y navegación
      zone-list.ts        lista compacta
      zone-editor.ts      editor en dos columnas con estado en vivo
      settings-view.ts    ajustes globales
    card/
      irrigation-card.ts  tarjeta con zonas plegables
      card-editor.ts      editor visual de la tarjeta
    shared/
      valve-status.ts     estado, progreso y botón de una válvula
      zone-status.ts      etiqueta de estado de zona
```

### 3.2 Registro en HA (D29)

- `async_setup_entry` sirve el bundle con `hass.http.async_register_static_paths` en
  `/irrigation_scheduler/irrigation-scheduler.js`, con `?v=<versión del manifest>` en la URL
  para invalidar caché.
- Panel con `panel_custom.async_register_panel`:
  - `frontend_url_path = "irrigation-scheduler"`;
  - `webcomponent_name = "irrigation-scheduler-panel"`;
  - `sidebar_title = "Riego"` (EN «Irrigation»), `sidebar_icon = "mdi:sprinkler-variant"`;
  - `require_admin = True`.
- Se quita en `async_unload_entry` con `frontend.async_remove_panel`.
- La tarjeta se carga en todos los dashboards con `frontend.add_extra_js_url`; no hace falta
  añadir el recurso a mano.
- `manifest.json`: `dependencies` pasa a `["frontend", "http", "panel_custom", "websocket_api"]`.
- Si HA muestra el panel en Ajustes → Paneles de control, título, icono, «solo admin» y barra
  lateral se cambian allí. La integración no duplica esos ajustes.

### 3.3 Flujo de datos (D30)

- `store.ts` abre **una** suscripción `irrigation_scheduler/subscribe` por conexión y la
  comparte entre el panel y todas las tarjetas. La cierra cuando no queda ningún consumidor.
- El snapshot es la única fuente de estado en vivo. El tiempo restante se calcula en el cliente
  desde `open_valves[].ends_at`, con un tick de 1 s.
- La fila de zona muestra el progreso del **lote** (válvulas abiertas y en cola): barra y
  «Lote · quedan X» desde `batch_started_at` y `batch_ends_at` de la zona. El backend estima el
  fin simulando la cola con los límites de zona y global, y lo recalcula en cada snapshot. Diseño:
  `docs/superpowers/specs/2026-09-28-zone-batch-progress-design.md`.
- Una válvula que se está encendiendo aún no está en `open_valves`: durante esos segundos la
  zona ya sale «Regando», pero la válvula no muestra progreso. Se acepta.
- El editor trabaja sobre una **copia** de la zona:
  - el estado en vivo solo actualiza las columnas de estado y nunca pisa lo editado;
  - si la zona cambia en el backend mientras se edita (otro usuario), aviso de «cambio externo»
    con opción de recargar;
  - si la zona se borra mientras se edita, aviso y vuelta a la lista.
- `save_zone` / `save_settings`: sus `errors[]` se asignan a los campos (V3 a la válvula
  concreta). El guardado solo es correcto si `errors` viene vacío.
- Selector de válvula: `ha-entity-picker` con dominio `switch`, excluyendo las `entity_id` ya
  usadas en cualquier zona (V7). En la zona que se edita, las suyas propias sí aparecen.

## 4. Vistas del panel (D31–D33)

### 4.1 Lista de zonas (D31) — `docs/mockups/01-zone-list.html`

- Barra superior: título, pestañas **Zonas** / **Ajustes** y botón **⏸ Pausar todo**.
- Lista compacta estilo Ajustes de HA, una fila por zona:
  - nombre y resumen: días, bloques y nº de válvulas;
  - estado de zona (§4.4) y, si riega, la válvula activa con su tiempo restante;
  - próximo riego;
  - botones de zona según su estado (§4.6).
- Pulsar la fila abre el editor de esa zona. Botón flotante **＋ Zona** para crear una.
- **Sin** indicador de lluvia: se aplaza a la fase 5, cuando el backend exponga los mm.

### 4.2 Editor de zona (D32) — `docs/mockups/02-zone-editor.html`

- Barra superior: volver, nombre, estado de zona, botones de zona (§4.6), **Borrar zona** (con
  confirmación) y **Guardar**.
- Dos columnas; ocupa todo el ancho útil. En pantallas estrechas se apilan.
  - **Izquierda (horario):** nombre, omitir por lluvia, modo (manual / auto
    deshabilitado por V8), días en chips, bloques de inicio en chips con «＋ Hora», válvulas a la
    vez en la zona y próximo riego.
  - **Derecha (válvulas):** tabla ordenable por arrastre (el orden es el orden de cola). Por
    válvula: nombre, switch, minutos, **bloques** (un chip por cada hora de la zona; marcado =
    riega en ese bloque), estado en vivo, botones de control y quitar.
  - Sin ningún chip marcado, la fila indica «Solo manual». Es válido.
  - Borrar una hora en la columna izquierda la quita de los chips de todas las válvulas; añadir una
    hora añade su chip desmarcado. Zona sin horas: «Añade horas a la zona» en lugar de chips.
- Botones de control por válvula según su estado (§4.5).
- `enabled` de cada válvula no se edita en el formulario: lo cambian ■ y ▶ de la válvula. Al guardar, el editor
  envía el `enabled` vigente en el snapshot, para no pisar un cambio hecho mientras se editaba.
- Válvula nueva: `duration_min = 10`, sin bloques marcados, `enabled = true`.
- Nombre de válvula obligatorio (V12). Al elegir el switch, si el nombre está vacío se rellena con
  el `friendly_name` de la entidad; se puede cambiar. La lista, la tarjeta y las notificaciones
  muestran este nombre, no el `entity_id`.
- Sin interruptor de habilitada: `zone.enabled` lo cambian ■ y ▶ de la zona (§4.6). El editor no
  lo edita y al guardar envía el valor vigente en el snapshot.
- Salir con cambios sin guardar pide confirmación.
- Zona nueva: «＋ Zona» abre **este mismo editor**, vacío, con valores por defecto
  (`enabled = true`, manual, omitir por lluvia activado, todos los días, sin bloques, 1 válvula a
  la vez). En una sola pantalla se pone el nombre, se añaden las válvulas (cada fila elige una
  `switch` existente de HA con el selector) y se configura el horario; un único **Guardar** crea
  la zona completa (`save_zone`).
  - Sin estado en vivo ni botones de zona o de válvula hasta el primer guardado.
  - Mientras falte algo obligatorio (nombre, ≥ 1 bloque por V5, entidad en cada válvula por V1),
    Guardar sigue activo: al pulsarlo, los errores se marcan en su campo (§3.3), como con el
    backend. No se guarda nada a medias.
  - Tras guardar, el editor sigue abierto sobre la zona ya creada, con su estado en vivo.

### 4.3 Ajustes globales (D33) — `docs/mockups/03-settings.html`

- Tres tarjetas y un **Guardar** en la barra:
  - **Simultaneidad:** interruptor «limitar» + máximo global (apagado = `null`).
  - **Notificaciones:** chips con los destinos `notify.mobile_app_*`.
  - **Lluvia:** dos grupos, «Lluvia ya caída» (pluviómetro, horas y umbral pasados) y «Lluvia
    prevista» (entidad `weather`, horas y umbral previstos). Errores V10/V11 en su campo.
    - Etiquetas en forma de frase, no «horas pasadas»: «Mirar las últimas… (horas, 1–24)», «No
      regar si han caído al menos… (mm)», «Mirar las próximas… (horas, 1–48)», «No regar si se
      prevén al menos… (mm)».
    - Bajo cada grupo, la regla resultante con los valores actuales: «No riega si han caído 5 mm o
      más en las últimas 24 horas».
    - Nota de cabecera: solo afecta a zonas con «Omitir por lluvia»; basta una de las dos
      condiciones; la orden manual siempre riega.

### 4.4 Estados de zona

| Estado backend | Etiqueta ES | Etiqueta EN | Significado |
|---|---|---|---|
| `running` | Regando | Watering | Al menos una válvula abierta |
| `queued` | En cola | Queued | Trabajos pendientes esperando hueco |
| `idle` | Programada | Scheduled | `enabled = true`, sin nada abierto ni en cola |
| zona con `enabled = false` | Detenida | Stopped | No dispara bloques ni «regar zona» |

### 4.5 Estados y controles de válvula (D36)

| Estado | Etiqueta ES / EN | Botones |
|---|---|---|
| Abierta por la integración | Regando (con progreso) / Watering | ⏸ ■ |
| Encendida a mano (`manual_on`, §7) | Regando (manual), sin progreso / Watering (manual) | ⏸ ■ |
| Con trabajos en cola | En cola / Queued | ⏸ ■ |
| Habilitada, sin nada abierto ni en cola | Programada / Scheduled | ▶ ■ |
| `enabled = false` | Detenida / Stopped | ▶ |

- ▶ en «Programada»: `run_valve` con su `duration_min`.
- ▶ en «Detenida»: `set_valve_enabled` con `true` (reactiva sin regar).
- ⏸: `pause_valve`. Anula lo ya disparado; los bloques posteriores siguen.
- ■: `set_valve_enabled` con `false` (pausa + detenida).
- Todos funcionan para cualquier usuario.

### 4.6 Controles de zona

Mismos tres botones y mismo significado que en la válvula, a nivel de zona. «Detenida» es
`zone.enabled = false`; **no** cambia el `enabled` de sus válvulas, así que detener y reactivar
la zona deja cada válvula como estaba.

| Estado de zona (§4.4) | Botones |
|---|---|
| Regando / En cola | ⏸ ■ |
| Programada | ▶ ■ |
| Detenida | ▶ |

- ▶ en «Programada»: `run_zone` (riega sus válvulas habilitadas).
- ▶ en «Detenida»: `set_zone_enabled` con `true` (reactiva sin regar).
- ⏸: `stop` con `zone_id` (pausa cada válvula de la zona).
- ■: `set_zone_enabled` con `false` (pausa la zona + `zone.enabled = false`).
- Global: solo **⏸ Pausar todo** (`stop` sin zona).

## 5. Tarjeta Lovelace (D34) — `docs/mockups/04-cards.html`

- Una sola tarjeta: `custom:irrigation-scheduler-card`, en el mismo bundle.
- Solo estado y control; la configuración sigue en el panel. La usa cualquier usuario.
- Configuración (editor visual `irrigation-scheduler-card-editor`):
  - `zones`: lista de `zone_id`, obligatoria, ≥ 1; el orden es el orden en la tarjeta;
  - `title`: opcional.
- Cada zona es una fila plegable, igual que la fila de la lista de zonas (estado, válvula activa y
  tiempo restante o próximo riego, botones de zona §4.6).
- Pulsar la fila o ▾ la despliega; los botones no despliegan. Desplegada muestra, anidadas y en
  orden de cola, sus válvulas con estado y sus botones (§4.5).
- Todas empiezan plegadas; el plegado no se guarda.
- Una `zone_id` configurada que ya no existe se muestra como «Zona no encontrada».

## 6. Textos, errores y validación (D35)

- `i18n.ts`: dos diccionarios planos. Idioma = `hass.locale.language`; si no es `es`, inglés.
- Días: `L M X J V S D` en español, `M T W T F S S` en inglés; internamente 0–6, lunes = 0.
- Fechas y horas con `Intl`, en la zona horaria de HA.
- Conexión caída: banner «Sin conexión con HA», estado congelado y botones deshabilitados; al
  reconectar se vuelve a suscribir solo.
- Integración no cargada: «Irrigation Scheduler no está configurado» en panel y tarjeta.
- Fallo de una orden (`run_*`, `stop`, `pause_valve`, `set_valve_enabled`, `set_zone_enabled`): *toast* nativo de HA con el mensaje del backend.
- Sin tests automatizados. Gates por tarea:
  - front: `npm run lint`, `npx tsc --noEmit`, `npm run build`, sin errores ni avisos;
  - backend: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
- El bundle se regenera y commitea en cada tarea que toca el front. La prueba real es en HA.

## 7. Cambios de backend que pide esta fase

Detalle en `01-backend.md` §2.2 y `03-valves-execution.md` §4 y §5.3.

- Campo `start_times` en la válvula en lugar de `frequency` (modelo, esquema `save_zone`, V3 nueva,
  programación por bloque y migración con el reparto uniforme; `00-overview.md` §4.2).
- Campo `name` en la válvula (modelo, esquema `save_zone`, validación V12 y migración: ausente =
  `object_id` de la entidad); las notificaciones usan `valve.name`.
- Campo `enabled` en la válvula (modelo, esquema y migración: ausente = `true`); los bloques y
  «regar zona» saltan las detenidas; `run_valve` rechaza una detenida.
- Comandos WebSocket y servicios `pause_valve` `{entity_id}`,
  `set_valve_enabled` `{entity_id, enabled}` y `set_zone_enabled` `{zone_id, enabled}`, sin
  `require_admin`.
- Poner `zone.enabled = false` por cualquier vía (comando o entidad `switch`) pausa la zona.
- `run_zone` rechaza una zona detenida.
- `stop` apaga también las `switch` configuradas encendidas a mano (`manual_on`) de su ámbito.
- Vigilancia de tiempos en el latido: válvulas propias pasadas de tiempo y switch configuradas
  encendidas a mano.
- `manual_on: [{entity_id, zone_id, since}]` en el snapshot.
- Registro del panel, del recurso de la tarjeta y del static path (§3.2).
