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
- Apaga a su hora las válvulas encendidas fuera de la integración (botón físico, otra automatización), al cumplir sus minutos.
- Cierra la válvula y avisa si su sensor de suministro indica que no llega agua.
- Avisa por push (`notify.mobile_app_*`) de fallos de válvula, excesos de tiempo, sensores caídos, lluvia y cada encendido y apagado de válvula. Cada aviso se configura en Ajustes → «Errores y avisos» (ver [Alertas y avisos](#alertas-y-avisos)).
- Dice los avisos en voz alta por altavoces y pantallas (Google Nest, Chromecast, Sonos…) con un motor TTS de HA (ver [Avisos por voz](#avisos-por-voz)).
- Los avisos se envían en segundo plano: un móvil o un altavoz lento no retrasa el riego.
- Horario silencioso: una franja sin riego. Lo que caiga dentro espera a que termine (ver [Horario silencioso](#horario-silencioso)).
- Incluye una tarjeta Lovelace con editor visual.

## Requisitos

- Home Assistant ≥ 2026.9.0.
- Una entidad `switch` por válvula (relé, enchufe, controlador de riego…).

## Instalación

1. HACS → **Repositorios personalizados** → añade `https://github.com/sigergy/irrigation-scheduler` (tipo *Integración*).
2. Instala **Irrigation Scheduler** y reinicia HA.
3. **Ajustes → Dispositivos y servicios → Añadir integración → Irrigation Scheduler**. Solo admite una instancia.
4. Configura zonas y válvulas desde el panel **Riego** de la barra lateral. Cualquier usuario puede hacerlo.

Versiones beta: en HACS, menú ⋮ del repositorio → «Redescargar» y elige la versión, o activa «Mostrar versiones beta».

## Conceptos

| Término | Significado |
|---|---|
| Zona | Grupo de válvulas con los mismos días, horas y límite de simultaneidad. |
| Bloque | Una hora de inicio de la zona en un día activo. |
| Válvula | `switch` con nombre, minutos de riego, bloques propios y, opcionalmente, un sensor de suministro (`binary_sensor`). Sin bloques = solo manual. |
| Cola | Orden de las válvulas en la zona. Las que superan el límite esperan su turno. |

## Entidades

**Por válvula** (en el dispositivo de su switch; si no tiene, en el de la zona):

| Entidad | Tipo | entity_id | Función |
|---|---|---|---|
| Modo riego | `sensor` | `sensor.modo_riego_<dispositivo>` | Origen del riego en curso: `idle` (Parado) · `scheduled` (Programado) · `manual` (Manual) · `external` (Externo, encendida fuera de la integración) |
| Alertas riego | `event` | `event.alertas_riego_<dispositivo>` | Alertas de la válvula: error al encender o apagar, excesos de tiempo |

**Por zona:**

| Entidad | Tipo | Función |
|---|---|---|
| Estado | `sensor` | `idle` · `running` · `queued`. En reposo muestra el icono de la zona |
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
| Alertas riego | `event` | Alertas de la instalación: sin datos de lluvia (`event.alertas_riego_instalacion`) |

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
- Cada válvula que riega lleva barra de progreso y tiempo restante, también si se encendió fuera de la integración: cuenta hasta la hora a la que se apaga. Se mantiene al recargar la página o cambiar de pestaña.
- Zonas y válvulas se configuran también desde la propia tarjeta (⚙ y «＋ Zona»).
- Cada zona puede llevar un icono (campo «Icono» del editor). La tarjeta lo muestra mientras la zona no riega; regando o en cola, el icono del estado.
- YAML mínimo:

  ```yaml
  type: custom:irrigation-scheduler-card
  zones: [<zone_id>]  # opcional: sin la clave, todas las zonas
  ```

## Tarjeta de histórico

- En el panel de control: **Añadir tarjeta → Irrigation Scheduler History**.
- Encendidos reales de las válvulas, leídos del recorder de HA. Vistas: Línea de tiempo y Totales.
- En la **Línea de tiempo**, al pasar el ratón (o tocar en el móvil) por un riego o una marca se abre un pop up:
  - riego: «Riego programado», «Riego manual» o «Riego externo», horas y **tiempo regado** real. Los riegos anteriores al sensor «Modo riego» salen como «Riego»;
  - alerta: su nombre y la hora.
- Las marcas de alerta van en la fila de su nivel, con el icono y el color de la tabla de [Alertas y avisos](#alertas-y-avisos). Solo aparecen los tipos con la opción «Histórico» activa.

## Alertas y avisos

Cada alerta queda en su entidad «Alertas riego» y emite un evento `irrigation_scheduler_*`. Según Ajustes → «Errores y avisos», además envía push y se marca en la tarjeta de histórico.

- **Cabecera del push** y **color de la marca** salen de la misma severidad: Error (rojo), Alerta (naranja) o Info (azul). Los colores siguen el tema de HA (`--error-color`, `--warning-color`, `--info-color`).
- **Texto del push:** `Zona · Válvula: qué pasa. Qué hacer.` La parte «qué hacer» solo va en las que piden acción.

**Requieren acción**

| Alerta | Nivel | Cabecera | Marca | Texto del push |
|---|---|---|---|---|
| Error apagado | Válvula | Error | `mdi:water-alert` | Huerto · Goteo: no se apaga (07:30). Puede seguir regando. Ciérrala a mano ya. |
| Error encendido | Válvula | Error | `mdi:water-off` | Huerto · Goteo: no enciende (07:30). Se salta su riego. Revisa la válvula. |
| Sin agua | Válvula | Error | `mdi:pipe-disconnected` | Huerto · Goteo: sin agua (07:30). Válvula cerrada. Revisa el suministro. |
| Sensor caído | Zona | Alerta | `mdi:access-point-network-off` | Huerto · Humedad: sensor sin datos desde las 07:30. Revisa el sensor. |
| Sin datos de lluvia | Instalación | Alerta | `mdi:weather-cloudy-alert` | Sin datos de lluvia: pluviómetro. Se usa la otra fuente. Revisa la fuente. |

**Solo información**

| Alerta | Nivel | Cabecera | Marca | Texto del push |
|---|---|---|---|---|
| Exceso con HA parado | Válvula | Alerta | `mdi:timer-alert-outline` | Huerto · Goteo: más de 20 min encendida mientras HA estaba caído. |
| Exceso de tiempo | Válvula | Alerta | `mdi:timer-alert-outline` | Huerto · Goteo: abierta más de lo previsto. Apagada a las 07:30. |
| Exceso manual | Válvula | Alerta | `mdi:hand-back-right-outline` | Huerto · Goteo: más de 20 min encendida a mano. Apagada a las 07:30. |
| Omitido por lluvia | Zona | Info | `mdi:weather-pouring` | Riego saltado por lluvia: Huerto 20:00 (6.2 mm previstos). No se repite el aviso hasta el próximo riego. |
| Encendido/apagado | Válvula | Info | — (solo push) | Huerto · Goteo: encendida a las 07:30 (programado). · Huerto · Goteo: apagada a las 07:50, 20 min regando (programado). |

- Un push por lote en «Omitido por lluvia», y como mucho uno por zona cada 24 h.
- Una válvula encendida fuera de la integración (botón físico, otra automatización) se apaga al cumplir sus minutos. «Exceso manual» solo salta si no se apagó a su hora.
- «Sin agua» sale del sensor de suministro de la válvula (p. ej. «Suministro de agua» de la Sonoff SWV). Si la válvula riega, se cierra; si no, solo avisa. La fila de la válvula dice «Sin agua» mientras dure.
- «Sin datos de lluvia» dice «Se riega igual.» si fallan las dos fuentes, o «Se usa la otra fuente.» si queda una.
- Detalle de cada alerta: [`docs/alerts/`](docs/alerts/README.md).

## Avisos por voz

Los altavoces dicen el mismo aviso que el push: cabecera y texto, con « · » leído como pausa. Ejemplo: «Error. Huerto, Goteo: no se apaga (07:30). Puede seguir regando. Ciérrala a mano ya.»

- **Requisitos:** un motor TTS moderno (entidad `tts.*`, p. ej. Google Translate o Piper) y un `media_player` que reproduzca medios. Cast, Sonos y otros entran igual. No valen Alexa ni Android TV sin Cast.
- **Ajustes → Notificaciones → «Altavoces y pantallas · voz»:**
  - elige los altavoces con los chips; los no disponibles salen atenuados;
  - elige el motor de voz;
  - «Fijar el volumen antes de hablar»: interruptor y deslizador 0–100 %. Apagado, no se toca el volumen del altavoz. Encendido, el volumen se queda cambiado después del aviso;
  - «Probar» dice una frase de prueba en ese altavoz.
- **Ajustes → «Errores y avisos»:** columna «Voz» por tipo de aviso. El desplegable de cada fila elige qué altavoces hablan; sin elegir, hablan todos.
- **Limitaciones:**
  - interrumpe lo que esté sonando y no lo reanuda;
  - un grupo Cast y uno de sus miembros a la vez se pisan: elige uno de los dos;
  - un altavoz no disponible se salta y queda en el log; el riego no espera nunca a la voz.

## Horario silencioso

Una franja horaria sin riego, por ejemplo de noche. Se activa en Ajustes → «Horario silencioso» (desde y hasta, `HH:MM`; puede cruzar la medianoche).

- **Al programar:** no se pueden crear bloques que se solapen con la franja, contando lo que dura el riego de todas sus válvulas. Tocar el borde sí vale: un bloque puede acabar justo al empezar la franja. Si al activarla ya hay bloques que chocan, Ajustes los lista («Choca con: …») y no guarda hasta corregirlos.
- **Lo que cae dentro espera al fin de la franja:** bloques perdidos con HA caído, colas retrasadas por límites y «Regar ahora». La zona muestra «Aplazado hasta 07:00». Una orden manual dentro de la franja avisa «Se regará a las 07:00».
- **Al terminar la franja:** se vuelve a mirar la lluvia para lo programado, con las reglas de «Omitir por lluvia». Lo manual riega siempre.
- **No se toca:** una válvula ya abierta al empezar la franja termina su riego; un encendido externo del `switch` no se puede impedir.
- Si cambias o desactivas la franja con riego aplazado, se recalcula: fuera de la franja nueva arranca ya.

## Estado

| Función | Estado |
|---|---|
| Zonas, bloques, colas, controles manuales | ✅ |
| Panel lateral y tarjeta | ✅ |
| Alertas y avisos push | ✅ |
| Avisos por voz (Cast / TTS) | 🧪 Beta |
| Horario silencioso | 🧪 Beta |
| Omisión por lluvia (sensor / previsión) | ✅ |
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
docs/alerts/                              catálogo y detalle de alertas
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

Copyright (c) 2026 sigergy. Todos los derechos no concedidos expresamente quedan reservados.

Publicado bajo [PolyForm Strict 1.0.0](LICENSE): uso personal y no comercial permitido.
No se permite redistribuir, modificar, crear obras derivadas ni usarlo con fines comerciales.
Para cualquier otro uso, contacta con el autor.
