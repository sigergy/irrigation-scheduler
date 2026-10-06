# Tiempo restante por válvula — plan de implementación

> **Para agentes:** sub-skill obligatoria: `subagent-driven-development` (recomendada) o
> `executing-plans`. Los pasos usan casillas (`- [ ]`). En este proyecto el implementador **no hace
> commit**: deja los cambios en el árbol; el controlador revisa el diff, pasa los gates y hace el
> commit al cerrar cada tarea.

**Objetivo:** cuando la parada ordenada de HA cierra una válvula que regaba, guardar en el runtime
el tiempo que le faltaba («interrumpida»). Mostrar el fin previsto en una entidad nueva, «Fin
riego», y la interrupción en el panel. Al arrancar, sin la spec 04, las interrupciones se
descartan con un log.

**Arquitectura:** dato nuevo en `RuntimeState` (`interrupted`) con tres mutadores en `ValveSlots`.
El manager interrumpe en `async_close_on_stop` y en la apertura abortada, y descarta en
`_async_recover`. Un sensor de tipo hora por válvula y un estado nuevo de válvula en el panel.

**Stack:** Python 3.14, Home Assistant 2026.9 (custom integration), ruff; frontend Lit +
TypeScript + Vite.

**Spec:** [`../03-remaining-time/spec.md`](../03-remaining-time/spec.md) (§3 decisiones, §4
diseño, §5 límites).

## Restricciones globales

- Comentarios en español; nombres de código en inglés. Ficheros Python `snake_case`.
- **Sin tests nuevos**: norma del proyecto para features. La validación funcional la hace el usuario
  en su HA (2026.9).
- Gates locales en cada tarea:
  - `uvx ruff check custom_components`
  - `py -3.14 -m compileall -q custom_components`
  - Tarea 4, además, en `frontend/`: `npm run lint`, `npm run typecheck` y `npm run build`
    (requiere `npm ci` una vez).
- `pytest` solo corre en GitHub Actions (`.github/workflows/tests.yml`). Los tests existentes deben
  seguir en verde, en especial `engine/tests/test_lock.py`, `engine/tests/test_layers.py`,
  `engine/tests/test_characterization.py` y `engine/tests/test_slots.py`.
- `engine/` no importa `api` ni `entities` (`engine/tests/test_layers.py`).
- `ValveSlots` es el único que modifica el estado de las válvulas en el runtime. Sus mutadores van
  en `MUTATORS` (`engine/slots.py:14-28`) y fuera de `slots.py` solo se llaman con el lock
  (`engine/tests/test_lock.py`).
- `remaining_min` = minutos que faltan, redondeados hacia arriba. Se calcula en un solo sitio:
  `InterruptedValve.remaining_min`.
- Nombres: clave de entidad `valve_end`; entity_id propuesto `sensor.fin_riego_<válvula>`; nombre
  «Fin riego» / «Irrigation end»; atributo `remaining_min` («Minutos pendientes» / «Minutes
  left»); texto del panel «Interrumpida · faltan {n} min» / «Interrupted · {n} min left».
- Ruff: `line-length = 120`, reglas `E, F, I, UP, B` (`pyproject.toml`). Imports en orden isort.
- Rama: `sigergy/ha-restart-fallbacks-impl`. Push, merge y PR, solo con confirmación del usuario.

## Mapa de ficheros

| Fichero | Tarea | Cambio |
|---|---|---|
| `custom_components/irrigation_scheduler/domain/runtime.py` | 1 | `InterruptedValve` y `RuntimeState.interrupted` |
| `custom_components/irrigation_scheduler/engine/slots.py` | 1 | Mutadores `interrupt`, `interrupt_job`, `drop_interrupted` |
| `custom_components/irrigation_scheduler/engine/manager.py` | 2 | Parada, apertura abortada y arranque |
| `custom_components/irrigation_scheduler/sensor.py` | 3 | `ValveEndSensor` |
| `custom_components/irrigation_scheduler/adapters/registry.py` | 3 | Borrado de la entidad al quitar la válvula |
| `custom_components/irrigation_scheduler/{strings.json,translations/es.json,translations/en.json}` | 3 | Nombre y atributo |
| `custom_components/irrigation_scheduler/api/snapshot.py` | 4 | `interrupted` en la foto |
| `frontend/src/{api.ts,i18n.ts,shared/valve-status.ts}` | 4 | Estado `interrupted` |
| `docs/...` | 5 | Specs vivas y estado |

