# 00 · Visión general — Irrigation Scheduler

> Estado: **en diseño** · Última actualización: 2026-09-28
> Fuente: documento inicial del proyecto + sesión de brainstorming del 2026-09-27/28.

Custom component para **Home Assistant** (dominio `irrigation_scheduler`) orientado a la gestión
de **zonas de riego**, con panel propio de estilo similar a *Chronos*.

## 1. Propósito

- Crear y gestionar zonas de riego desde una UI propia.
- Programar riegos por horas de inicio y días de la semana.
- Controlar válvulas mediante entidades `switch` de HA.
- Avisar por push al móvil ante fallos.
- Omitir riegos cuando ha llovido o va a llover por encima de un umbral.
- (Fase 6) Calcular el riego automáticamente a partir de sensores ambientales.

## 2. Mapa de specs

| Spec | Fase | Alcance | Estado |
|---|---|---|---|
| `00-overview.md` | 1 | Modelo, reglas, glosario, decisiones transversales | Decisiones cerradas |
| `01-backend.md` | 2 | Integración HA, almacenamiento, WebSocket, entidades, servicios | Decisiones cerradas |
| `02-frontend.md` | 3 | Panel lateral estilo Chronos y tarjeta Lovelace | Decisiones cerradas |
| `03-valves-execution.md` | 4 | Scheduler, colas, reinicio, fallos, notificaciones | Decisiones cerradas |
| `05-rain-skip.md` | 5 | Omisión de riego por lluvia pasada o prevista | Decisiones cerradas |
| `04-sensors-auto.md` | 6 | Sensores y métodos de cálculo (modo `auto`) | Pospuesto |

## 3. Glosario

| Término | Definición |
|---|---|
| **Instalación** | Única instancia de la integración. Contiene la configuración global y las zonas. |
| **Zona** | Conjunto de válvulas que comparten días, horas de inicio y límite de simultaneidad. |
| **Bloque** | Una hora de inicio de la zona en un día activo. Lanza el riego de las válvulas que le tocan. |
| **Válvula** | Entidad `switch` de HA con tiempo de riego y frecuencia propios. |
| **Frecuencia (F)** | Nº de bloques del día en los que riega una válvula. |
| **Trabajo** | Apertura concreta de una válvula durante su tiempo de riego, generada por un bloque o por un control manual. |
| **Simultaneidad de zona** | Máximo de válvulas de la zona abiertas a la vez. |
| **Límite global** | Máximo de válvulas abiertas a la vez en toda la instalación. |
| **Bloque omitido** | Bloque que no se ejecuta porque la lluvia supera un umbral (`05-rain-skip.md`). |
| **Latido (`last_alive`)** | Marca de tiempo persistida cada 5 min con HA en marcha, y también en cada disparo de bloque. Sirve para detectar inicios perdidos. |

## 4. Modelo de datos

```
Instalación (config entry única)
├── global_max_valves      int ≥ 1 | null (null = sin límite)
├── notify_targets         lista de servicios notify.mobile_app_* (0..N)
├── rain_sensor            sensor.* | null        ┐
├── rain_past_hours        int 1–24, defecto 24   │ lluvia pasada
├── rain_past_threshold_mm número > 0, defecto 5 ┘
├── weather_entity         weather.* | null       ┐
├── rain_forecast_hours    int 1–48, defecto 12   │ lluvia prevista
├── rain_forecast_threshold_mm número > 0, defecto 5 ┘
└── Zona (N)
    ├── name               texto, obligatorio
    ├── enabled            bool
    ├── mode               manual | auto
    ├── days               subconjunto de {L, M, X, J, V, S, D}, ≥ 1
    ├── start_times        lista de HH:MM, ≥ 1, sin duplicados, ordenada
    ├── max_simultaneous   int ≥ 1
    ├── rain_skip          bool (defecto true)
    ├── sensors            temperatura / humedad ambiental / humedad suelo (opcionales)
    ├── calc_method        null (fase 6)
    └── Válvula (N; el orden define el orden de cola)
        ├── entity_id      switch.*, obligatorio, único en toda la instalación
        ├── duration_min   int ≥ 1 (incrementos de 1 min)
        └── frequency      int, 1 ≤ F ≤ nº de start_times
```

