# Alerta «Sin agua» desde el sensor de suministro de la válvula — diseño

Fecha: 2026-09-30.

## Problema

Algunas válvulas físicas detectan por sí mismas que no les llega agua. Por ejemplo, la Sonoff SWV
expone en ZHA un `binary_sensor` «Suministro de agua» con device class `problem`: pasa a `on`
cuando falta suministro. Hoy la integración no lo lee. Pasa lo siguiente:

- el riego sigue abierto sin regar;
- no llega push;
- el histórico no marca nada;
- la fila de la válvula no avisa.

## Objetivo

Cada válvula puede tener un sensor de suministro opcional. Cuando el sensor indica falta de agua:

- la integración cierra la válvula si estaba abierta o encendiéndose;
- envía un push `no_water`;
- pinta una marca roja en el histórico;
- muestra «Sin agua» en la fila de la válvula mientras dura el problema.

## Decisiones

1. **Sensor elegido a mano**, por válvula. No se detecta solo a partir del dispositivo.
2. **Un tipo nuevo en el catálogo, `no_water`**, con alcance de válvula. No es solo push: registra
   en la entidad `event` de la válvula, emite evento de bus y marca el histórico, como
   `turn_on_failed`.
3. **Cierre automático.** Se usa el mismo camino que ⏸ de esa válvula. El resto de la cola sigue.
4. **Sin bloqueo preventivo.** Con el sensor en `on`, ▶ y los bloques programados siguen abriendo
   la válvula. En cuanto se confirma la apertura, se cierra y se avisa.
5. **Ciclo de vida:** «Sin agua» dura mientras el sensor esté en `on`. Cuando vuelve a `off`, el
   indicador desaparece sin aviso.
6. **Sin tests.** Solo gates estáticos (ver «Verificación»).

## 1. Backend

### 1.1 Modelo

- `Valve` (`custom_components/irrigation_scheduler/model.py:36-59`) gana un campo opcional,
  `supply_sensor: str | None`, que por defecto vale `None`.
- En `from_dict`, si la clave falta, vale `None`. Las zonas ya guardadas no necesitan migración.
- Se guarda y se devuelve en `save_zone`, `list` y `subscribe`. El esquema websocket de
  `save_zone` acepta la clave nueva, que puede ser `null`.

### 1.2 Validación

Se añaden dos reglas a `validation.py` y a la tabla de `docs/specs/00-overview.md` §5:

| # | Regla | Resultado |
|---|---|---|
| V13 | `supply_sensor` no nulo que no empieza por `binary_sensor.` | Error en esa válvula |
| V14 | Un mismo `supply_sensor` en dos válvulas, de esta zona o de otra | La UI no lo ofrece (el selector oculta los usados) y el backend lo rechaza |

V14 sigue el mismo patrón que V7 (`validation.py:61-77`).

### 1.3 Catálogo de alertas

En `ALERT_TYPES` (`alerts.py:36-48`) se añade una entrada justo después de `turn_off_failed`:

```python
"no_water": AlertType(LEVEL_VALVE, SEVERITY_ERROR, PRIORITY_HIGH),
```

- Aparece en el grupo «Requieren acción», con cabecera «Error» y marca roja.
- La prioridad por defecto es alta, con las tres prioridades permitidas.
- Push, móviles, prioridad e histórico se configuran como en cualquier otro tipo.

Texto del push:

- con cierre: `{zone} · {entity}: sin agua ({time}). Válvula cerrada. Revisa el suministro.`
- sin cierre, porque la válvula ya estaba cerrada:
  `{zone} · {entity}: sin agua ({time}). Revisa el suministro.`

`{entity}` es el nombre propio de la válvula (V12). El nombre corto del tipo es «Sin agua».

Atributos del disparo: `closed: bool`, que indica si la integración cerró la válvula.

### 1.4 Disparadores

Se suscribe a cada `supply_sensor` configurado. Se re-suscribe al guardar zonas, igual que
`_track_zone` (`manager.py:274`). El manejador sigue el patrón de `_async_sensor_changed`
(`manager.py:361-376`).

| Caso | Acción |
|---|---|
| Sensor pasa a `on` con la válvula abierta o encendiéndose | Cerrarla como ⏸ de esa válvula; después, alerta con `closed: true`. El resto de la cola sigue |
| Se confirma la apertura (▶ o bloque) con el sensor ya en `on` | Cerrarla nada más confirmarse; después, alerta con `closed: true` |
| Sensor pasa a `on` con la válvula cerrada | Solo alerta, con `closed: false` |
| Sensor pasa a `off` | Sin alerta. Desaparece «Sin agua» |
| Sensor `unavailable` o `unknown` | No se trata como falta de agua. Sin alerta ni indicador |

