# 02 · Frontend — panel estilo Chronos

> Estado: **decisiones cerradas** (D16) · Fase 3 · Última actualización: 2026-09-28
> Depende de: `00-overview.md` y `01-backend.md` (API WebSocket).

## 1. Decisiones cerradas que afectan a la UI

- Panel lateral propio (D7).
- Días por zona, como un único selector `L M X J V S D` (D2).
- El selector de entidad de válvula **oculta** las `switch` ya asignadas a otra válvula (D11, V7).
- Selector múltiple de `notify.mobile_app_*` en los ajustes globales (D13).
- `auto` aparece deshabilitado si la zona no tiene método de cálculo (V8).
- Interruptor «omitir por lluvia» en el editor de zona (D20).
- Ajustes de lluvia en los ajustes globales: `rain_sensor`, `weather_entity`, horas y umbrales;
  los campos de horas y umbral se validan con V10 y V11. Vienen rellenos con sus valores por
  defecto: lluvia pasada 24 h y 5 mm; lluvia prevista 12 h y 5 mm.
- Si falla V3 (frecuencia mayor que el nº de bloques), se rechaza el guardado y se marcan las
  válvulas afectadas.

## 2. Diseño (D16, aprobado el 2026-09-28)

- Tecnología: Lit, como los paneles nativos de HA.
- Vistas:
  - **Lista de zonas:** tarjetas con el estado en vivo (regando, en cola, próximo riego) y un
    indicador global de lluvia (mm pasados y previstos).
  - **Editor de zona:** nombre, modo, días (chips), bloques de inicio, simultaneidad y lista
    ordenada de válvulas con tiempo y frecuencia.
  - **Ajustes globales:** límite global, destinos de notificación y lluvia.
- Textos en español e inglés.
