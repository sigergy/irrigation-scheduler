# Icono de zona configurable — diseño

Fecha: 2026-10-02.

Mockup: [`docs/mockups/05-zone-icon.html`](../../mockups/05-zone-icon.html).

## Problema

La tarjeta pinta un carácter fijo por estado de zona: `running: "💧", queued: "⏳", idle: "○",
stopped: "⊘"` (`frontend/src/shared/zone-status.ts:26`, usado en
`frontend/src/card/irrigation-card.ts:173`). En reposo todas las zonas muestran el mismo `○` y no se
distinguen de un vistazo.

Las entidades de la zona tampoco tienen icono propio. No hay `icons.json` ni ningún `_attr_icon` en
el backend, así que el sensor «Estado» (`ZoneStatusSensor`, `sensor.py:66-75`) sale con el icono
genérico de HA (`mdi:eye`).

## Objetivo

- Cada zona tiene un icono MDI opcional que se elige en el editor de zona.
- En reposo, la tarjeta y la entidad «Estado» muestran ese icono.
- Regando o en cola, muestran el icono del estado, como hoy.

## Límite de Home Assistant

HA no da icono a los dispositivos, solo a las entidades. La zona es un dispositivo de tipo servicio
(`entities/base.py:37-43`), así que el icono se aplica a una entidad concreta: **«Estado»**.

Orden con el que el frontend de HA resuelve el icono de una entidad (comportamiento de HA, no de
este repo):

1. override del usuario en el entity registry (*Ajustes → Entidad → Icono*);
2. atributo `icon` del estado, que sale de la propiedad `Entity.icon`;
3. icon translations de la integración (`icons.json`), por defecto o por estado;
4. icono por defecto del dominio o del `device_class`.

## Decisiones

1. **Opción A: el icono vive en la configuración de la zona** (store propio), como el nombre. La
   entidad lo expone con la propiedad `icon`. Se descarta escribir en el entity registry, porque
   ese campo es el override del usuario y la integración no debe tocarlo. También se descarta
   leerlo del registry sin campo propio, porque el usuario quiere configurarlo en la zona.
2. **Opción C1: la tarjeta lee `zone.icon` del snapshot** y lo pinta con `<ha-icon>`. No usa
   `<ha-state-icon>`. Así no hay que publicar el `entity_id` de «Estado» ni depender de un
   componente que puede no estar cargado en todos los dashboards. Contrapartida aceptada: si el
   usuario cambia el icono en *Ajustes → Entidad*, la entidad usa el suyo y la tarjeta sigue con el
   de la zona.
3. **Campo `icon: str | None`**, por defecto `None`. Formato `prefijo:nombre` (`mdi:flower`).
   Lo valida `cv.icon` en el esquema del WebSocket. Las zonas guardadas antes no lo tienen:
   `from_dict` lee `None`. No se sube la versión del store.
4. **Solo la entidad «Estado» lleva el icono de la zona.** «Regar ahora», «Modo», «Habilitada»,
   «Omitir por lluvia», «Próximo riego» y «Alertas riego» tienen significado propio y conservan el
   suyo.
5. **Icono de «Estado» según el estado:**

   | `native_value` | `icon` (propiedad) | Icono resultante |
   |---|---|---|
   | `idle`, zona con icono | `zone.icon` | el de la zona |
   | `idle`, zona sin icono | `None` | `icons.json` → `default`: `mdi:sprinkler` |
   | `running` | `None` | `icons.json` → `state.running`: `mdi:sprinkler-variant` |
   | `queued` | `None` | `icons.json` → `state.queued`: `mdi:timer-sand` |

   El panel ya usa `mdi:sprinkler-variant` como icono de la barra lateral
   (`docs/specs/02-frontend.md:70`).
6. **Fila de zona en la tarjeta** (helper común `zoneIcon`):

   | Estado de tarjeta (`zoneState`) | Icono |
   |---|---|
   | `idle`, zona con icono | `<ha-icon>` con `zone.icon` |
   | `idle`, zona sin icono | `○`, como hoy |
   | `running` | `💧`, como hoy |
   | `queued` | `⏳`, como hoy |
   | `stopped` | `⊘`, como hoy |

   - `stopped` conserva `⊘`, porque informa de que la zona no riega sola. La fila ya se atenúa con
     la clase `.stopped`.
   - Sin icono elegido no cambia nada: la mejora es opcional y no altera las tarjetas existentes.
   - Las filas de válvula no cambian (`STATE_ICONS`, `shared/valve-status.ts:26`).
7. **Panel, lista de zonas**: la fila de zona hoy no tiene icono (`panel/zone-list.ts:52-80`). Se
   añade un hueco de 24 px entre el chevron y el nombre con el mismo `zoneIcon`, como en la
   tarjeta. La insignia de estado se queda.
