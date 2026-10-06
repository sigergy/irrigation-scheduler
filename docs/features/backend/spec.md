# Backend — arquitectura e integración con Home Assistant

> Estado: **implementado** · Última actualización: 2026-10-03
> Depende de: [`docs/overview.md`](../../overview.md). La lógica de ejecución está en [`docs/features/valves-execution/spec.md`](../valves-execution/spec.md).

## 1. Arquitectura general

**D7 — Arquitectura:** panel propio + `helpers.storage.Store` + comandos WebSocket, con una única config entry. Es el mismo patrón que Scheduler y Chronos.

- Una única instancia de integración (`config_flow.py` sin pasos manuales).
- Persistencia doble mediante `Store`: configuración versionada y runtime volátil.
- Concurrencia sobre un único event loop de asyncio con un `_lock` que protege `config` y `runtime`.

## 2. Estructura modular del backend

El paquete `custom_components/irrigation_scheduler/` está estructurado por capas de responsabilidad:

```
custom_components/irrigation_scheduler/
  __init__.py          Carga de integración, servicios y recursos frontend
  config_flow.py       Instancia única
  const.py             Constantes del dominio y claves de Store
  manifest.json        Metadatos y dependencias de HA
  binary_sensor.py     Plataforma binary_sensor
  button.py            Plataforma button
  event.py             Plataforma event (alertas e incidencias)
  select.py            Plataforma select
  sensor.py            Plataforma sensor
  switch.py            Plataforma switch
  errors.py            Excepciones (ZoneDeleteError, etc.)
  domain/              Modelos puros y reglas de negocio (sin HA)
    model.py           Entidades del dominio (Installation, Zone, Valve, Settings)
    runtime.py         Modelos de runtime (Job, OpenValve, RuntimeState)
    schedule.py        Cálculos de bloques, solapes y horario silencioso
    rain.py            Cálculos puros de precipitación y umbrales
    alerts.py          Catálogo de tipos de alerta y prioridades
    validation.py      Validación de reglas V1–V18
  adapters/            I/O e integración con APIs de HA
    store.py           Persistencia con Store
    valves.py          Llamadas a servicios de conmutación de switch con reintentos
    rain_source.py     Consulta a sensores de lluvia y entidades weather
    notify.py          Envío push a través de notify.mobile_app_*
    speak.py           Canal de voz TTS a altavoces Cast
    registry.py        Registro de entidades y dispositivos en HA
    card_resource.py   Registro de la tarjeta en recursos de Lovelace
  api/                 Punto de entrada externo
    websocket.py       Comandos WebSocket del panel
    services.py        Servicios registrados en HA
    schemas.py         Esquemas Voluptuous compartidos
    snapshot.py        Generación del snapshot para la UI
    lookup.py          Localización de la instancia activa del manager
  entities/            Bases y sincronización de entidades
    base.py            Clases base de entidad
    unique_ids.py      Generación uniforme de unique_id
    sync.py            Sincronización incremental de entidades tras cambios
  engine/              Orquestación con estado
    manager.py         Fachada orquestadora
    slots.py           ValveSlots: dueño único de estados en tránsito y colas
    rain_control.py    Decisiones y episodios de omisión por lluvia
    incidents.py       Despacho de alertas y notificaciones
    manual.py          Temporizadores de apagado de válvulas encendidas a mano
    tests/             Tests de caracterización
```

## 3. API WebSocket

| Comando | Uso |
|---|---|
| `list` | Configuración completa y estado |
| `save_zone` / `delete_zone` | Alta, edición y baja de zonas. Valida reglas V1–V14 |
| `save_settings` | Configuración global: `global_max_valves`, `notify_targets`, altavoces y lluvia |
| `run_zone` / `run_valve` / `stop` / `pause_valve` / `set_valve_enabled` / `set_zone_enabled` | Controles manuales de ejecución y pausa |
| `subscribe` | Suscripción de estado en vivo: snapshot de válvulas abiertas, colas, etc. |
| `test_speak` | Prueba del canal de avisos por voz TTS |

## 4. Entidades y servicios

- **Por zona:**
  - `select` modo (`manual` / `auto`).
  - `switch` habilitada (= ■/▶ de la zona).
  - `switch` omitir por lluvia (`rain_skip`).
  - `sensor` estado (`idle`, `running`, `queued`).
  - `sensor` próximo riego.
  - `button` regar ahora.
  - `event` alertas de zona.
- **Por válvula:**
  - `sensor` modo de riego (`idle`, `scheduled`, `manual`, `external`).
  - `event` alertas de válvula.
- **Globales:**
  - `button` parar todo.
  - `sensor` válvulas activas.
  - `binary_sensor` lluvia suficiente.
  - `sensor` lluvia pasada (mm), prevista (mm) y estimada (mm).
  - `event` alertas de instalación.
- **Servicios:** `run_zone`, `run_valve`, `stop`, `pause_valve`, `set_valve_enabled`, `set_zone_enabled`.

## 5. Concurrencia y estado

- **`ValveSlots`:** Objeto puro con estado que gestiona `pending`, `open_valves`, `batch_started` y estados transitorios (`_opening`, `_closing`, `_cancelled`).
- **Persistencia diferida:** Notificación inmediata vía `SIGNAL_STATE` y escritura de `RuntimeState` en segundo plano para máxima respuesta en la interfaz.

## 6. Verificación

- Linting y tipado: `uvx ruff check custom_components` y `python -m compileall -q custom_components`.
- Tests de integración de backend en CI (`.github/workflows/tests.yml`).
