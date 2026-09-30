# Reestructuración del backend — diseño

- **Fecha:** 2026-09-30
- **Rama:** `feat/incidents` (base: `main` en 9abfbeb, v0.3.0)
- **Alcance:** subproyecto 1 de 3 (backend). El frontend y la documentación llevan su propia spec.

## 1. Objetivo

1. Ordenar `custom_components/irrigation_scheduler/` en carpetas por responsabilidad, al estilo de un monorepo modular.
2. Partir `manager.py` (1392 líneas) en piezas pequeñas sin cambiar el comportamiento.
3. Quitar duplicados y código muerto.
4. Que el panel vea «En cola», «Encendiendo», «Pausado»… al momento de pulsar, sin esperar a la escritura en disco.

Fuera de alcance: la espera de verificación de válvulas (`valves.py`, `VERIFY_DELAY_S = 2`, `SWITCH_RETRIES = 3`). El usuario la descartó como causa del problema.

## 2. Restricciones

- **HACS y HA exigen en la raíz del paquete:** `manifest.json`, `__init__.py`, `config_flow.py`, las 6 plataformas (`binary_sensor`, `button`, `event`, `select`, `sensor`, `switch`), `services.yaml`, `strings.json`, `translations/`.
- **Invariantes que no cambian:**
  - claves de Store (`const.py:7-10`);
  - todos los `unique_id` de entidades;
  - URL del bundle `/irrigation_scheduler/irrigation-scheduler.js` (`const.py:88-89`);
  - `Path(__file__).parent` en `__init__.py:37,52` (el bundle sigue en `frontend/` junto a `__init__.py`);
  - API pública del manager que usan plataformas, WebSocket y servicios;
  - formato de los mensajes WebSocket y de los servicios.
- **Concurrencia:** un único event loop. Un único `_lock` protege `config` y `runtime`. Estados en tránsito: `_opening`, `_opening_s`, `_opening_origin`, `_closing`, `_cancelled`. Los métodos `*_locked` exigen el lock tomado.
- **Nombres:** ficheros `kebab-case` no aplica a módulos Python; se usa `snake_case` (PEP 8). Comentarios en español, identificadores en inglés.

## 3. Estructura final

```
custom_components/irrigation_scheduler/
  __init__.py  config_flow.py  const.py  manifest.json
  binary_sensor.py  button.py  event.py  select.py  sensor.py  switch.py
  services.yaml  strings.json  translations/  frontend/  (bundle compilado)
  errors.py            ZoneDeleteError, IrrigationConfigEntry
  domain/              puro, sin HA
    model.py  runtime.py  schedule.py  rain.py  alerts.py  validation.py
  adapters/            I/O con HA
    store.py  valves.py  rain_source.py  notify.py  registry.py  card_resource.py
  api/                 entrada externa
    websocket.py  services.py  schemas.py  snapshot.py  lookup.py
  entities/            base de entidades
    base.py  unique_ids.py  sync.py
  engine/              orquestación con estado
    manager.py  slots.py  rain_control.py  incidents.py  manual.py
    tests/
```

Los nombres exactos de los ficheros que se mueven se fijan en el plan tras listar el paquete actual; la tabla anterior es el destino por responsabilidad.

## 4. Fases

Un commit por paso. Tras cada paso: ruff, compileall y, desde la fase 0, CI en verde.

### Fase 0 — red de seguridad

1. **Workflow de GitHub Actions** (`.github/workflows/tests.yml`):
   - Ubuntu, Python 3.14;
   - `pytest-homeassistant-custom-component==0.13.367` (fija `homeassistant==2026.9.4`);
   - pasos: `ruff check custom_components`, `python -m compileall -q custom_components`, `pytest`.
2. **Tests de caracterización** en `custom_components/irrigation_scheduler/engine/tests/`, escritos contra el código actual y en verde antes de mover nada:
   - bloque programado: abre, riega su duración, cierra;
   - pausa durante la apertura;
   - «Sin agua»;
   - arranque de HA con una válvula que ya pasó su hora;
   - apagado a su hora de una válvula encendida a mano;
   - omisión por lluvia;
   - borrado de zona con fallo de apagado (`ZoneDeleteError`).
   Las válvulas son `input_boolean` o switches de prueba; el tiempo se avanza con `async_fire_time_changed`.

Los tests no se ejecutan en Windows: `lru-dict` pide MSVC. Validación en CI.

### Fase 1 — limpieza sin cambio de comportamiento