---

### Tarea 1: runtime y mutadores de `ValveSlots`

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/domain/runtime.py:28-54` (tras `OpenValve`),
  `:86-98` (campos de `RuntimeState`), `:157-172` (`to_dict`), `:174-202` (`from_dict`)
- Modificar: `custom_components/irrigation_scheduler/engine/slots.py:12-28` (import y `MUTATORS`),
  `:115-116` (tras `drop_pending`)

**Interfaces que crea:**
- `InterruptedValve(entity_id: str, zone_id: str, remaining_s: int, interrupted_at: datetime,
  origin: str = ORIGIN_MANUAL)` con `remaining_min: int` (propiedad), `to_dict()` y `from_dict()`.
- `RuntimeState.interrupted: dict[str, InterruptedValve]`.
- `ValveSlots.interrupt(entity_id: str, now: datetime) -> InterruptedValve | None`
- `ValveSlots.interrupt_job(job: Job, now: datetime) -> InterruptedValve`
- `ValveSlots.drop_interrupted() -> list[InterruptedValve]`

- [ ] **Paso 1: `InterruptedValve`.** En `domain/runtime.py`, añadir `import math` antes de
  `from collections import Counter` (orden isort: `import math` va en el bloque de la biblioteca
  estándar; ruff decide el orden exacto). Justo después de la clase `OpenValve` (antes del
  comentario `# (zone_id, "HH:MM", día del bloque)`), añadir:

```python
@dataclass
class InterruptedValve:
    """Riego cortado por una parada ordenada de HA, con lo que le faltaba (03-remaining-time §4.1)."""

    entity_id: str
    zone_id: str
    remaining_s: int
    interrupted_at: datetime
    # la spec 04 retoma distinto un riego manual que uno programado
    origin: str = ORIGIN_MANUAL

    @property
    def remaining_min(self) -> int:
        """Minutos que faltaban, redondeados hacia arriba: lo que ven la entidad, el panel y el log."""
        return math.ceil(self.remaining_s / 60)

    def to_dict(self) -> dict[str, Any]:
        return {**asdict(self), "interrupted_at": self.interrupted_at.isoformat()}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> InterruptedValve:
        return cls(**{**data, "interrupted_at": datetime.fromisoformat(data["interrupted_at"])})
```

- [ ] **Paso 2: campo de `RuntimeState`.** Tras el campo `forecast_log`, añadir:

```python
    # riegos cortados por una parada ordenada de HA: entity_id -> lo que faltaba (03-remaining-time §4.1)
    interrupted: dict[str, InterruptedValve] = field(default_factory=dict)
```

- [ ] **Paso 3: persistencia.** En `RuntimeState.to_dict`, tras la clave `"forecast_log"`, añadir:

```python
            "interrupted": [valve.to_dict() for valve in self.interrupted.values()],
```

  En `RuntimeState.from_dict`, tras el argumento `forecast_log=...`, añadir:

```python
            # runtime guardado antes de existir la clave: sin interrupciones
            interrupted={
                item["entity_id"]: InterruptedValve.from_dict(item) for item in data.get("interrupted", [])
            },
```

- [ ] **Paso 4: mutadores.** En `engine/slots.py`:
  - Import: `from ..domain.runtime import InterruptedValve, Job, OpenValve, RuntimeState`.
  - En `MUTATORS`, añadir `"interrupt"`, `"interrupt_job"` y `"drop_interrupted"` (tras
    `"prune_batches"`).
  - Actualizar la frase del docstring del módulo: «Único que modifica `pending`, `open_valves`,
    `batch_started`, `interrupted` y los estados en tránsito.»
  - Tras el método `drop_pending`, añadir:

