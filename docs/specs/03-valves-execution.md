# 03 · Válvulas y ejecución de riegos

> Estado: **decisiones cerradas** · Fase 4 · Última actualización: 2026-09-28
> Depende de: `00-overview.md` (modelo §4, reglas §5).

## 1. Alcance

- Disparo de los bloques programados.
- Colas de ejecución por zona y global.
- Controles manuales.
- Persistencia del runtime y comportamiento ante reinicios de HA.
- Fallos de válvula y notificaciones push.

## 2. Disparo de bloques

- Para cada zona con `enabled = true` se registra un disparo en cada `start_time`
  (`async_track_time_change`).
- Al dispararse, el bloque solo se ejecuta si:
  - el día actual está en `days` de la zona;
  - `mode = manual`. Hasta la fase 6, `auto` no ejecuta bloques;
  - no se omite por lluvia (`05-rain-skip.md` §4).
- El bloque genera **un trabajo por cada válvula que tiene esa hora en su `start_times`**
  (`00-overview.md` §4.2), en el orden en que están configuradas las válvulas. Las válvulas con
  `enabled = false` (detenidas) no generan trabajo.
- Al cambiar la configuración de una zona, se recalculan sus disparos.

## 3. Colas

Una válvula abre solo si hay hueco en **los dos** niveles.

### 3.1 Nivel zona

- Como máximo hay `max_simultaneous` válvulas de la zona abiertas.
- **Cola continua:** en cuanto termina una válvula, abre el siguiente trabajo en espera. No se
  espera a que termine un lote completo.
- Si llega un bloque nuevo de la misma zona mientras el anterior sigue regando, sus trabajos se
  **encolan detrás** del bloque en curso.

### 3.2 Nivel global

- Como máximo hay `global_max_valves` válvulas abiertas en toda la instalación. Con `null`, no hay
  límite.
- Las zonas distintas riegan **en paralelo**, dentro del límite global.
- Si el límite global está lleno, los trabajos listos de distintas zonas esperan en orden **FIFO**
  según su llegada.

## 4. Controles manuales

| Control | Efecto | Límites que respeta |
|---|---|---|
| Regar zona ahora (`run_zone`; UI ▶ de zona programada) | Encola un trabajo por **cada** válvula habilitada de la zona, incluidas las que no tienen bloques. Una zona detenida se rechaza con error | Simultaneidad de zona + global |
| Regar válvula ahora | Abre una válvula durante X min (por defecto, su `duration_min`). Una válvula detenida se rechaza con error | Global |
| Pausar zona (`stop` con zona; UI ⏸) | Pausar válvula sobre **cada** válvula de la zona: apaga las abiertas y las `switch` configuradas encendidas a mano, y vacía su cola. Los bloques posteriores siguen | — |
| Pausar todo (`stop` sin zona; UI ⏸) | Pausar válvula sobre todas las válvulas de todas las zonas. Los bloques posteriores siguen | — |
| Pausar válvula (`pause_valve`, D36; UI ⏸) | Anula todo lo ya disparado de esa válvula: quita **todos** sus trabajos pendientes y, si está abierta o abriéndose, la apaga; si es una `switch` configurada encendida a mano (§5.3), la apaga. Los bloques posteriores siguen. El hueco liberado da paso al siguiente trabajo | — |
| Detener válvula (`set_valve_enabled` con `false`, D36; UI ■) | Pausar válvula + `enabled = false` persistido en la configuración: no entra en ningún bloque ni en «regar zona» hasta reactivarla | — |
| Reactivar válvula (`set_valve_enabled` con `true`, D36; UI ▶ sobre detenida) | `enabled = true`. No riega en ese momento; vuelve a entrar en los bloques siguientes | — |
| Detener zona (`set_zone_enabled` con `false`, o entidad `switch` apagada; UI ■ de zona) | Pausar zona + `zone.enabled = false`: no dispara bloques ni admite «regar zona» hasta reactivarla. **No** cambia el `enabled` de sus válvulas | — |
| Reactivar zona (`set_zone_enabled` con `true`, o entidad `switch` encendida; UI ▶ sobre zona detenida) | `zone.enabled = true`. No riega en ese momento. Cada válvula vuelve con el estado que tenía | — |

Ninguno de estos controles exige admin: son de uso diario.

Zona y válvula tienen los mismos tres controles (▶ ⏸ ■) y dos «detenido» independientes:
`zone.enabled` y `valve.enabled`. Una válvula riega en un bloque solo si los dos son `true`.

## 5. Persistencia y reinicio de HA

### 5.1 Estado de runtime persistido

Se guarda en un `Store` aparte de la configuración y se escribe en cada cambio. Contiene:

- las válvulas abiertas: `entity_id`, `zone_id`, `started_at`, `ends_at`;
- el inicio del lote en curso de cada zona (`batch_started`): se fija con la primera válvula
  que abre y se borra cuando la zona queda sin válvulas abiertas, abriéndose ni en cola;
- las colas pendientes, por zona y global, en su orden;
- episodios de lluvia: hora de apertura por zona (`05-rain-skip.md` §8.14, §8.19);
- decisiones de lluvia fijadas por bloque (`05-rain-skip.md` §8.16, §8.23);
- `last_alive`: marca de tiempo que se actualiza cada **5 min** mientras HA está en marcha (latido),
  y también en cada disparo de bloque. Sirve para detectar inicios perdidos también tras una caída
  sin parada limpia.
  - Como cada disparo actualiza `last_alive`, un bloque ya ejecutado nunca se repite, aunque el
    latido vaya retrasado.
  - El apagado de las válvulas no depende del latido: usa `ends_at`, que se guarda al abrir.
  - Decisión del 2026-09-28: 5 min en lugar de 1 min, para escribir menos en disco.

