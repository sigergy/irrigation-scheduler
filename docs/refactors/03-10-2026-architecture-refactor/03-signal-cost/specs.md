# 3. Coste de cada señal: entidades, plan de zona y snapshot

## Propuesta original

`ws_subscribe.forward` reconstruye el snapshot entero en cada señal y para cada suscriptor.
Propuesta inicial: agrupar las señales del mismo ciclo, un difusor compartido entre
suscriptores y caché de las consultas a registros. Revisada contra el código: el WebSocket no
es el punto caliente y la caché es dañina. Este apartado recoge la versión corregida.

## Situación actual

- `forward` conecta `SIGNAL_STATE` y `SIGNAL_CONFIG` por suscriptor y llama a
  `build_snapshot(current)` en cada señal: `api/websocket.py:254-260`.
- El front ya comparte una suscripción por conexión entre panel y tarjetas:
  `frontend/src/store.ts:5`, `:24`, `:50-59`. N suscriptores = navegadores abiertos, no tarjetas.
- Cada entidad se repinta en cada `SIGNAL_STATE` y `SIGNAL_CONFIG`: `entities/base.py:27-41`
  (tras los pasos 2-3, vía `_async_handle_update`).
- El plan de zona se calcula varias veces por señal y zona:
  - `ZoneRainSkipSensor` llamaba a `zone_rain_outlook` dos veces por escritura
    (`binary_sensor.py:48` y `:53` en `9a866b0`); tras los pasos 2-3, una `zone_plan` en
    `_update_attrs`: `binary_sensor.py:49`.
  - El sensor de próximo riego, otra: `sensor.py:110`.
  - El snapshot, otra por suscriptor: `api/snapshot.py:31`.
  - `zone_rain_outlook` y `zone_next_run` calculaban el plan entero y descartaban la mitad
    (`engine/manager.py:911-915` en `9a866b0`); tras el paso 3, un solo `zone_plan`:
    `engine/manager.py:911-913` → `engine/status.py:34-44` → `engine/rain_control.py:196`.
- Lo caro del snapshot es la simulación de la cola (`domain/runtime.py:205-217`) y
  `zone_plan` por zona. `registry_id` es una búsqueda en diccionario
  (`adapters/registry.py:64-66`).
- Varios emisores de una misma operación están separados por `await`; por ejemplo,
  `async_save_zone`: `_async_persist_locked` emite `SIGNAL_STATE` (`engine/manager.py:675`),
  luego `await self._async_dispatch_locked()` y al final `SIGNAL_CONFIG` (`:738`).

## Análisis

- Agrupar con `call_soon` solo junta señales del mismo ciclo del bucle. Si los `await` entre
  emisores ceden el bucle, no se juntan. Un temporizador juntaría más, pero retrasa el panel
  (p. ej. «Cerrando» al pausar).
- Diferir `forward` cambia el momento de lectura: hoy se lee en el punto que eligió el emisor
  (`engine/manager.py:670-675`, «avisa al panel ya»); diferido, en el siguiente punto en que
  ceda cualquier corrutina. `build_snapshot` sigue siendo síncrono sin `await`
  (`api/snapshot.py:19`), pero el estado intermedio leído cambia.
- Sin verificar: que `async_dispatcher_send` ejecute los `@callback` en el acto en HA 2026.9.
  Si ya los difiere, el análisis del punto anterior cambia.
- Cachear `history_entities` y `registry_id` con `SIGNAL_CONFIG` es dañino: `registry_id`
  devuelve `None` si la entidad aún no existe (`adapters/registry.py:65`) y las entidades se
  crean después de la señal de alta (`event.py:48`). La caché congelaría el `None` y la
  tarjeta de histórico perdería esas entidades.

## Veredicto

**Sí, por partes y midiendo antes.** El ahorro real está en las entidades y en el plan de
zona, no en el WebSocket.

## Plan

1. **Medir.** Log `debug` temporal: llamadas a `forward` y a `async_write_ha_state` por
   operación, si caen en el mismo ciclo (`hass.loop.time()`), y tiempo de `build_snapshot` y
   de `zone_plan`.
2. **Entidades: calcular una vez por escritura.** La base conecta las señales a un
   `@callback` que rellena los `_attr_*` y luego llama a `async_write_ha_state()`.
   `ZoneRainSkipSensor` calcula el plan una vez, no dos.
3. **Manager: un método para el plan.** `zone_plan(zone_id)` devuelve el par completo;
   `zone_rain_outlook` y `zone_next_run` lo usan o desaparecen. Sin cachés que invalidar.
4. **WebSocket con `call_soon`**, solo si la medición muestra señales en el mismo ciclo:
   - `forward` programa un `flush` si no hay uno pendiente;
   - `flush` resuelve `loaded_manager(hass)` en cada envío (`api/websocket.py:255`);
   - el primer envío al suscribirse sigue siendo inmediato (`flush()` en `:269`);
   - `unsubscribe` cancela el envío pendiente.
5. **Difusor compartido entre suscriptores:** solo con varios dispositivos abiertos de forma
   habitual.
6. **Caché de consultas a registros:** descartada.
7. Gates: `ruff`, `pytest` en CI.

## Tests

- Caracterización en `entities/tests/` y `engine/tests/` para los pasos 2 y 3.
- Para el paso 4, nueva `api/tests/`: varias señales seguidas → un mensaje; cancelar la
  suscripción anula el envío pendiente.
- Las fixtures viven en el conftest común `custom_components/irrigation_scheduler/conftest.py`.

## Riesgos

- Desfase de un ciclo entre entidades (inmediatas) y panel (diferido) si se aplica el paso 4.
- El paso 2 toca la base de todas las entidades: un `_attr_*` sin rellenar deja una entidad
  obsoleta sin error visible.

## Relación con otros apartados

- Es el «primer paso barato» que el apartado 8 deja como alternativa a las señales finas y
  los deltas, ampliado a las entidades.
