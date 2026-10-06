# 8. Señales finas por zona y deltas por WebSocket

## Propuesta original

Señales `SIGNAL_STATE_{zone_id}`: cada entidad se suscribe solo a su zona. El WebSocket manda
deltas en vez del snapshot entero.

## Situación actual

- Señales globales en `const.py:73-77`: `SIGNAL_STATE`, `SIGNAL_CONFIG`, `SIGNAL_ZONE_ADDED`,
  `SIGNAL_ALERT`.
- Cada entidad se suscribe a `SIGNAL_STATE` y `SIGNAL_CONFIG` y reescribe su estado en cada
  envío: `entities/base.py:21-29`.
- El WebSocket manda el snapshot completo en cada señal: `api/websocket.py:254-262`. Se
  resuelve el manager en cada envío, así que sobrevive a recargar la entry
  (`api/websocket.py:255`).
- Emisores de `SIGNAL_STATE`: `engine/manager.py:361`, `:665`, `:676`;
  `engine/triggers.py:126`, `:171`.

## Análisis

- Escala doméstica: pocas zonas y decenas de entidades. Reescribir todas en cada cambio cuesta
  poco.
- Los deltas obligan a versionar y reconciliar el estado en el front (`frontend/src/store.ts`),
  con riesgo de desincronización tras reconexión o recarga.
- El snapshot completo es simple y robusto: cada mensaje es la verdad entera.
- Las señales por zona multiplican los puntos de emisión. Un olvido deja una entidad obsoleta
  sin error visible.

## Veredicto

**No compensa.** Solo reconsiderar ante un problema de rendimiento **medido**: latencia del
WS, carga del bus de estados o escrituras del recorder.

## Si algún día se hace

1. Medir antes: tamaño del snapshot y frecuencia de `SIGNAL_STATE`.
2. Primer paso barato: coalescencia (*debounce*) de `forward` en `api/websocket.py`, sin deltas.
3. Señales por zona solo para entidades de zona; mantener la global para las de instalación.
