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
- El bloque genera **un trabajo por cada válvula que le toca** según su frecuencia
  (`00-overview.md` §4.2), en el orden en que están configuradas las válvulas.
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
| Habilitar/deshabilitar zona | Una zona deshabilitada no dispara bloques programados | — |
| Regar zona ahora | Encola un trabajo por **cada** válvula de la zona, sin aplicar la frecuencia | Simultaneidad de zona + global |
| Regar válvula ahora | Abre una válvula durante X min (por defecto, su `duration_min`) | Global |
| Parar (zona) | Apaga las válvulas abiertas de la zona y vacía su cola | — |
| Parar todo | Apaga todas las válvulas gestionadas y vacía todas las colas | — |

## 5. Persistencia y reinicio de HA

### 5.1 Estado de runtime persistido

Se guarda en un `Store` aparte de la configuración y se escribe en cada cambio. Contiene:

- las válvulas abiertas: `entity_id`, `zone_id`, `started_at`, `ends_at`;
- las colas pendientes, por zona y global, en su orden;
- estado del episodio de lluvia (abierto o cerrado; `05-rain-skip.md` §7.1);
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

## 6. Fallos de válvula

- Cada `turn_on` o `turn_off` se verifica leyendo el estado resultante de la `switch`.
- Si la `switch` no cambia o está `unavailable`, se hacen **3 reintentos**.
- Si falla al **encender**, el trabajo se descarta, se emite el evento `irrigation_scheduler_valve_error`,
  se notifica (§7) y la cola sigue con la siguiente válvula.
- Si falla al **apagar**, se emite el mismo evento, con prioridad crítica, y se notifica (§7).

## 7. Notificaciones push

### 7.1 Configuración

- `notify_targets` (global): lista de servicios `notify.mobile_app_*`. Admite varios teléfonos.
- El selector solo ofrece servicios de la app móvil de HA.
- Si la lista está vacía, no se envían notificaciones; los eventos HA se emiten igualmente.

### 7.2 Eventos notificados

| Evento | Prioridad |
|---|---|
| La válvula no responde al **apagar** (no cambia de estado o está `unavailable`) tras 3 reintentos | Crítica (iOS `push.interruption-level: critical`; Android `priority: high`, `ttl: 0`) |
| La válvula no responde al **encender** (no cambia de estado o está `unavailable`) tras 3 reintentos | Alta |
| Válvula apagada al arrancar HA por exceder su tiempo | Alta |
| Sensor de una zona en `unavailable` o `unknown` | Normal |
| Omisión por lluvia: un único push por episodio de lluvia (`05-rain-skip.md` §7.1) | Normal |
| Fuente de lluvia no disponible (`05-rain-skip.md` §6) | Normal |

Cada notificación incluye la zona, la válvula o el sensor, la hora y la acción tomada.
Cada caso también se emite como evento HA `irrigation_scheduler_*`, para usarlo en automatizaciones.
