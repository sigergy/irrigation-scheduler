# 01 · Backend — integración Home Assistant

> Estado: **decisiones cerradas** (D7, D15) · Fase 2 · Última actualización: 2026-09-28
> Depende de: `00-overview.md`. La lógica de ejecución está en `03-valves-execution.md`.

## 1. Arquitectura

**D7 — Arquitectura:** panel propio + `helpers.storage.Store` + comandos WebSocket, con una única
config entry. Es el mismo patrón que Scheduler y Chronos.

Alternativas descartadas:
- Una config entry por zona con options flow: los bloques y válvulas quedan en formularios
  anidados y la UX es limitada.
- YAML: no cumple el requisito de UI propia.

## 2. Diseño (D15, aprobado el 2026-09-28)

### 2.1 Estructura

`custom_components/irrigation_scheduler/`, en Python e instalable por HACS.

| Módulo | Responsabilidad |
|---|---|
| `config_flow` | Instancia única. No pide datos: toda la configuración se hace en el panel |
| `store` | Dos `Store` versionados: configuración (modelo de `00-overview.md` §4) y runtime (`03-valves-execution.md` §5.1) |
| `scheduler` | Disparos y colas. Lógica pura, sin dependencias de HA |
| `rain` | Cálculo de lluvia pasada y prevista, y decisión de omitir (`05-rain-skip.md`). Lógica pura sobre los datos leídos |
| `websocket` | API del panel |
| entidades | Ver §2.3 |

### 2.2 API WebSocket

| Comando | Uso |
|---|---|
| `list` | Configuración completa y estado |
| `save_zone` / `delete_zone` | Alta, edición y baja de zonas. Valida las reglas V1–V11 |
| `save_settings` | Configuración global: `global_max_valves`, `notify_targets` y parámetros de lluvia (`05-rain-skip.md` §3.1) |
| `run_zone` / `run_valve` / `stop` / `pause_valve` / `set_valve_enabled` / `set_zone_enabled` | Controles manuales (`pause_valve`, `set_valve_enabled` y `set_zone_enabled`: fase 3, D36). `stop` también apaga las `switch` configuradas encendidas a mano. `set_zone_enabled` con `false` pausa la zona |
| `subscribe` | Estado en vivo: válvulas abiertas, colas, próximo riego y `switch` encendidas a mano (`manual_on`, D37) |

La validación del backend es la fuente de verdad.

### 2.3 Entidades y servicios

- **Por zona:**
  - `select` modo;
  - `switch` habilitada (= ■/▶ de la zona en el panel: apagarla también pausa la zona);
  - `switch` omitir por lluvia (`rain_skip`);
  - `sensor` estado (`idle`, `running`, `queued`). En reposo lleva el icono de la zona, si tiene;
    sin él, `mdi:sprinkler`. Regando, `mdi:sprinkler-variant`; en cola, `mdi:timer-sand`
    (`icons.json`, `docs/ux/icons/spec.md`);
  - `sensor` próximo riego;
  - `button` regar ahora.
- **Globales:**
  - `button` parar todo;
  - `sensor` válvulas activas;
  - `binary_sensor` lluvia suficiente;
  - `sensor` lluvia pasada (mm) y `sensor` lluvia prevista (mm).
- **Servicios:** `run_zone`, `run_valve` (con `minutes` opcional), `stop`, y en la fase 3 `pause_valve`, `set_valve_enabled` y `set_zone_enabled`.

### 2.4 Validación

- **Sin tests automatizados.** Decisión del usuario del 2026-09-28.
- Gates estáticos: `ruff check` y `python -m compileall`.
- La validación funcional se hace directamente en la instalación de Home Assistant del usuario.