### 4.1 Días y bloques

- Los días se definen **por zona**. Todos los bloques de la zona se aplican esos días.
- Solo se define la **hora de inicio**. No hay hora de fin: la duración real la marca el tiempo
  de cada válvula.
- Se admiten varios bloques por día.

### 4.2 Reparto de la frecuencia (reparto uniforme)

Los bloques se ordenan por hora, con índices `0 … n−1`. Una válvula con frecuencia `F` riega en:

- `F = 1` → bloque `0`.
- `F ≥ 2` → bloques `round(i · (n−1) / (F−1))` para `i = 0 … F−1`.

Ejemplo: bloques 07:00, 14:00 y 20:00 (`n = 3`).

| F | Bloques en que riega |
|---|---|
| 1 | 07:00 |
| 2 | 07:00, 20:00 |
| 3 | 07:00, 14:00, 20:00 |

### 4.3 Modo de riego

| Modo | Comportamiento | Condición |
|---|---|---|
| `manual` | Riega según los bloques programados | Siempre disponible |
| `auto` | Riego gobernado por el método de cálculo | Deshabilitado si la zona no tiene método (fase 6) |

Es modificable en cualquier momento.

## 5. Reglas de validación

El backend es la fuente de verdad. La UI anticipa los errores, pero no sustituye la validación
del backend.

| # | Regla | Resultado |
|---|---|---|
| V1 | Válvula sin entidad `switch` | No se guarda |
| V2 | `duration_min` no entero o < 1 | Error |
| V3 | `frequency` > nº de bloques de la zona | Error. No se recorta en silencio: se rechaza el guardado y se marcan las válvulas afectadas |
| V4 | Zona sin ningún día | Error |
| V5 | Zona sin ningún bloque | Error |
| V6 | Hora de inicio duplicada en una zona | Error |
| V7 | Una misma `switch` en dos válvulas | La UI no la ofrece (el selector oculta las ya usadas) y el backend la rechaza |
| V8 | `auto` sin método de cálculo | Opción deshabilitada |
| V9 | `max_simultaneous` < 1, o `global_max_valves` < 1 cuando no es null | Error |
| V10 | `rain_past_hours` fuera de 1–24, o `rain_past_threshold_mm` ≤ 0 | Error |
| V11 | `rain_forecast_hours` fuera de 1–48, o `rain_forecast_threshold_mm` ≤ 0 | Error |

V3 aplica también al borrar bloques: si `n` baja por debajo de la `F` de alguna válvula, no se
puede guardar hasta corregirla.

## 6. Decisiones transversales cerradas

