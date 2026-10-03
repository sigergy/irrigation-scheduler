# Envío de avisos sin espera y horario silencioso

> Estado: **diseño aprobado** · Última actualización: 2026-10-03
> Rutas de código relativas a `custom_components/irrigation_scheduler/`.
> Relacionada: [`../alerts/cast-notifies/spec.md`](../alerts/cast-notifies/spec.md) (canal de voz,
> se apoya en la parte A de esta spec).

Dos piezas independientes, implementadas en este orden:

- **A. Envío sin espera.** El motor nunca espera a que salga una notificación.
- **B. Horario silencioso.** Una franja horaria en la que no se pueden configurar bloques de
  riego, y en la que el riego que caiga por otras vías se aplaza a su fin.

El horario silencioso **no silencia notificaciones**: push y voz salen a cualquier hora.

---

## A. Envío sin espera

### A.1 Problema

Hoy el motor espera (`await`) al push en tres caminos:

| Camino | Dónde | Efecto |
|---|---|---|
| `Incidents.alert()` | `engine/incidents.py:71-79` | Lo llama el manager desde arranque, latido, sin agua, sensores y lluvia. |
| `Incidents.push_switched()` | `engine/incidents.py:117-124` | Push de encendido/apagado. |
| `Incidents.push_rain_skipped()` | `engine/incidents.py:142-144` | Push por lote de lluvia. |

Y `async_push` envía a los móviles uno tras otro con `blocking=True`
(`adapters/notify.py:135-140`). Consecuencias:

- Un bloque espera a los push de lluvia antes de encolar sus válvulas: `_async_block_fired`
  llama a `_async_evaluate_lot` (`engine/manager.py:254-256`) y este espera los push
  (`engine/manager.py:383-402`) antes del encolado (`engine/manager.py:259-264`).
- Al arrancar HA, `overrun_restart` y `turn_off_failed` se esperan con el lock del manager
  tomado (`engine/manager.py:152-167`).
- Un móvil lento retrasa a los demás.

### A.2 Diseño

1. **Componer al instante.** Cada camino de A.1 resuelve en el momento destinos, prioridad,
   título y texto, incluida la hora (`{time}`). Hoy la hora se calcula dentro del envío
   (`adapters/notify.py:131`); pasa a calcularse antes de lanzar la tarea.
2. **Lanzar y volver.** `Incidents` lanza el envío con `hass.async_create_background_task` y
   guarda la tarea en un conjunto propio hasta que termina. Es el mismo patrón que
   `IrrigationManager._spawn` (`engine/manager.py:104-108`).
3. **Sin cambios en lo inmediato.** La entidad `event` y el evento de bus siguen saliendo en el
   momento, dentro de `alert()`, como hoy.
4. **Canales en paralelo.** La tarea ejecuta `async_notify`, que lanza cada canal con
   `asyncio.gather(..., return_exceptions=True)`. En esta spec solo hay un canal: push. La spec
   de voz añade el segundo sin tocar el motor.
5. **Canal push.**
   - Envía a todos los destinos en paralelo.
   - Cada llamada mantiene `blocking=True` para capturar y registrar el error como hoy
     (`adapters/notify.py:139-140`).
   - Cada llamada tiene un límite de **30 s** (`asyncio.timeout`). Al vencer se registra un error.
   - **Orden por destino:** un `asyncio.Lock` por destino. Dos avisos al mismo móvil salen en el
     orden en que se emitieron (encendida antes que apagada). Solo espera la tarea de envío,
     nunca el motor.
6. **Descarga y recarga.** Los envíos en curso no se cancelan: un «no se apaga» no debe perderse
   por recargar la integración. HA cancela las tareas en segundo plano al detenerse.

### A.3 Lo que no cambia

- Textos, prioridades, destinos por alerta y datos de push (`adapters/notify.py:18-90`).
- `push_targets` y `alert_priority` (`domain/alerts.py:76-88`).
- Los tests existentes ya esperan a las tareas en segundo plano
  (`async_block_till_done(wait_background_tasks=True)`, `engine/tests/conftest.py:71`).

---

## B. Horario silencioso

### B.1 Modelo

`Settings` (`domain/model.py:121`) gana:

| Campo | Tipo | Defecto | Significado |
|---|---|---|---|
| `quiet_start` | `str \| None` | `None` | Inicio de la franja, `"HH:MM"`. |
| `quiet_end` | `str \| None` | `None` | Fin de la franja, `"HH:MM"`. |

- Los dos `None` = desactivado. Es el defecto: las instalaciones existentes no cambian y no hace
  falta migración.
- La franja es `[inicio, fin)` en hora local, todos los días. Puede cruzar medianoche
  (23:00–07:00).
- En los días de cambio de hora se usa la hora de reloj, sin corrección.

`RuntimeState` (`domain/runtime.py`) gana `held_until: datetime | None`, persistido, con
defecto `None` al cargar un runtime antiguo. Ver B.4.

### B.2 Bloques en conflicto

Un bloque de una zona ocupa desde su hora de inicio hasta que termina su última válvula.

- **Válvulas que cuentan:** todas las que tienen esa hora en `start_times`, **también las
  desactivadas**. Si no, reactivar una con ▶ (`engine/manager.py:764-768`) alargaría el bloque
  sin validar.
- **Duración:** se simula con el `max_simultaneous` de la zona y sin límite global, con las
  mismas reglas que la cola. Se reutiliza `estimate_batch_ends` (`domain/runtime.py:194-233`)
  sobre un `RuntimeState` vacío con los trabajos del bloque encolados.
- **Conflicto:** el intervalo del bloque `[inicio, fin)` se solapa con la franja, contando el
  cruce de medianoche en los dos sentidos. Tocar los extremos no es conflicto: un bloque que
  acaba a las 23:00 o empieza a las 07:00 es válido.