8. **Histórico (Línea de tiempo y Totales)**: icono fijo de la zona, sin depender del estado,
   delante del nombre de la zona. Solo si la zona tiene icono, sin `○` de relleno, porque son vistas
   de lo ya regado, no de estado.
9. **Editor de zona**: campo «Icono» con `ha-selector` y `{ icon: {} }`, que pinta el
   `ha-icon-picker` de HA, justo debajo de «Nombre». Al vaciarlo se guarda `null`.
10. **Sin tests automatizados.** Es una feature, no un refactor del núcleo (memoria
    `no-tests-validate-in-ha`). Solo gates estáticos. El usuario valida en su HA.

## Discrepancia conocida (no se corrige)

`zoneState` cuenta una válvula encendida a mano como `running` (`shared/zone-status.ts:37-43`).
`zone_status` del backend no la cuenta (`engine/status.py:24-31`). Con una válvula encendida a mano,
la tarjeta muestra `💧` y la entidad «Estado» sigue en `idle`, con el icono de la zona. Ya pasa hoy
con el valor del sensor y no es efecto de este cambio.

## Reutilización (leer-reutilizar-corregir)

| Decisión | Pieza | Desenlace |
|---|---|---|
| Dónde guardar el icono | `Zone` (`domain/model.py:66-100`): `from_dict` con valores por defecto y `to_dict` con `asdict` | Corregir: campo nuevo |
| Validar la entrada | `ZONE_SCHEMA` (`api/schemas.py:22-36`); `cv` ya importado (`:6`) | Corregir: clave `icon` con `cv.icon` |
| Llevar el icono a la tarjeta | `build_snapshot` vuelca `**zone.to_dict()` (`api/snapshot.py:34`) | Reutilizar sin cambios |
| Repintar la entidad al guardar | `ZoneEntity` escucha `SIGNAL_CONFIG` (`entities/base.py:21,26-30`); `async_save_zone` lo emite (`engine/manager.py:606`) | Reutilizar sin cambios |
| Valor del estado de zona | `ZoneStatusSensor.native_value` (`sensor.py:73-75`) | Reutilizar en la propiedad `icon` |
| Iconos por estado de la entidad | No existe `icons.json` | Crear |
| Selector de icono | `ha-selector` ya cargado por `loadHaComponents` (`shared/ha-components.ts`) y usado en el editor (`panel/zone-editor.ts:499-506`); `selectorValue` (`shared/ha-components.ts:17-19`) | Reutilizar |
| Icono de fila de zona | `ZONE_ICONS` (`shared/zone-status.ts:26`) | Reutilizar dentro del helper nuevo `zoneIcon` en el mismo fichero |
| Detección de cambios sin guardar | `configKey` (`panel/zone-editor.ts:61-73`) | Corregir: incluir `icon` |
| Copia a borrador | `toDraft` (`:28-41`), `emptyDraft` (`:44-58`) | Corregir: copiar `icon` / `null` |

## Backend

### 1. `domain/model.py` — `Zone`

- Campo nuevo tras `name`: `icon: str | None = None`.
- `from_dict`: `icon=data.get("icon")`.
- `to_dict` no cambia: `asdict` ya lo incluye.

### 2. `api/schemas.py` — `ZONE_SCHEMA`

```python
vol.Optional("icon", default=None): vol.Any(None, cv.icon),
```

Sin esta clave, guardar una zona con `icon` falla: voluptuous rechaza las claves que no conoce.
`cv.icon` exige el formato `prefijo:nombre`. La cadena vacía no llega, porque el editor la
convierte en `null`.

`validate_zone` (`domain/validation.py:36`) no cambia: el formato ya lo valida el esquema.

### 3. `sensor.py` — `ZoneStatusSensor`

```python
@property
def icon(self) -> str | None:
    # en reposo, el icono de la zona; regando o en cola, el de icons.json según el estado
    zone = self.zone
    if zone is None or self.native_value != STATUS_IDLE:
        return None
    return zone.icon
```

Importar `STATUS_IDLE` de `.const` (`const.py:18`).

Tras guardar la zona, `SIGNAL_CONFIG` llama a `async_write_ha_state` y el icono nuevo se aplica al
momento, sin recargar la integración.

### 4. `icons.json` (nuevo, en `custom_components/irrigation_scheduler/`)

```json
{
  "entity": {
    "sensor": {
      "status": {
        "default": "mdi:sprinkler",
        "state": {
          "running": "mdi:sprinkler-variant",
          "queued": "mdi:timer-sand"
        }
      }
    }
  }
}
```