- Borrar código muerto: `schedule.next_run` (`schedule.py:44`) y `rain.is_rate_unit` (`rain.py:82`). Antes, `graft callers` para confirmar cero usos.
- `errors.py`: recibe `ZoneDeleteError` (`manager.py:81`) e `IrrigationConfigEntry` (`manager.py:1392`).
- `api/lookup.py`: una sola función para obtener el manager cargado. Sustituye `websocket.py:84-88` y `services.py:31-35`.
- `api/schemas.py`: schemas comunes a WebSocket y servicios.
- `entities/unique_ids.py`: formatos de `unique_id` en un sitio. Mismos valores de salida.

### Fase 2 — carpetas

`git mv` a `domain/`, `adapters/`, `api/`, `entities/` según §3. Se actualizan los imports relativos. Plataformas, `__init__`, `config_flow`, `const`, `manifest` y traducciones se quedan en la raíz.

### Fase 3 — partir `manager.py`

| Pieza | Responsabilidad | Toma el lock |
|---|---|---|
| `engine/slots.py` → `ValveSlots` | Única que modifica `pending`, `open_valves`, `batch_started` y los estados en tránsito. Recibe el `RuntimeState`. | No. Se llama con el lock tomado. |
| `engine/rain_control.py` | Decisiones y episodios de lluvia (hoy 511-708). | No |
| `engine/incidents.py` | Alertas e incidencias (hoy 884-937). | No |
| `engine/manual.py` | Encendido a mano y apagado a su hora (hoy 830-882). | No |
| `adapters/registry.py` | Registro de entidades y dispositivos (hoy 1096-1136). | No |
| `api/snapshot.py` | Construye el snapshot (hoy 1330-1389). | No |
| `engine/manager.py` | Fachada. Dueño único del lock y del orden reservar → I/O → liberar. Ciclo de vida, disparos, cola, controles y configuración. | Sí |

**`ValveSlots`:**

- Transiciones: `reserve(job)`, `opened(...)`, `begin_close(...)`, `closed(...)`, `cancel(match)`, `busy()`.
- Vistas: `opening_view()` (lo que hoy se pasa como `reserved`/`opening` a `startable_jobs` y `estimate_batch_ends`) y `durations()`.
- Pura: sin HA ni asyncio. Tests locales en `engine/tests/test_slots.py`, ejecutables con `pytest` en Windows.

**Regla:** los servicios calculan y devuelven; no toman el lock ni importan el manager. Solo el manager llama a `slots.*`, siempre dentro del lock. Un test lo comprueba recorriendo el AST de `engine/manager.py`: toda llamada a `self._slots.*` está dentro de un `async with self._lock` o en un método `*_locked`.

Objetivo de tamaño: `engine/manager.py` entre 500 y 600 líneas.

### Fase 4 — rapidez del panel

**Causa** (`manager.py:939-942`): `_async_persist` espera `self._store.async_save_runtime(...)` y solo después envía `SIGNAL_STATE`, todo dentro del lock. Además, `async_run_zone` persiste (1155) y `_async_dispatch_locked` vuelve a persistir (746): dos escrituras antes de «Encendiendo».

**C — backend:**

- `_async_persist` envía `SIGNAL_STATE` al momento y marca el estado como sucio.
- Un escritor en segundo plano, fuera del lock, guarda el último `RuntimeState`. Si llegan varias peticiones seguidas se agrupan en una escritura; nunca se pierde la última.
- Al descargar la integración (`async_shutdown`) se espera a la escritura pendiente.
- Test: la señal llega al suscriptor antes de que termine `async_save_runtime`.

**D — frontend** (`frontend/src/shared/controls.ts:48-54`):

- `runCommand` marca el botón como «procesando» (deshabilitado, con indicador) desde el clic hasta la respuesta o el error.
- Sin cambio de API.

**Medición:** log de depuración con tiempos clic → señal → escritura, para comparar antes y después en HA.

## 5. Riesgos

| Riesgo | Tratamiento |
|---|---|
| Cambian los nombres de logger (`custom_components.irrigation_scheduler.manager` → `...engine.manager`) | Se anota en el changelog de la versión. |
| Los tests viajan a los usuarios dentro del paquete de HACS | Decidir al final: aceptarlo o usar `zip_release` en `hacs.json`. |
| Un import circular al separar el manager | Los servicios no importan el manager; dependen solo de `domain/` y `adapters/`. |
| Escritura diferida: HA cae antes de guardar | Ventana de milisegundos; el arranque ya recupera válvulas excedidas (test de fase 0). |
| Estado en tránsito tocado fuera del lock | `ValveSlots` como único dueño + test AST. |

## 6. Entrega

- Commits en `feat/incidents`, push para que valide el CI (push previa confirmación).
- Al final, PR nueva contra `main`.
- Después: spec del frontend (features, partir `zone-editor`, `i18n`, tipos y cliente de API) y spec de documentación.