- **No cuentan:** el límite global, las otras zonas, los días de la zona, ni si la zona o la
  válvula están desactivadas.

La función vive en `domain/schedule.py`, sin dependencias de HA, y la usan V15 y V17.

### B.3 Validación

Reglas nuevas en `domain/validation.py`:

| Regla | Función | Ruta del error | Cuándo |
|---|---|---|---|
| V15 | `validate_zone` | `("start_times", i)` | El bloque `i` está en conflicto (B.2). |
| V16 | `validate_settings` | `("quiet_start",)` o `("quiet_end",)` | Formato distinto de `HH:MM`, solo uno de los dos relleno, o inicio igual a fin. |
| V17 | `validate_settings` | `("quiet_hours", zone_id, "HH:MM")` | Por cada bloque existente en conflicto con la franja nueva. |

- `validate_zone` ya recibe la `Config` (`domain/validation.py:36`); de ahí lee la franja.
- `validate_settings` pasa a recibir también la `Config` para V17. Solo se llama desde
  `engine/manager.py:640`.
- El esquema de la API (`api/schemas.py:49-53`) admite `quiet_start` y `quiet_end`
  (`vol.Any(None, str)`).
- Al cargar no se valida: una configuración guardada antes no deja de funcionar.

### B.4 Ejecución: aplazar hasta el fin de la franja

**Puerta en el despacho.** `_async_dispatch_locked` (`engine/manager.py:418-436`) no arranca
ningún trabajo de la cola si la hora actual está dentro de la franja. Afecta a todos los
orígenes que pasan por la cola:

- bloques programados, incluidos los perdidos al arrancar HA (`engine/manager.py:171-181`) y
  las colas retrasadas por límites;
- «Regar zona ahora» y «Regar válvula ahora» (`engine/manager.py:696-717`).

Al cerrar la puerta con trabajos pendientes, se fija `runtime.held_until` al próximo fin de la
franja y se programa un temporizador (`async_track_point_in_time`) a esa hora.

**Lo que no se toca:**

- Una válvula ya abierta cuando empieza la franja termina su riego.
- Un encendido externo de la switch no pasa por la cola: no se puede impedir. La vigilancia de
  exceso manual sigue igual.

**Al llegar el fin de la franja** (o al arrancar HA con `held_until` ya pasado):

1. Se forma un lote con las zonas que tienen trabajos programados (`ORIGIN_SCHEDULED`) en la
   cola y necesitan lluvia (`_needs_rain`, `engine/manager.py:341-343`). Cada zona entra como
   bloque `(zone_id, quiet_end, hoy)`.
2. El lote se decide con `_async_evaluate_lot` (`engine/manager.py:364-402`), igual que un
   bloque sin decisión a su hora. Recalcula la lluvia y aplica la misma regla que el
   binary_sensor «Se omitirá el próximo riego» (`binary_sensor.py:47-49`), en ese momento.
   Reutiliza sin cambios el evento `rain_skipped` (`start_time` = fin de la franja), el push
   por episodio (`engine/rain_control.py:150-162`, [`docs/features/rain-skip/spec.md`](../rain-skip/spec.md) §8.19) y la
   alerta de fuentes caídas.
   - No se lee `zone_rain_outlook`: describe el próximo bloque de la zona, no el riego
     aplazado, y puede llevar la decisión fijada de otro bloque
     (`engine/rain_control.py:191-209`).
3. Con el lock, se consume la decisión de cada bloque del lote (`rain_decisions.pop`):
   - **Omitir:** se quitan de la cola los trabajos programados de esa zona.
   - **Regar, zona sin «Omitir por lluvia» o sin fuentes de lluvia:** riega.
4. Los trabajos manuales riegan siempre, sin mirar la lluvia: la orden manual manda
   ([`docs/features/rain-skip/spec.md`](../rain-skip/spec.md):65-66).
5. Se borra `held_until` y se despacha la cola con las reglas normales de zona y global.

**Cambios de ajustes.** Al guardar los ajustes o al arrancar HA se recalcula el temporizador. Si
se desactiva la franja con trabajos retenidos, se ejecuta el paso anterior en ese momento.

### B.5 Panel

- **Ajustes.** Tarjeta nueva «Horario silencioso»: interruptor, «Desde» y «Hasta». Ayuda: «No se
  pueden crear bloques de riego en esta franja. Lo que caiga dentro (HA caído, colas, riego
  manual) espera a que termine.» Errores V16 en su campo. Errores V17 como lista «Choca con:
  Césped 22:30, Huerto 06:00»; el panel compone los nombres a partir de `zone_id` y la hora de
  la ruta.
- **Editor de zona.** Con la franja activa, bajo las horas: «Horario silencioso: 23:00–07:00».
  V15 en el chip de la hora afectada: «El bloque se solapa con el horario silencioso».
- **Estado de la zona.** Con la cola retenida, el snapshot (`api/snapshot.py:18`) envía
  `held_until` y no estima el fin del lote: `estimate_batch_ends` simularía la cola como si
  arrancase ya (`domain/runtime.py:194-233`). Las zonas con trabajos en cola muestran «Aplazado hasta 07:00» en lugar del fin
  estimado del lote.
- **Orden manual dentro de la franja.** El panel avisa: «Se regará a las 07:00 (horario
  silencioso)».

---

## C. Verificación

Según la práctica del proyecto, las features no llevan tests nuevos. Gates de cada parte:

- `uvx ruff check custom_components`
- `py -3.14 -m compileall -q custom_components`
- `npm run lint` y `npm run build` en `frontend/`
- CI (`.github/workflows/tests.yml`): los tests de caracterización existentes deben seguir en
  verde.

La prueba funcional la hace el usuario en su HA.