Precisiones:

- «Encendiéndose» es estar en `_opening` sin cancelar. En ese caso se marca como cancelada, como
  hace ⏸. Los reintentos se cortan (`valves.py:42-45`) y no salta `turn_on_failed`.
- Si el cierre falla, sigue el camino normal de ⏸, incluida `turn_off_failed`. La alerta
  `no_water` se envía igualmente.
- Un encendido manual o externo con el sensor en `on` se trata como una apertura: se cierra y se
  alerta.
- «Pasa a `on`» significa solo la transición `off → on`. Al arrancar HA con el sensor ya en `on`
  no se envía alerta, y tampoco en `unavailable`/`unknown → on`, que ZHA hace al arrancar. El
  indicador sí se muestra.

### 1.5 Snapshot

Se añade la clave `no_water: [{entity_id, zone_id}]`, que lista las válvulas cuyo `supply_sensor`
está en `on` ahora mismo. `entity_id` es la switch de la válvula, no el sensor.

## 2. Interfaz

### 2.1 Fila de válvula (tarjeta Lovelace y panel → Zonas)

Las dos vistas usan `valveRow` (`frontend/src/shared/valve-status.ts:88-102`), así que el cambio
vale para ambas.

- `ValveState` gana un estado nuevo, `no_water`:
  - icono 🚱;
  - etiqueta `status_no_water`: «Sin agua» / «No water»;
  - texto con el color de error del tema (`--error-color`);
  - botones ▶ ■, igual que `idle`.
- Precedencia en `valveLive`, de mayor a menor:

  abierta (Regando, con barra) > encendiéndose (Encendiendo…) > manual > en cola > detenida >
  **sin agua** > programada

  Hasta en cola, el orden es el actual (`valve-status.ts:43-51`). Sin agua va detrás de detenida.
  Así una válvula desactivada sigue diciendo «Detenida» y conserva su botón de reanudar.
- La fila de zona no cambia.

### 2.2 Editor de zona

- Cada válvula tiene una columna opcional, «Sensor de suministro», con un selector de entidad
  `binary_sensor`. Sigue el patrón del selector de switch (`frontend/src/panel/zone-editor.ts:645`).
- El selector oculta los sensores usados en otras válvulas (V14).
- Por debajo de 820 px la fila se apila, como el resto de campos de la válvula. Antes eran 700 px:
  la columna nueva sube el ancho mínimo de la tabla a 812 px.
- `saveZone` (`frontend/src/api.ts:183-208`) envía `supply_sensor`. El tipo `Valve`
  (`api.ts:34-40`) gana `supply_sensor: string | null`.

### 2.3 Ajustes → Errores y avisos

Nueva fila «Sin agua», con nivel Válvula y en el mismo orden que el catálogo.

### 2.4 Histórico

- Marca roja con el icono `mdi:pipe-disconnected`, en `ALERT_MARKS`
  (`frontend/src/shared/alert-icons.ts`).
- El path se copia de `@mdi/js` 7.4.47, como los demás. El paquete no está instalado en
  `frontend/`, así que el plan debe obtener el path y verificarlo antes de usarlo. Si no existe en
  esa versión, parar y preguntar.
- El pop up muestra «Sin agua» y la hora.

### 2.5 Snapshot en el frontend

`Snapshot` (`api.ts:162-171`) gana `no_water: NoWater[]`, con `NoWater { entity_id; zone_id }`.

## 3. Documentación

- `README.md`: fila «Sin agua» en la tabla de alertas, grupo «Requieren acción», y el campo
  «Sensor de suministro» del editor.
- `docs/alerts/README.md` y `docs/alerts/spec.md`: tipo `no_water` con textos, atributos y
  disparadores.
- `docs/specs/00-overview.md` §5: V13 y V14.
- `docs/specs/02-frontend.md`:
  - §4.5: estado «Sin agua» y precedencia;
  - editor: columna nueva;
  - snapshot: clave `no_water`.
- `docs/specs/03-valves-execution.md`: flujo de cierre por falta de agua y fila en §7.2.

## Verificación

Gates estáticos:

- `uvx ruff check custom_components`
- `py -3.14 -m compileall -q custom_components`
- En `frontend/`: `npx tsc --noEmit`, `npm run lint` y `npm run build`.

No hay tests. El usuario valida en su HA con la SWV.

## Fuera de alcance

- Detectar el sensor a partir del dispositivo de la switch.
- Impedir aperturas mientras no hay agua.
- Controlar el ajuste «Cierre automático por escasez de agua» de la propia SWV.
