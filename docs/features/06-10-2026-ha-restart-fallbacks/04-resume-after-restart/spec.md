# 4. Retomar el riego tras un reinicio

> Estado: **implementado** · 2026-10-06
> Depende de: [02-shutdown-close](../02-shutdown-close/spec.md),
> [03-remaining-time](../03-remaining-time/spec.md).
> Plan: [`../plans/04-resume-after-restart.md`](../plans/04-resume-after-restart.md).
> Diagrama del flujo, con una vista por ejemplo: [`resume-flow.html`](resume-flow.html)
> (fuente: [`resume-flow.json`](resume-flow.json)).

## 1. Objetivo

Al volver HA tras un reinicio ordenado, decidir si una válvula interrumpida
([03-remaining-time](../03-remaining-time/spec.md)) completa el tiempo que le faltaba o se da por
terminada.

## 2. Decisiones

Tomadas con el usuario el 2026-10-06.

Se retoma solo si se cumplen las dos condiciones:

1. HA vuelve en **menos de 60 min** desde la interrupción. Constante fija, sin ajuste en el panel.
2. **No ha llegado el siguiente bloque** de esa válvula (§3).

Al retomar, el resto entra en la cola de su zona como un trabajo normal. Respeta simultaneidad y
lluvia, como los bloques perdidos al arrancar
([`valves-execution/spec.md`](../../valves-execution/spec.md) §5.2.4).

