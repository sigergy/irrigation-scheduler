# Push al encender y al apagar una válvula — diseño

Fecha: 2026-09-30.

## Problema

Hoy la integración solo avisa por push de incidencias: fallos, tiempos excedidos, sensores caídos
y lluvia (`custom_components/irrigation_scheduler/alerts.py:27-38`). No hay forma de saber en el
móvil que una válvula se ha encendido o apagado. Eso incluye los encendidos hechos fuera de la
integración.

## Objetivo

El usuario puede activar en Ajustes → «Errores y avisos» un tipo de aviso nuevo, «Válvula
encendida/apagada». Con él recibe un push cada vez que una switch configurada se enciende y cada
vez que se apaga, sea cual sea el origen: programado, manual o externo. El push de apagado indica
cuánto tiempo estuvo abierta.

## Decisiones

1. **Un solo tipo en el catálogo, `valve_switched`**, con una sola fila de ajustes (push, móviles y
   prioridad) que vale para el encendido y para el apagado. Envía dos mensajes distintos.
2. **Solo push.**
   - No se registra en la entidad `event` «Alertas riego».
   - No emite evento de bus.
   - No pinta marca en el histórico.

   El histórico ya muestra el tramo abierto como barra, con su origen y su tiempo regado en el pop
   up. Las marcas quedan para los errores y avisos que ocurran por el camino.
3. **Casilla «Histórico» visible, desmarcada y deshabilitada** en la fila de este tipo. No se puede
   activar. Como el tipo nunca genera eventos, un `show_in_history: true` que llegue por websocket
   no tiene efecto.
4. **Valores por defecto:** push activado, todos los móviles y prioridad normal, con las tres
   prioridades permitidas. Es lo mismo que cualquier tipo sin configuración guardada
   (`model.py:104`, `alerts.py:57-59`). Consecuencia aceptada: tras actualizar llegan dos push por
   válvula en cada riego.
5. **Detección por cambio de estado de la switch**, no desde el flujo de apertura y cierre.
   Solo así se cubren los encendidos externos y todos los caminos de apagado: fin del riego,
   pausa, parar, tiempo excedido, recuperación al arrancar y apagado a mano.
6. **Sin tests.** Solo gates estáticos (ver «Verificación»).

## Backend

### Catálogo (`alerts.py`)

- `AlertType` gana el campo `push_only: bool = False`.
- Tipo nuevo, al final de `ALERT_TYPES`:
  `"valve_switched": AlertType(LEVEL_VALVE, PRIORITY_NORMAL, push_only=True)`.
- `alert_types(level)` excluye los tipos `push_only`. Así `valve_switched` no entra en los
  `event_types` de las entidades `event` (`event.py:94`, `:105`, `:118`).
- La validación (`validation.py:123-129`) y el esquema WS (`websocket.py:63`) lo aceptan sin
  cambios, porque recorren `ALERT_TYPES`.

### Detección (`manager.py`)

El listener de las switch configuradas ya existe (`manager.py:286`). Su callback,
`_async_valve_state_changed` (`manager.py:377`), hoy solo emite `SIGNAL_STATE`. Además de eso,
pasa a lanzar la tarea nueva `_async_valve_switched(event)`.

| Transición | Acción |
|---|---|
| `off` → `on` | Guarda el origen en `self._switch_origin[entity_id]` y envía el push de encendido |
| `on` → `off` | Saca el origen de `self._switch_origin` y envía el push de apagado con la duración |
| Cualquier otra (`old_state` `None`, desde o hacia `unavailable`/`unknown`) | Nada |

- **Origen al encender:** `valve_origin(entity_id)` (`manager.py:1150`). El callback corre durante
  `async_set_valve` (`manager.py:624`), antes de `_opening_origin.pop` (`manager.py:630`), así que
  un encendido de la integración da `scheduled` o `manual`, y uno externo da `external`.
- **Origen al apagar:** el guardado al encender. No se vuelve a calcular, porque la recuperación al
  arrancar saca la válvula de `open_valves` antes del `turn_off` (`manager.py:184`). Si no hay
  origen guardado (HA se reinició con la válvula abierta), el mensaje va sin origen.
- **Duración:** `new_state.last_changed − old_state.last_changed`.
- **Push:** `push_targets(settings, "valve_switched")` y
  `alert_priority(settings, "valve_switched")`. Sin destinos, no se hace nada. Nombres: el de la
  válvula (`Valve.name`) y el de su zona, igual que `_async_alert` (`manager.py:757-763`).
- `_switch_origin` vive solo en memoria. Se borra la entrada de una válvula al apagarse.

### Mensajes (`notify.py`, `MESSAGES`, ES y EN)

```
valve_on:   "{zone}: {entity} encendida{origin} a las {time}."
valve_off:  "{zone}: {entity} apagada a las {time} tras {duration}{origin}."
EN:         "{zone}: {entity} turned on{origin} at {time}."
            "{zone}: {entity} turned off at {time} after {duration}{origin}."
```

- `{origin}` es ` (programado)` · ` (manual)` · ` (externo)`, o en EN ` (scheduled)` ·
  ` (manual)` · ` (external)`. Si no se conoce el origen, va vacío.
- `{duration}`:
  - menos de 1 min: `45 s`;
  - menos de 1 h: `3 min`, en minutos enteros redondeados;
  - desde 1 h: `1 h 5 min`, o `1 h` si los minutos son 0.
- `{time}` lo pone `async_push` (`notify.py:104`).

`async_push` recibe `kind` = `valve_on` o `valve_off` y la prioridad de `valve_switched`.

## Frontend

- `frontend/src/alerts.ts`:
  - `AlertType` gana `pushOnly?: boolean`;
  - entrada nueva al final de `ALERT_TYPES`:
    `{ id: "valve_switched", level: "valve", priority: "normal", allowed: ALL, name: "alert_valve_switched", help: "alert_valve_switched_help", pushOnly: true }`.
- `frontend/src/panel/alert-settings.ts`: en un tipo `pushOnly`, la casilla «Histórico» (`:120-127`)
  sale con `checked` a `false` y `disabled`, se ignore o no el valor guardado.
- `frontend/src/i18n.ts`, ES y EN:
  - `alert_valve_switched`: «Válvula encendida/apagada» / «Valve turned on/off».
  - `alert_valve_switched_help`: «Un push al encender y otro al apagar, con el tiempo abierta.
    Programado, manual o externo. No se marca en el histórico.» / «One push on turn on and one on
    turn off, with the time open. Scheduled, manual or external. Not marked in the history.»
- Marcas del histórico: no cambian. `buildMarks` (`shared/history-marks.ts:30`) solo pinta tipos
  que llegan como `event_type`, y `valve_switched` nunca llega.

## Documentación

- `docs/alerts/README.md`: fila de `valve_switched` en el catálogo, con la nota de que es solo
  push, sin entidad `event`, sin evento de bus y sin marca.
- `README.md`: ampliar la línea de push de «Qué hace» (`README.md:14`) con el aviso de encendido y
  apagado.

## Verificación

- Backend: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
- Frontend (en `frontend/`): `npx tsc --noEmit`, `npm run lint` y `npm run build`. El bundle se
  commitea.
- El usuario valida en su HA 2026.9. Aquí no se levantan servidores ni navegador.