```python
    def interrupt(self, entity_id: str, now: datetime) -> InterruptedValve | None:
        """Parada de HA: la abierta sale de `open_valves` con lo que le faltaba (03-remaining-time §4.2).

        Cerrándose (a su hora o por «Pausar») o sin tiempo por delante, su riego ya terminaba:
        devuelve None y no toca nada; quien llama la libera con `closed`.
        """
        valve = self.runtime.open_valves.get(entity_id)
        if valve is None or entity_id in self._closing:
            return None
        remaining_s = int((valve.ends_at - now).total_seconds())
        if remaining_s <= 0:
            return None
        del self.runtime.open_valves[entity_id]
        interrupted = InterruptedValve(entity_id, valve.zone_id, remaining_s, now, valve.origin)
        self.runtime.interrupted[entity_id] = interrupted
        return interrupted

    def interrupt_job(self, job: Job, now: datetime) -> InterruptedValve:
        """Apertura abortada por la parada de HA: interrumpida con su duración entera."""
        interrupted = InterruptedValve(job.entity_id, job.zone_id, job.duration_s, now, job.origin)
        self.runtime.interrupted[job.entity_id] = interrupted
        return interrupted

    def drop_interrupted(self) -> list[InterruptedValve]:
        """Vacía las interrupciones y las devuelve."""
        dropped = list(self.runtime.interrupted.values())
        self.runtime.interrupted.clear()
        return dropped
```

- [ ] **Paso 5: gates.** `uvx ruff check custom_components` y
  `py -3.14 -m compileall -q custom_components`, los dos con exit 0.

---

### Tarea 2: el manager interrumpe al parar y descarta al arrancar

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:168-228`
  (`async_close_on_stop`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:230-234` (`_async_recover`)
- Modificar: `custom_components/irrigation_scheduler/engine/manager.py:640-672` (`_async_open_job`)

**Interfaces:** usa las de la tarea 1. Ninguna nueva.

- [ ] **Paso 1: parada.** En `async_close_on_stop`:
  - En el docstring, sustituir «Las gestionadas que cierran se dan por terminadas» por «Las
    gestionadas que cierran con tiempo por delante quedan interrumpidas (03-remaining-time §4.3)».
  - Sustituir el bucle del bloque con lock:

```python
                for entity_id in closed:
                    # riego terminado (02-shutdown-close §1); las fallidas siguen en open_valves
                    self._slots.closed(entity_id)
```

  por:

```python
                now = dt_util.utcnow()
                for entity_id in closed:
                    # regando: queda interrumpida con lo que le faltaba (03-remaining-time §4.3); a mano,
                    # externa o ya terminando, solo se libera. Las fallidas siguen en open_valves
                    if self._slots.interrupt(entity_id, now) is None:
                        self._slots.closed(entity_id)
```

- [ ] **Paso 2: apertura abortada.** En `_async_open_job`, dentro del `async with self._lock:`,
  tras el bloque `if ok:` (y antes de `await self._async_persist_locked()`), añadir:

```python
            elif self._stopping and not cancelled:
                # HA para mientras abría: interrumpida con su tiempo entero (03-remaining-time §4.3)
                self._slots.interrupt_job(job, dt_util.utcnow())
```

  No cambia nada más del método: el `elif not ok and not cancelled and not self._stopping:` final
  sigue igual.

- [ ] **Paso 3: arranque.** En `_async_recover`, como primera instrucción dentro de
  `async with self._lock:` (antes de `for valve in list(self.runtime.open_valves.values()):`),
  añadir:

```python
            # riegos cortados por la parada ordenada: sin la spec 04 no se retoman (03-remaining-time §3)
            for valve in self._slots.drop_interrupted():
                _LOGGER.info(
                    "%s: riego interrumpido por reinicio de HA, faltaban %s min; no se retoma",
                    valve.entity_id,
                    valve.remaining_min,
                )
```

  `_async_recover` ya persiste al final (`await self._async_persist_locked()`).

- [ ] **Paso 4: gates.** Los dos de Python, con exit 0.

---

### Tarea 3: entidad «Fin riego»

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/sensor.py:34-40` (`sync_valves`), `:89-100`
  (tras `ValveModeSensor`), docstring del módulo (`:1`)
- Modificar: `custom_components/irrigation_scheduler/adapters/registry.py:30-38`
  (`remove_valve_entities`)
- Modificar: `custom_components/irrigation_scheduler/strings.json:72-75`,
  `translations/en.json:72-75`, `translations/es.json:72-75` (sección `entity.sensor`)

**Interfaces:** lee `manager.runtime.open_valves` y `manager.runtime.interrupted`, igual que
`api/snapshot.py` lee `manager.runtime`.

- [ ] **Paso 1: sensor.** En `sensor.py`, tras la clase `ValveModeSensor`, añadir:

```python
class ValveEndSensor(ValveEntity, SensorEntity):
    """Fin previsto del riego de la válvula; interrumpida, los minutos que faltaban (03-remaining-time §4.4).

    Sin cuenta atrás: cambia solo al abrir, cerrar o interrumpir, para no llenar el recorder.
    """

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, manager: IrrigationManager, zone_id: str, entity_id: str) -> None:
        super().__init__(manager, zone_id, entity_id, "valve_end", "sensor.fin_riego")

    def _update_attrs(self) -> None:
        runtime = self._manager.runtime
        valve = runtime.open_valves.get(self._valve_id)
        self._attr_native_value = valve.ends_at if valve else None
        interrupted = runtime.interrupted.get(self._valve_id)
        self._attr_extra_state_attributes = {"remaining_min": interrupted.remaining_min} if interrupted else {}