Si no se cumplen, el riego se da por terminado y llega un aviso informativo:
«{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se retoma.»

## 3. Decisiones del brainstorming

Tomadas con el usuario el 2026-10-06.

| Punto | Decisión |
|---|---|
| Origen | Se retoman igual el riego programado y el manual (panel o servicio). Una `switch` encendida fuera de la integración nunca queda interrumpida (03 §4.3) |
| Zona o válvula deshabilitada | No se retoma, con aviso |
| Horario silencioso | Si al retomar es hora de silencio, no se retoma, con aviso. No se retiene hasta el fin de la franja |
| `switch` aún `unavailable` (Zigbee tarda) | Se espera a que vuelva, dentro de los 60 min. Si no vuelve a tiempo, no se retoma, con aviso |
| Bloque siguiente | Solo cuenta un bloque **que incluya esa válvula**, con hora entre la interrupción y el fin previsto del resto (T + R, §4.3). Un bloque de la zona sin esa válvula no impide retomar: la cola y la simultaneidad de la zona ordenan los dos riegos, con el mecanismo que ya existe |
| Lluvia | Solo el riego programado, como al terminar el horario silencioso. Si toca omitir, sale el push `rain_skipped` de siempre, sin aviso propio. El manual riega siempre |
| Aviso «no se retoma» | Tipo de alerta propio, solo push, con destinos y prioridad propios en el panel de alertas. Sin entidad event ni histórico |
| Descartes mientras espera | Pausar o detener la válvula, su zona o todo; un riego manual nuevo de esa válvula; borrar la zona o quitar la válvula. Sin aviso. En el panel, «Interrumpida» muestra el botón Pausar |

## 4. Diseño

### 4.1 Al arrancar

En `_async_recover` (`engine/manager.py:241`), el paso 0 de la spec 03 (`drop_interrupted()` y un
log) se sustituye. Para cada válvula interrumpida:

- si `now ≥ interrupted_at + 60 min`: no se retoma, con aviso (§4.6);
- si no: empieza a vigilarse (§4.2).

Va antes de los inicios perdidos, como el paso 0 actual.

### 4.2 Espera de la `switch`: `ResumeWatch`

Módulo nuevo `engine/resume.py`, con la misma forma que `CloseRetry` (`engine/close_retry.py:41`):

- Por válvula: un listener de estado de su `switch` y un temporizador que vence en
  `interrupted_at + 60 min`.
- Si la `switch` ya está disponible al empezar a vigilar (ni `unavailable` ni `unknown`), avisa
  enseguida.
- Avisa al manager con «`switch` lista» o «plazo vencido». No toma el lock ni toca `ValveSlots`.
- Se cancela por válvula (descarte, retomar) y entero (descarga de la entry, parada de HA).

### 4.3 Decisión en T

T es el momento en que la `switch` está lista; R, los minutos que faltaban. Con el lock, se retoma
solo si se cumple todo:

1. la zona y la válvula siguen existiendo, y las dos están habilitadas;
2. T no cae en horario silencioso;
3. `T < interrupted_at + 60 min`;
4. ningún bloque que incluya esa válvula tiene hora en (`interrupted_at`, T + R]. Cuentan los que
   dispararían por configuración: zona habilitada, día activo y modo manual (`block_runs` y
   `valves_for_block`, `domain/schedule.py:15-23`). La omisión por lluvia no cuenta: el bloque
   llegó igual. La búsqueda reutiliza la de `missed_blocks` (`domain/schedule.py:65`), filtrada
   por válvula.

Si falla alguna: no se retoma, con aviso (§4.6). También vale para el plazo vencido de §4.2.

### 4.4 Retomar

- Un mutador nuevo de `ValveSlots`, con el lock como todos (`engine/slots.py:14-32`): saca la
  válvula de `interrupted` y encola un trabajo con R × 60 s y su `origin`. Es un trabajo normal:
  respeta el límite de la zona y el global (`domain/runtime.py:150-182`).
- **Programado** en una zona que necesita lluvia: se evalúa como al terminar la franja
  (`_async_quiet_end`, `engine/manager.py:725`). Si toca omitir, se quita de la cola y sale el
  push `rain_skipped` de siempre.
- **Manual**: no mira la lluvia.
- Log `info`: «riego interrumpido retomado, faltan N min».

### 4.5 Descartes sin aviso

Mientras espera, la interrupción se descarta, sin aviso, si:

- se pausa o se detiene la válvula, su zona o todo (`_async_pause`, `engine/manager.py:1084-1094`);
- se lanza un riego manual de esa válvula (`async_run_valve`, `async_run_zone`,
  `engine/manager.py:1044-1082`): manda la orden nueva;
- se borra la zona o se quita la válvula (`async_delete_zone`, `async_save_zone`).

Un bloque programado que encola esa válvula no es un descarte sin aviso: es el «bloque siguiente»
de §4.3 y lleva aviso.

### 4.6 Aviso `restart_not_resumed`

- Tipo nuevo del catálogo (`domain/alerts.py`): nivel válvula, severidad `info`, prioridad
  `normal`, `push_only`. Igual que `valve_switched` (`domain/alerts.py:48`), con sus propios
  destinos, prioridad y voz en el panel de alertas (`frontend/src/alerts.ts:34`).
- Texto (`adapters/notify.py`):
  - ES: «{zone} · {entity}: riego interrumpido por reinicio de HA. Faltaron {minutes} min. No se
    retoma.»
  - EN: «{zone} · {entity}: irrigation interrupted by HA restart. {minutes} min were left. Not
    resumed.»
- `{minutes}` es `remaining_min` de la spec 03.

### 4.7 Panel

- El estado `interrupted` muestra el botón Pausar (`frontend/src/shared/valve-status.ts:121-123`),
  que llama a `pause_valve` y descarta la interrupción (§4.5).
- El texto «Interrumpida · faltan N min» y la entidad «Fin riego» no cambian (03 §4.4-4.5).

### 4.8 Reinicios y recargas

- Si HA vuelve a parar mientras espera, la interrupción sigue guardada con su `interrupted_at`
  original: los 60 min no se reinician.
- Al descargar la entry se cancela `ResumeWatch`. Al volver a cargarla, `_async_recover` vuelve a
  vigilar lo que siga interrumpido.

## 5. Ejemplos

Riego de la válvula A, de 10:00 a 10:20, reinicio a las 10:15: R = 5 min.

| Caso | Resultado |
|---|---|
| HA y la `switch` vuelven a las 10:21 | Se retoma: 5 min más |
| HA vuelve a las 12:00 | Más de 60 min: no se retoma, con aviso |
| HA vuelve a las 10:18, la `switch` no vuelve antes de las 11:15 | Plazo vencido: no se retoma, con aviso |
| `switch` lista a las 10:21, bloque con A a las 10:25 | 10:25 ≤ 10:26 (T + R): no se retoma, con aviso. Manda el bloque |
| `switch` lista a las 10:21, bloque a las 10:25 solo con B | Se retoma A. La cola de la zona ordena A y B según su simultaneidad |

## 6. Límites conocidos

- Los bloques perdidos al arrancar no esperan a la `switch`: si Zigbee no ha vuelto, fallan con
  `turn_on_failed`, como hasta ahora. Queda fuera de este cambio.
- La cola no quita duplicados (`domain/runtime.py:127-133`). Un bloque con la válvula que llega
  después de T + R, con el resto aún en cola por la simultaneidad, la encola otra vez.