### 5.2 Al arrancar HA

1. **Válvulas con `now ≥ ends_at`**, es decir, que han excedido su tiempo: se envía el apagado de
   inmediato, se registra como «excedida» y se notifica (§7).
2. **Válvulas con `now < ends_at`**: siguen abiertas y su apagado se programa en `ends_at`.
3. **Colas pendientes**: continúan con normalidad (§3).
4. **Inicios perdidos**, es decir, bloques cuya hora cae entre `last_alive` y `now`:
   - se ejecutan **todos**, sin límite de antigüedad (D9);
   - en orden cronológico de su hora de inicio;
   - cada bloque se encola en su zona como un bloque normal (§3), detrás de las colas ya pendientes;
   - se aplican las condiciones de §2 con la configuración vigente al arrancar: zona habilitada,
     día activo en la fecha del inicio perdido y `mode = manual`;
   - la omisión por lluvia se evalúa en el momento del arranque (`05-rain-skip.md` §5).
   - Nunca se omite un bloque perdido por tiempo.

### 5.3 Vigilancia de tiempos en el latido (D37)

En cada latido (5 min), además de actualizar `last_alive`:

1. **Válvulas propias pasadas de tiempo.** Para cada válvula de `open_valves` que no se esté ya
   cerrando: si `now − started_at > (ends_at − started_at) + 1 min`, el temporizador de cierre no
   ha actuado. Se cierra por el camino normal (con reintentos, §6), se emite
   `irrigation_scheduler_valve_overrun` y se notifica (§7.2).
2. **`switch` configuradas encendidas a mano.** Una `switch` asignada a una válvula de alguna zona,
   en estado `on`, que no está en `open_valves` ni abriéndose ni cerrándose:
   - se cuenta desde su último paso a `on` (`last_changed` del estado);
   - si supera su `duration_min` + 1 min, se apaga (con reintentos, §6), se emite
     `irrigation_scheduler_valve_overrun` con `manual: true` y se notifica (§7.2);
   - no ocupa hueco de simultaneidad: la integración no la gestiona, solo la vigila;
   - se publica en el snapshot como `manual_on: [{entity_id, zone_id, since}]` para el panel.
3. El margen de 1 min evita adelantarse al temporizador normal cuando coincide con el latido.

Límites conocidos:

- Con HA parado nadie puede apagar nada; al arrancar actúa §5.2.
- `last_changed` se reinicia al arrancar HA: una `switch` encendida a mano antes de un reinicio
  empieza a contar desde el arranque.

## 6. Fallos de válvula

- Cada `turn_on` o `turn_off` se verifica leyendo el estado resultante de la `switch`.
- Si la `switch` no cambia o está `unavailable`, se hacen **3 reintentos**.
- Si falla al **encender**, el trabajo se descarta, se emite el evento `irrigation_scheduler_valve_error`,
  se notifica (§7) y la cola sigue con la siguiente válvula.
- Si falla al **apagar**, se emite el mismo evento, con prioridad crítica, y se notifica (§7).
- **Sin agua.** Si el `supply_sensor` de la válvula pasa de `off` a `on` con la válvula abierta,
  encendiéndose o encendida a mano, se cierra como ⏸ (§4) y la cola sigue. También se cierra si
  se abre con el sensor ya en `on`. Detalle: `docs/alerts/spec.md` §10.

## 7. Notificaciones push

### 7.1 Configuración

- `notify_targets` (global): lista de servicios `notify.mobile_app_*`. Admite varios teléfonos.
- El selector solo ofrece servicios de la app móvil de HA.
- Si la lista está vacía, no se envían notificaciones; los eventos HA se emiten igualmente.

### 7.2 Eventos notificados

| Evento | Cabecera | Prioridad por defecto |
|---|---|---|
| La válvula no responde al **apagar** (no cambia de estado o está `unavailable`) tras 3 reintentos | Error | Crítica (iOS `push.interruption-level: critical`; Android `priority: high`, `ttl: 0`) |
| La válvula no responde al **encender** (no cambia de estado o está `unavailable`) tras 3 reintentos | Error | Alta |
| El sensor de suministro de la válvula indica falta de agua; si regaba, se cierra | Error | Alta |
| Válvula apagada al arrancar HA por exceder su tiempo | Alerta | Alta |
| Válvula apagada por el latido por exceder su tiempo con HA en marcha (§5.3.1) | Alerta | Alta |
| `switch` encendida a mano apagada por el latido tras su `duration_min` (§5.3.2) | Alerta | Alta |
| Sensor de una zona en `unavailable` o `unknown` | Alerta | Normal |
| Omisión por lluvia: un push por lote con las zonas que abren episodio (`05-rain-skip.md` §8.19, §8.20) | Info | Normal |
| Fuente de lluvia no disponible (`05-rain-skip.md` §6) | Alerta | Normal |
| Encendido y apagado de cada válvula configurada (solo push) | Info | Normal |

La prioridad de cada tipo se cambia en Ajustes → «Errores y avisos». Textos y cabeceras: `docs/alerts/spec.md` §0.5.
Cada notificación incluye la zona, la válvula o el sensor y la hora; si hace falta, qué debe hacer el usuario.
Cada caso también se emite como evento HA `irrigation_scheduler_*`, para usarlo en automatizaciones.