```

- [ ] **Paso 2: alta junto a «Modo riego».** En `sync_valves`, sustituir:

```python
            async_add_entities([ValveModeSensor(manager, zone_id, entity_id) for zone_id, entity_id in new])
```

  por:

```python
            async_add_entities(
                [
                    sensor(manager, zone_id, entity_id)
                    for zone_id, entity_id in new
                    for sensor in (ValveModeSensor, ValveEndSensor)
                ]
            )
```

  Actualizar el comentario de `valves_known`: «(zone_id, entity_id) de las válvulas que ya tienen
  sus sensores «Modo riego» y «Fin riego»». Docstring del módulo: «Sensores: estado y próximo riego
  por zona; modo y fin de riego por válvula; válvulas activas y lluvia globales.»

- [ ] **Paso 3: borrado.** En `adapters/registry.py`, `remove_valve_entities`:
  - Tupla: `(("event", "valve_alerts"), ("sensor", "valve_mode"), ("sensor", "valve_end"))`.
  - Docstring: «Quita el event y los sensores «Modo riego» y «Fin riego» de las válvulas que salen
    de la zona (decisión 4).»

- [ ] **Paso 4: traducciones.** En los tres JSON, dentro de `entity.sensor`, tras la clave
  `valve_mode` (añadir la coma que falte):
  - `strings.json` y `translations/en.json`:

```json
      "valve_end": {
        "name": "Irrigation end",
        "state_attributes": { "remaining_min": { "name": "Minutes left" } }
      }
```

  - `translations/es.json`:

```json
      "valve_end": {
        "name": "Fin riego",
        "state_attributes": { "remaining_min": { "name": "Minutos pendientes" } }
      }
```

  Comprobar que los tres siguen siendo JSON válido:
  `py -3.14 -c "import json,sys;[json.load(open(p,encoding='utf-8')) for p in sys.argv[1:]]" custom_components/irrigation_scheduler/strings.json custom_components/irrigation_scheduler/translations/en.json custom_components/irrigation_scheduler/translations/es.json`

- [ ] **Paso 5: gates.** Los dos de Python, con exit 0.

---

### Tarea 4: panel

**Ficheros** (líneas antes de esta tarea):
- Modificar: `custom_components/irrigation_scheduler/api/snapshot.py:61-62` (tras `"closing"`)
- Modificar: `frontend/src/api.ts:151-157` (tras `OpenValve`), `:185-199` (`Snapshot`)
- Modificar: `frontend/src/i18n.ts:17` (ES, tras `status_no_water`) y `:253` (EN, ídem)
- Modificar: `frontend/src/shared/valve-status.ts` (tipo `ValveState`, `ValveLive`,
  `STATE_ICONS`, `LABELS`, `valveLive`, `valveStatusText`, `valveButtons`)

**Interfaces:** foto `interrupted: [{entity_id, zone_id, remaining_min}]`; tipo TS
`InterruptedValve`.

- [ ] **Paso 1: foto.** En `build_snapshot`, tras la clave `"closing"`, añadir:

```python
        # cortadas por la parada ordenada de HA, con lo que les faltaba (03-remaining-time §4.5)
        "interrupted": [
            {"entity_id": valve.entity_id, "zone_id": valve.zone_id, "remaining_min": valve.remaining_min}
            for valve in manager.runtime.interrupted.values()
        ],
```

- [ ] **Paso 2: tipos.** En `api.ts`, tras la interfaz `OpenValve`:

```ts
// válvula cortada por una parada ordenada de HA, con los minutos que le faltaban
export interface InterruptedValve {
  entity_id: string;
  zone_id: string;
  remaining_min: number;
}
```

  En `Snapshot`, tras `closing: string[];`:

```ts
  interrupted: InterruptedValve[];
