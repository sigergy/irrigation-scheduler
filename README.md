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
- Avisa por push (`notify.mobile_app_*`) de fallos de válvula, excesos de tiempo y sensores no disponibles, y de cada encendido y apagado de válvula (desactivable en Ajustes → «Errores y avisos»).
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

**Por válvula** (en el dispositivo de su switch; si no tiene, en el de la zona):

| Entidad | Tipo | entity_id | Función |
|---|---|---|---|
| Modo riego | `sensor` | `sensor.modo_riego_<dispositivo>` | Origen del riego en curso: `idle` (Parado) · `scheduled` (Programado) · `manual` (Manual) · `external` (Externo, encendida fuera de la integración) |
| Alertas riego | `event` | `event.alertas_riego_<dispositivo>` | Alertas de la válvula: no enciende, no apaga, tiempos excedidos |

**Por zona:**

| Entidad | Tipo | Función |
|---|---|---|
| Estado | `sensor` | `idle` · `running` · `queued` |
| Próximo riego | `sensor` | Fecha y hora del siguiente bloque |
| Habilitada | `switch` | Activa o detiene la zona |
| Omitir por lluvia | `switch` | Opción por zona (ver *Estado*) |
| Modo | `select` | `manual` · `auto` |
| Regar ahora | `button` | Lanza la zona |
| Alertas riego | `event` | Alertas de la zona: sensor caído, riego omitido por lluvia (`event.alertas_riego_<zona>`) |

**Globales:**

| Entidad | Tipo | Función |
|---|---|---|
| Válvulas activas | `sensor` | Número de válvulas abiertas |
| Parar todo | `button` | Cierra todas las válvulas |
| Alertas riego | `event` | Fuente de lluvia no disponible (`event.alertas_riego_instalacion`) |

El entity_id se fija al crear la entidad. Las entidades creadas por versiones anteriores conservan el suyo; renómbralo en HA si quieres el nuevo.

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
- Muestra las zonas elegidas con su estado, el progreso y los controles. Sin zonas elegidas, muestra todas.
- Los administradores configuran zonas y válvulas desde la propia tarjeta (⚙ y «＋ Zona»).
- YAML mínimo:

  ```yaml
  type: custom:irrigation-scheduler-card
  zones: [<zone_id>]  # opcional: sin la clave, todas las zonas
  ```

## Tarjeta de histórico

- En el panel de control: **Añadir tarjeta → Irrigation Scheduler History**.
- Encendidos reales de las válvulas, leídos del recorder de HA. Vistas: Lista, Línea de tiempo y Totales.
- En la **Línea de tiempo**, al pasar el ratón (o tocar en el móvil) por un riego o una marca se abre un pop up:
  - riego: «Riego programado», «Riego manual» o «Riego externo», horas y **tiempo regado** real. Los riegos anteriores al sensor «Modo riego» salen como «Riego»;
  - alerta: su nombre y la hora.
- Las marcas de alerta, en la fila de su nivel. Solo aparecen los tipos con la opción «Histórico» activa en los ajustes de alertas:

| Alerta | Icono | Color | Fila |
|---|---|---|---|
| La válvula no enciende | `mdi:water-off` | Rojo | Válvula |
| La válvula no apaga | `mdi:water-alert` | Rojo | Válvula |
| Tiempo excedido con HA parado | `mdi:timer-alert-outline` | Naranja | Válvula |
| Tiempo excedido con HA en marcha | `mdi:timer-alert-outline` | Naranja | Válvula |
| Encendida a mano demasiado tiempo | `mdi:hand-back-right-outline` | Naranja | Válvula |
| Sensor de zona caído | `mdi:access-point-network-off` | Naranja | Zona |
| Riego omitido por lluvia | `mdi:weather-pouring` | Azul | Zona |
| Fuente de lluvia no disponible | `mdi:weather-cloudy-alert` | Naranja | Instalación |

Los colores siguen el tema de HA (`--error-color`, `--warning-color`, `--info-color`).

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
├── card_resource.py   recurso de Lovelace de la tarjeta
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
