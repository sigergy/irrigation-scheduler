# 4. Partir manager.py por casos de uso

## Propuesta original

Partir `manager.py` en `commands/` (run, stop, pause) y `lifecycle/` (recover, heartbeat).

## Situación actual

- `engine/manager.py` tiene 966 líneas y unos 60 métodos. El tamaño es un problema real.
- Ya se han extraído colaboradores: `Triggers` (`engine/triggers.py`), `RainControl`
  (`engine/rain_control.py`), `Incidents` (`engine/incidents.py`), `ValveSlots`
  (`engine/slots.py`), `status` (`engine/status.py`), `manual` (`engine/manual.py`).
- Todo gira alrededor de un único `self._lock` (69 apariciones en `manager.py`) y de la
  convención de nombre `*_locked` para métodos que exigen el lock tomado.
- `engine/tests/test_lock.py:11` vigila ese invariante leyendo **solo** `manager.py`
  (`MANAGER = Path(__file__).parents[1] / "manager.py"`).

## Grupos de métodos identificados

- Ciclo de vida: `async_setup`, `_async_on_started`, `async_shutdown`, `_async_recover`,
  `_async_heartbeat`, `async_flush`, `_async_persist_locked`.
- Ejecución: `_enqueue_block_locked`, `_run_blocks_locked`, `_async_dispatch_locked`,
  `_async_open_job`, `_mark_open_locked`, `_schedule_close`, `_async_close_due`,
  `_begin_close_locked`, `_async_finish_close`, quiet hours (`_quiet_hold_locked`, …).
- Comandos: `async_run_zone`, `async_run_valve`, `_async_pause`, `async_stop`,
  `async_pause_valve`, `async_set_valve_enabled`, `async_set_zone_enabled`.
- CRUD de configuración: `async_save_zone`, `async_delete_zone`, `async_save_settings`,
  `async_set_zone_option`, `_get_zone`, `_find_valve`.
- Lluvia: `_track_rain`, `_untrack_rain`, `async_refresh_rain`, `_async_estimate_rain`,
  `_needs_rain`, `_async_recover_rain`, `_async_evaluate_lot`.
- Consultas: `zone_status`, `zone_rain_outlook`, `zone_next_run`, `rain_unit`, `active_valves`,
  `valve_origin`, `opening_durations`, `visible_opening`, `closing_valves`, `manual_on`.

## Riesgo principal

Repartir comandos y ciclo de vida en `commands/` y `lifecycle/` dispersa el lock. `test_lock.py`
dejaría de ver las llamadas movidas y **seguiría en verde sin avisar** (su aserto de no
vacuidad solo exige que quede alguna llamada a `self._slots.` en `manager.py`).

## Veredicto

**Parcial y con cuidado.** No partir por casos de uso de golpe.

## Plan

1. Ampliar antes `test_lock.py` para que recorra todo `engine/*.py`, no solo `manager.py`.
2. Extraer primero lo que no toca el lock:
   - consultas → módulo de lectura (candidato: ampliar `engine/status.py`);
   - validación y CRUD de configuración, en la parte que no muta runtime.
3. Mantener en `manager.py` todo lo `*_locked` y los comandos que toman el lock.
4. Reevaluar después si comandos y ciclo de vida merecen separarse.
5. Gates: `ruff`, `pytest` (caracterización + lock) en CI.