| ID | Decisión | Detalle |
|---|---|---|
| D1 | Organización de specs | Una spec global y una por fase (§2) |
| D2 | Días por zona | §4.1 |
| D3 | Simultaneidad por zona con cola continua | `03-valves-execution.md` §3 |
| D4 | Frecuencia con reparto uniforme | §4.2 |
| D5 | Zonas en paralelo; los bloques de una misma zona se encolan | `03-valves-execution.md` §3 |
| D6 | Límite global opcional, cola FIFO entre zonas | `03-valves-execution.md` §3 |
| D7 | Arquitectura: panel propio + `Store` + WebSocket, con una config entry única | `01-backend.md` |
| D8 | Reinicio: apagar las válvulas excedidas y completar el resto, con la cola incluida | `03-valves-execution.md` §5 |
| D9 | Inicios perdidos: al arrancar HA se ejecutan todos, en orden cronológico y sin ventana | `03-valves-execution.md` §5.2 |
| D10 | Controles manuales: habilitar zona, regar zona, regar válvula, parar todo | `03-valves-execution.md` §4 |
| D11 | El selector de válvula oculta las `switch` ya asignadas | §5, V7 |
| D12 | Fallo de `switch`: 3 reintentos, evento, y la cola sigue sin ella | `03-valves-execution.md` §6 |
| D13 | Notificaciones push a uno o varios `notify.mobile_app_*` | `03-valves-execution.md` §7 |
| D14 | ~~Los bloques omitidos no envían push~~ Anulada el 2026-09-28: ya no se omiten bloques (D9) | — |
| D15 | Backend: módulos, API WebSocket, entidades, servicios y validación (sin tests automatizados) | `01-backend.md` §2 |
| D16 | Frontend: panel en Lit con tres vistas, textos en español e inglés | `02-frontend.md` §2 |
| D17 | Latido `last_alive` cada 5 min (y en cada disparo de bloque) para detectar inicios perdidos | `03-valves-execution.md` §5.1 |
| D18 | Los bloques perdidos se evalúan con la configuración vigente al arrancar | `03-valves-execution.md` §5.2 |
| D19 | Omisión por lluvia: fuente pasada (`sensor`) y prevista (`weather`), las dos opcionales; se omite si cualquiera supera su umbral | `05-rain-skip.md` §2–§4 |
| D20 | Configuración de lluvia global + interruptor `rain_skip` por zona | `05-rain-skip.md` §3 |
| D21 | La lluvia se evalúa en bloques programados y recuperados, nunca en controles manuales | `05-rain-skip.md` §5 |
| D22 | Si falla una fuente de lluvia, se decide con la otra; si fallan todas las configuradas, se riega. Cada fallo se notifica | `05-rain-skip.md` §6 |
| D23 | Un bloque omitido por lluvia emite evento y push de prioridad normal | `05-rain-skip.md` §7 |
| D24 | La omisión es por bloque, no por válvula; un único push por episodio de lluvia | `05-rain-skip.md` §7.1 |
| D25 | Fases: la lluvia (5) va antes que el cálculo automático (6) | §7 |
| D26 | Ventana de lluvia prevista: parámetro global, 12 h por defecto (1–48 h); umbral 5 mm por defecto | `05-rain-skip.md` §3.1 |
| D27 | Ventana de lluvia pasada: parámetro global, 24 h por defecto (1–24 h); umbral 5 mm por defecto | `05-rain-skip.md` §3.1 |
| D28 | Frontend: TypeScript + Lit + Vite, un único bundle commiteado en la integración | `02-frontend.md` §3.1 |
| D29 | Panel `panel_custom` solo admin por defecto («Riego», `mdi:sprinkler-variant`); tarjeta cargada con `add_extra_js_url` | `02-frontend.md` §3.2 |
| D30 | Una suscripción compartida; el editor trabaja sobre una copia | `02-frontend.md` §3.3 |
| D31 | Lista de zonas compacta; sin indicador de lluvia hasta la fase 5 | `02-frontend.md` §4.1 |
| D32 | Editor de zona en dos columnas con estado en vivo y control por válvula | `02-frontend.md` §4.2 |
| D33 | Ajustes globales en tres tarjetas | `02-frontend.md` §4.3 |
| D34 | Una tarjeta Lovelace con varias zonas plegables | `02-frontend.md` §5 |
| D35 | Textos ES/EN, gestión de errores y gates estáticos del front | `02-frontend.md` §6 |
| D36 | Control «parar válvula» (`stop_valve`) | `03-valves-execution.md` §4 |
| D37 | El latido vigila válvulas pasadas de tiempo y `switch` encendidas a mano | `03-valves-execution.md` §5.3 |

## 7. Hoja de ruta

| Fase | Alcance |
|---|---|
| 1 | Diseño y documentación (`docs/`) |
| 2 | Backend: integración HA, modelo de datos, scheduler |
| 3 | Frontend: panel estilo Chronos |
| 4 | Válvulas y ejecución de riegos |
| 5 | Omisión de riego por lluvia (`05-rain-skip.md`) |
| 6 | Sensores y métodos de cálculo (modo `auto`) |