```

- [ ] **Paso 3: textos.** En `i18n.ts`, tras `status_no_water` en ES:
  `status_interrupted: "Interrumpida · faltan {n} min",`; en EN:
  `status_interrupted: "Interrupted · {n} min left",`.

- [ ] **Paso 4: estado de válvula.** En `shared/valve-status.ts`:
  - Importar el tipo `InterruptedValve` de `../api` (en orden alfabético dentro del import).
  - `ValveState`: añadir `"interrupted"` tras `"closing"`.
  - `ValveLive`: añadir `interrupted?: InterruptedValve;` tras `open?: OpenValve;`.
  - `STATE_ICONS`: `interrupted: "⏸",` tras `closing`.
  - `LABELS`: `interrupted: "status_interrupted",` tras `closing`.
  - `valveLive`: justo después de la línea de `closing`, añadir:

```ts
  // cortada por la parada de HA: ya no está en open_valves (03-remaining-time §4.5)
  const interrupted = snapshot.interrupted.find((item) => item.entity_id === valve.entity_id);
  if (interrupted) return { state: "interrupted", interrupted };
```

  - `valveStatusText`: tras la línea de `live.open`, añadir:

```ts
  if (live.interrupted) return t(hass, "status_interrupted", { n: live.interrupted.remaining_min });
```

  - `valveButtons`: `case "interrupted":` junto a `case "closing":` (los dos devuelven `[]`).
  - Actualizar el comentario de `valveStatusText`: «quedan 6:12», «Interrumpida · faltan 5 min»,
    «En cola»…

- [ ] **Paso 5: gates.** Los dos de Python y, en `frontend/`: `npm ci` (una vez), `npm run lint`,
  `npm run typecheck` y `npm run build`, todos con exit 0. El bundle generado
  (`custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`) no se commitea:
  comprobar con `git status` que está ignorado.

---

### Tarea 5: documentación viva y estado

**Ficheros:**
- Modificar: `docs/features/valves-execution/spec.md` §5.1 (`:68-84`), §5.1.1 (`:86-97`), §5.2
  (`:99-112`)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/03-remaining-time/spec.md` (estado)
- Modificar: `docs/features/06-10-2026-ha-restart-fallbacks/README.md` (fila 3)

- [ ] **Paso 1: §5.1.** Tras el punto de las válvulas abiertas, añadir:
  «- las válvulas interrumpidas por una parada ordenada (§5.1.1): `entity_id`, `zone_id`,
  segundos que faltaban, hora de la interrupción y origen;»

- [ ] **Paso 2: §5.1.1.** Sustituir el punto «la válvula gestionada que cierra da su riego por
  terminado; …» por:
  «- la válvula gestionada que cierra con tiempo por delante queda **interrumpida** con lo que le
  faltaba; también la que se estaba abriendo, con su duración entera. La que ya se cerraba, a su
  hora o por «Pausar», termina. La que falla sigue en el runtime y al arrancar actúa §5.2;»
  y añadir al final de la sección:
  «Detalle de la interrupción: [`03-remaining-time/spec.md`](../06-10-2026-ha-restart-fallbacks/03-remaining-time/spec.md).»

- [ ] **Paso 3: §5.2.** Añadir antes del punto 1 un punto 0 (sin renumerar los demás, que citan
  otras specs):
  «0. **Válvulas interrumpidas** al parar (§5.1.1): se dan por terminadas, con un log. No se
  retoman ([`03-remaining-time`](../06-10-2026-ha-restart-fallbacks/03-remaining-time/spec.md) §3).»

- [ ] **Paso 4: estado.** En la spec 03, «Estado: **implementado**». En el README del cambio, la
  fila 3 pasa a «Implementado».

- [ ] **Paso 5:** comprobar que las citas `archivo:línea` de la spec 03 siguen apuntando bien tras
  las tareas 1-4 y corregirlas si se han movido.

## Validación funcional (usuario, en su HA)

Fuera del plan de agentes.

1. Con una válvula regando, abrir sus detalles: «Fin riego» muestra la hora de fin. Al cerrar, queda
   vacío.
2. Con una válvula regando y el panel abierto, reiniciar HA. Esperado: antes de perder conexión, la
   válvula sale «Interrumpida · faltan N min». En el histórico de «Fin riego», el atributo
   `remaining_min`. Al volver, en el log, `... riego interrumpido por reinicio de HA, faltaban N
   min; no se retoma`, y la válvula en reposo.
3. Quitar una válvula de una zona: su «Fin riego» desaparece del registro.