La clave `status` es el `translation_key` de la entidad (`ZoneEntity`, `entities/base.py:38`).

## Frontend

### 5. `api.ts` — `ZoneConfig`

Campo tras `name`: `icon: string | null;`.

### 6. `shared/zone-status.ts` — helper `zoneIcon`

```ts
/** Icono de la fila de zona: el de la zona en reposo; el del estado en el resto (02 §4.4). */
export function zoneIcon(zone: Zone, state: ZoneState): TemplateResult {
  if (state === "idle" && zone.icon) return html`<ha-icon class="zone-icon" .icon=${zone.icon}></ha-icon>`;
  return html`${ZONE_ICONS[state]}`;
}
```

### 7. `card/irrigation-card.ts`

- Línea 173: `<span class="icon">${zoneIcon(zone, state)}</span>`.
- Estilo: `.icon ha-icon { --mdc-icon-size: 20px; }`, para que ocupe lo mismo que los glifos
  actuales (24 px de ancho por `.icon`, `:249-252`).

### 8. `panel/zone-list.ts`

- En `renderRow`, entre el botón `expand` y `.main`:
  `<span class="icon zone-icon">${zoneIcon(zone, state)}</span>`.
- Estilo: `width: 24px; text-align: center; --mdc-icon-size: 20px;`. Las filas de válvula
  desplegadas mantienen su sangría.

### 9. `card/history-views.ts`

- Helper local: `zoneLabel(zone)` devuelve
  `html`${zone.icon ? html`<ha-icon .icon=${zone.icon}></ha-icon>` : nothing}${zone.name}``.
- **Línea de tiempo**: el parámetro `label` de `row` (`:131`) pasa de `string` a
  `string | TemplateResult`. `zoneBlock` (`:144-145`) usa `zoneLabel(zone)` en las dos ramas.
- **Totales**: el primer `t-zone` (`:189`) usa `zoneLabel(zone)`.
- Estilo: `.tl-zone ha-icon, .t-zone ha-icon { --mdc-icon-size: 18px; margin-right: 6px;
  vertical-align: -3px; }`.

### 10. `panel/zone-editor.ts`

- `toDraft`: `icon: zone.icon ?? null`. `emptyDraft`: `icon: null`.
- `configKey`: añadir `zone.icon` tras `zone.name`.
- Debajo del `ha-selector` de «Nombre» (`:499-507`), en la misma sección:

  ```ts
  <ha-selector
    .hass=${hass}
    .selector=${{ icon: {} }}
    .label=${t(hass, "field_icon")}
    .value=${draft.icon ?? ""}
    @value-changed=${(ev: Event) => this.patch({ icon: selectorValue<string>(ev) || null })}
  ></ha-selector>
  <div class="muted small">${t(hass, "field_icon_help")}</div>
  ```

- `save` no cambia: hace `...draft` y ya envía `icon`.

### 11. `i18n.ts`

| Clave | ES | EN |
|---|---|---|
| `field_icon` | Icono | Icon |
| `field_icon_help` | Se muestra en la tarjeta y en la entidad «Estado» mientras la zona no riega. | Shown on the card and on the «Status» entity while the zone is not watering. |

### 12. Bundle

`npm run build` regenera `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`.
Va en el mismo commit.

## Documentación

- `docs/specs/01-backend.md` §2.3: el `sensor` estado lleva el icono de la zona en reposo.
- `docs/specs/02-frontend.md` §4.4: columna de icono por estado y el campo «Icono» del editor.
- `README.md`, *Entidades* (fila «Estado») y *Tarjeta Lovelace*: el icono de la zona.
- `docs/mockups/index.html`: enlace al mockup 05.

## Verificación

- `uvx ruff check custom_components`
- `py -3.14 -m compileall -q custom_components`
- `cd frontend && npm run lint && npm run build`

El usuario valida en su HA:

- elegir un icono en el editor de zona (panel y ⚙ de la tarjeta);
- comprobarlo en la tarjeta, en la lista del panel y en el histórico;
- ver la entidad «Estado» en el dispositivo de la zona: en reposo, regando y en cola;
- vaciar el campo y comprobar que vuelven `○` y `mdi:sprinkler`;
- comprobar que una zona guardada antes del cambio carga sin icono.

## Fuera de alcance

- Iconos para las filas de válvula o para «Modo riego» (sigue con `mdi:eye`).
- Pasar los glifos de estado (`💧 ⏳ ○ ⊘`) a iconos MDI.
- Seguir en la tarjeta el override del entity registry (opción C2, `<ha-state-icon>`).
- Corregir la discrepancia `zoneState` / `zone_status` con válvulas encendidas a mano.
