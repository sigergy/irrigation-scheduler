# 3. Tiempo restante por válvula

> Estado: **en diseño** · 2026-10-06
> Usada por: [04-resume-after-restart](../04-resume-after-restart/spec.md).

## 1. Objetivo

Guardar y mostrar cuánto le falta a cada válvula para terminar su riego. Si el riego se corta
por un reinicio ordenado ([02-shutdown-close](../02-shutdown-close/spec.md)), el tiempo queda en
pausa.

## 2. Decisiones

Tomadas con el usuario el 2026-10-06.

Propuesta del usuario: el tiempo que le falta a cada válvula se pausa al cerrar por reinicio y
se retoma al volver. Así el tiempo siempre corresponde a un bloque de riego.

- **Fuente de verdad: el runtime persistido.** Ya guarda `started_at` y `ends_at` de cada válvula
  abierta (`domain/runtime.py:29-43`). Se añade el estado «pausada» con los segundos restantes.
  HA restaura el estado de las entidades tarde y sin garantías, así que la entidad no se usa
  para decidir nada.
- **Entidad: solo muestra el dato.**
  - Regando: sensor de tipo hora con el fin previsto («termina a las 10:20»). El panel calcula
    la cuenta atrás. No se actualiza cada segundo, para no llenar el histórico (recorder).
  - En pausa: muestra los minutos que faltan.

## 3. Puntos abiertos

Se deciden en el brainstorming de este cambio:

- Nombre de la entidad y su texto en el panel.
