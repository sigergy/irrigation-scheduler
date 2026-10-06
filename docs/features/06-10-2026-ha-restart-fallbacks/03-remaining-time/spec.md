# 3. Tiempo restante por válvula

> Estado: **implementado** · 2026-10-06
> Usada por: [04-resume-after-restart](../04-resume-after-restart/spec.md).
> Plan: [`../plans/03-remaining-time.md`](../plans/03-remaining-time.md).

## 1. Objetivo

Guardar y mostrar cuánto le falta a cada válvula para terminar su riego. Si el riego se corta
por un reinicio ordenado ([02-shutdown-close](../02-shutdown-close/spec.md)), la válvula queda
«interrumpida» con el tiempo que le faltaba.

## 2. Decisiones

Tomadas con el usuario el 2026-10-06.

Propuesta del usuario: el tiempo que le falta a cada válvula se pausa al cerrar por reinicio y
se retoma al volver. Así el tiempo siempre corresponde a un bloque de riego.

- **Fuente de verdad: el runtime persistido.** Ya guarda `started_at` y `ends_at` de cada válvula
  abierta (`domain/runtime.py:29-54`). Se añade la interrupción con los segundos restantes.
  HA restaura el estado de las entidades tarde y sin garantías, así que la entidad no se usa
  para decidir nada.
- **Entidad: solo muestra el dato.**
  - Regando: sensor de tipo hora con el fin previsto («termina a las 10:20»). El panel calcula
    la cuenta atrás. No se actualiza cada segundo, para no llenar el histórico (recorder).
  - Interrumpida: muestra los minutos que faltan.

## 3. Decisiones del brainstorming

Tomadas con el usuario el 2026-10-06.

| Punto | Decisión |
|---|---|
| Forma de la entidad | Un sensor de tipo hora por válvula. Regando: `ends_at`. Interrumpida: estado vacío y atributo `remaining_min` |
| Nombre | «Fin riego» («Irrigation end»), pareja de «Modo riego». entity_id propuesto `sensor.fin_riego_<válvula>` |
| Texto en el panel | «Interrumpida · faltan 5 min» («Interrupted · 5 min left»). No se usa «pausa»: el botón «Pausar» anula el riego (servicio `pause_valve`) |
| Apertura abortada al parar | Queda interrumpida con su duración completa. Hasta ahora ese trabajo se perdía |
| Arranque de HA sin la spec 04 | Se descartan las interrupciones con un log `info`: riego terminado, como hasta ahora. La 04 sustituye ese paso por su decisión |

## 4. Diseño

### 4.1 Runtime

- `InterruptedValve` (`domain/runtime.py`): `entity_id`, `zone_id`, `remaining_s`,
  `interrupted_at`, `origin`. Propiedad `remaining_min`: minutos redondeados hacia arriba.
- `RuntimeState.interrupted`: `entity_id → InterruptedValve`, persistido. Un runtime guardado
  antes de este cambio, sin la clave, se lee vacío.
- `interrupted_at` y `origin` no se usan aquí: los necesita la 04 (regla de los 60 min, manual o
  programado).

### 4.2 Mutadores de `ValveSlots`

Con el lock del manager, como todos (`engine/slots.py:14-31`, `engine/tests/test_lock.py`):

- `interrupt(entity_id, now)`: válvula en `open_valves`, no cerrándose y con tiempo por delante
  → sale de `open_valves` y queda interrumpida con `ends_at − now`. Si no cumple, no toca nada y
  devuelve `None`.
- `interrupt_job(job, now)`: apertura abortada → interrumpida con `job.duration_s`.
- `drop_interrupted()`: vacía las interrupciones y las devuelve.

### 4.3 Flujo

- **Al parar** (`async_close_on_stop`): cada `switch` cerrada pasa por `interrupt`; si no aplica
  (encendida a mano, externa, ya cerrándose o sin tiempo por delante) se libera con `closed`, como
  hasta ahora. Una válvula cerrándose ya terminaba: a su hora o por «Pausar».
- **Apertura en curso al parar** (`_async_open_job`): si el encendido no se confirma con HA parando
  y la apertura no estaba pausada, `interrupt_job`. Si se confirma, entra en `open_valves` y el
  cierre de parada la interrumpe.
- **Al arrancar** (`_async_recover`), primer paso: `drop_interrupted()` y un log `info` por
  válvula: «riego interrumpido por reinicio de HA, faltaban N min; no se retoma». Sustituido por
  [04-resume-after-restart](../04-resume-after-restart/spec.md) §4.1.

### 4.4 Entidad «Fin riego»

- `ValveEndSensor` (`sensor.py`), clave `valve_end`, `SensorDeviceClass.TIMESTAMP`, en el
  dispositivo de la `switch`, como «Modo riego». Se crea en el mismo `sync_valves`.
- Estado: `ends_at` si la válvula está en `open_valves`; si no, vacío.
- Interrumpida: atributo `remaining_min`.
- Se repinta con `SIGNAL_STATE`, que se envía al persistir: cambia solo al abrir, cerrar o
  interrumpir.
- Al quitar la válvula de la zona se borra del registro con «Modo riego» y «Alertas riego».

### 4.5 Panel

- Foto (`api/snapshot.py`): `interrupted: [{entity_id, zone_id, remaining_min}]`.
- Estado de válvula `interrupted` (`frontend/src/shared/valve-status.ts`): icono ⏸, texto
  «Interrumpida · faltan N min», sin botones.

## 5. Límites conocidos

- En vivo, «Interrumpida» solo se ve en el panel abierto mientras HA para. Después queda en el
  histórico de la entidad: el recorder escribe hasta stage 3.
- Una válvula encendida a mano no tiene `ends_at` en el runtime: su «Fin riego» queda vacío. El
  panel sí muestra su fin (`frontend/src/shared/valve-status.ts:75-80`).
- Una apertura que se confirma después de que la parada haya tomado el lock queda en
  `open_valves` sin interrumpir; al arrancar la trata §5.2 de
  [`valves-execution`](../../valves-execution/spec.md) por su `ends_at`.
