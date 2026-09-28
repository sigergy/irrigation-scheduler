# Irrigation Scheduler

Integración de Home Assistant para programar el riego por zonas. Cada válvula es una entidad `switch`.

## Qué hace

- Crea zonas de riego con sus válvulas desde un panel lateral propio (**Riego**).
- Programa cada zona por días de la semana y horas de inicio.
- Asigna a cada válvula su tiempo de riego y las horas en que riega.
- Gestiona colas y límites:
  - por zona, cuántas válvulas se abren a la vez;
  - en toda la instalación, un límite global de válvulas abiertas.
- Recupera el estado tras reiniciar HA y apaga las válvulas que se pasen de tiempo.
- Avisa por push (`notify.mobile_app_*`) de fallos de válvula, excesos de tiempo y sensores no disponibles.
- Incluye una tarjeta Lovelace con editor visual.

## Requisitos

- Home Assistant ≥ 2026.9.0.
- Una entidad `switch` por válvula (relé, enchufe, controlador de riego…).

## Instalación

1. HACS → **Repositorios personalizados** → añade `https://github.com/sigergy/irrigation-scheduler` (tipo *Integración*).
2. Instala **Irrigation Scheduler** y reinicia HA.
3. **Ajustes → Dispositivos y servicios → Añadir integración → Irrigation Scheduler**. Solo admite una instancia.
4. Configura zonas y válvulas desde el panel **Riego** de la barra lateral. Hace falta ser administrador.

## Conceptos

| Término | Significado |
|---|---|
| Zona | Grupo de válvulas con los mismos días, horas y límite de simultaneidad. |
| Bloque | Una hora de inicio de la zona en un día activo. |
| Válvula | `switch` con nombre, minutos de riego y bloques propios. Sin bloques = solo manual. |
| Cola | Orden de las válvulas en la zona. Las que superan el límite esperan su turno. |

## Entidades

**Por zona:**

| Entidad | Tipo | Función |
|---|---|---|
| Estado | `sensor` | `idle` · `running` · `queued` |
| Próximo riego | `sensor` | Fecha y hora del siguiente bloque |
| Habilitada | `switch` | Activa o detiene la zona |
| Omitir por lluvia | `switch` | Opción por zona (ver *Estado*) |
| Modo | `select` | `manual` · `auto` |
| Regar ahora | `button` | Lanza la zona |

**Globales:**

| Entidad | Tipo | Función |
|---|---|---|
| Válvulas activas | `sensor` | Número de válvulas abiertas |
| Parar todo | `button` | Cierra todas las válvulas |

## Servicios

| Servicio | Campos |
|---|---|
| `irrigation_scheduler.run_zone` | `zone_id` |
| `irrigation_scheduler.run_valve` | `entity_id`, `minutes` (opcional) |
| `irrigation_scheduler.stop` | `zone_id` (opcional; sin él, pausa todo) |
| `irrigation_scheduler.pause_valve` | `entity_id` |
| `irrigation_scheduler.set_valve_enabled` | `entity_id`, `enabled` |
| `irrigation_scheduler.set_zone_enabled` | `zone_id`, `enabled` |

## Tarjeta Lovelace

- En el panel de control: **Añadir tarjeta → Irrigation Scheduler**.
- Muestra las zonas elegidas con su estado, el progreso y los controles.
- YAML mínimo:

  ```yaml
  type: custom:irrigation-scheduler-card
  zones: [<zone_id>]
  ```

## Estado

| Función | Estado |
|---|---|
| Zonas, bloques, colas, controles manuales | ✅ |
| Panel lateral y tarjeta | ✅ |
| Notificaciones push de fallos | ✅ |
| Omisión por lluvia (sensor / previsión) | ⏳ Se guardan los ajustes; la omisión aún no se aplica |
| Modo `auto` según sensores | ⏳ Pendiente |

## Estructura del repositorio

```
custom_components/irrigation_scheduler/   integración (Python)
├── __init__.py        arranque, panel y recurso JS
├── manager.py         orquestador: disparos, colas, reinicio
├── schedule.py        cálculo de bloques y próximo riego
├── valves.py          encendido y apagado de switches
├── store.py           persistencia (config + runtime)
├── websocket.py       API del panel
├── services.py        servicios de HA
├── notify.py          push al móvil
├── sensor/switch/select/button.py   entidades
└── frontend/irrigation-scheduler.js bundle compilado (no editar)
frontend/                                 panel y tarjeta (Lit + Vite, TypeScript)
docs/specs/                               especificación por fases
docs/mockups/                             maquetas HTML del panel y la tarjeta
```

## Desarrollo del frontend

```sh
cd frontend
npm ci
npm run lint
npm run build   # escribe custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js
```

## Licencia

Ver [LICENSE](LICENSE).
