# Tarea 3: informe

Estado: DONE. Sin commit (paso 4 es del controlador).

## Cambios

- `docs/features/valves-execution/spec.md`
  - Nueva `### 5.1.1 Al parar HA` justo antes de `### 5.2` (texto del brief, tal cual).
  - Límites de §5.3: «En una parada ordenada se cierran antes (§5.1.1).» añadido (en dos líneas).
  - `> Última actualización:` ya era `2026-10-06`: sin cambio.
- `docs/features/06-10-2026-ha-restart-fallbacks/02-shutdown-close/spec.md`
  - Cabecera: `diseño aprobado` → `implementado`.
  - §2.4: frase « Lo añade este cambio: `async_close_on_stop` en `engine/manager.py`.» al final de la primera viñeta (la de «No hay ningún enganche de parada…»).
- `docs/features/06-10-2026-ha-restart-fallbacks/README.md`: fila 2, `Diseño aprobado` → `Implementado`.

## Citas `archivo:línea` revisadas (spec 02, §2.4, §3, §5, §6)

Corregidas:

| Dónde | Antes | Ahora | Motivo |
|---|---|---|---|
| §2.4, `async_shutdown` | `engine/manager.py:145-160` | `engine/manager.py:150-167` | `async_shutdown` está en `manager.py:150-167` |
| §2.4, borrar integración | `__init__.py:90-100` | `__init__.py:93-109` | `async_remove_entry` está en `__init__.py:93-109` (cierre de válvulas en `:101-103`). El cambio de `async_setup_entry` lo desplazó |
| §3, arranque excedida | `engine/manager.py:166-180` | `engine/manager.py:234-248` | rama `now >= ends_at` de `_async_recover` (`overrun_restart`, `turn_off_failed`) |

Sin cambio (verificada):

- §5.2.2, `engine/triggers.py:81-83`: sigue siendo `untrack_zone`. Correcta.
- §5, §6: solo citan secciones (§x), no `archivo:línea`.
- Citas de HA/zigpy/supervisor y `docs/features/no-water/spec.md:8`: no tocadas.

## Observación (fuera del brief, no tocada)

`README.md` del cambio, sección «Causa, según el código», cita estado anterior al cambio:
`engine/manager.py:162-176` (`_async_recover`, ahora `:230-251`; el README lo describe como era al
reportar el fallo, así que puede dejarse). También `adapters/valves.py`, `engine/slots.py`,
`engine/triggers.py:132`, `engine/status.py` sin revisar. El brief solo toca la tabla del README.
