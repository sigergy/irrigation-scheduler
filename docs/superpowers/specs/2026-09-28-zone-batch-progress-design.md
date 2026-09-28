# Progreso del lote de zona — diseño

Fecha: 2026-09-28.

## Problema

La barra y el «quedan X» de la fila de zona copian los de **una** válvula: la primera abierta en
el orden de la configuración (`frontend/src/shared/zone-status.ts:50-54`). Con varias válvulas en
secuencia la barra se reinicia en cada una; en paralelo sigue a una sola y salta al cerrarse. Las
válvulas en cola no cuentan.

## Objetivo

La fila de zona muestra el progreso del **lote**: válvulas abiertas y en cola de la zona, y el
tiempo total que le falta. Texto: «Lote · quedan 12:30».

## Decisiones

1. El inicio del lote lo guarda el backend y se persiste (sobrevive a recargas y reinicios).
2. El fin estimado lo calcula el backend simulando la cola con las mismas reglas de zona, global
   y FIFO (`RuntimeState.startable_jobs`).
3. Texto de la fila: solo el restante del lote, sin nombres de válvula.

## Backend

- `RuntimeState.batch_started: dict[str, datetime]` (`zone_id` → inicio). Se persiste; `{}` por
  defecto al leer un runtime antiguo.
- **Alta:** al abrir una válvula (`_mark_open`), `setdefault(zone_id, started)`. El lote empieza
  con la primera apertura, no al encolar.
- **Baja:** en cada `_async_persist`, se quitan las zonas sin válvulas abiertas, abriéndose ni
  en cola, y las zonas borradas.
- `estimate_batch_ends(...)` (función pura en `runtime.py`): parte de las válvulas abiertas (una
  pasada de tiempo termina «ahora»); las que se están abriendo ocupan hueco con el
  `duration_min` configurado; arranca por pasos lo que `startable_jobs` permite y avanza al
  siguiente `ends_at`. Si queda cola y nada puede arrancar, corta. Devuelve el último `ends_at`
  de cada zona.
- El snapshot añade a cada zona `batch_started_at` y `batch_ends_at` (ISO o `null`); solo tienen
  valor si la zona tiene lote.
- La estimación ignora los segundos de apertura de cada válvula; cada snapshot la recalcula.
  Un bloque nuevo a mitad del lote alarga el fin y la barra retrocede: el lote es más largo.

## Frontend

- `Zone` añade `batch_started_at` y `batch_ends_at`.
- `progressBar` y `remainingSeconds` aceptan `{ started_at, ends_at }`: sirven para válvula y lote.
- Tarjeta y lista del panel: con lote, barra del lote y «Lote · quedan X». Sin lote (válvula
  encendida a mano) se mantiene el comportamiento anterior.
- Zona solo en cola (sin válvula abierta): sin barra.
- Las filas de válvula no cambian.
- `i18n`: clave `batch` («Lote» / «Batch»).

## Validación

`uvx ruff check custom_components`, `py -3.14 -m compileall -q custom_components`,
`npm run lint` y `npm run build` en `frontend/`. Sin tests automatizados (criterio del proyecto);
validación funcional en HA.
