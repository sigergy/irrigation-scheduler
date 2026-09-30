# Apagado a su hora de las válvulas encendidas fuera de la integración — diseño

Fecha: 2026-09-30.

## Problema

Una válvula configurada que se enciende fuera de la integración (botón físico, app de ZHA u otra
automatización) cuenta como «encendida a mano» (`_manual_on`, `manager.py:820-831`). Hoy la apaga
el latido, que corre cada 5 min (`HEARTBEAT_INTERVAL`, `const.py:57`), cuando lleva más de
`duration_min` + 1 min (`OVERRUN_MARGIN`, `const.py:60`; `manager.py:242-247`).

Por eso se apaga entre 1 y 6 min tarde. Caso real: una válvula de 3 min encendida con el botón
físico estuvo 5 min abierta.

## Objetivo

La válvula encendida fuera de la integración se apaga justo al cumplir su `duration_min`.

## Decisiones

1. **Temporizador exacto por válvula** en vez de esperar al latido.
2. **Sin alerta propia.** El aviso es el push de apagado de «Encendido/apagado»
   (`valve_switched`, `manager.py:418-423`), que ya sale con el origen `external`.
3. **El latido sigue** como red de seguridad, con su alerta `manual_overrun`. Solo actúa si falla
   el temporizador. Textos sin cambios.
4. **Sin cambios de interfaz**: «Regando (manual)» sigue sin barra de progreso.
5. **Sin tests.** Solo gates estáticos.

## Reutilización (leer-reutilizar-corregir)

| Decisión | Pieza | Desenlace |
|---|---|---|
| Switches encendidas a mano y desde cuándo | `_manual_on()` (`manager.py:820-831`) | Reutilizar |
| Apagar con reintentos y `turn_off_failed` | `_async_close_manual` (`manager.py:833-841`), marcando antes `_closing` bajo el lock, como el latido (`manager.py:248-253`) | Reutilizar |
| Cuándo vence un encendido a mano | Cálculo en línea del latido (`manager.py:246`) | Corregir: se extrae a `_manual_ends(valve, since)`, y la usan el latido y el temporizador |
| Ciclo de vida de los temporizadores | `_zone_unsubs`, con `_track_zone`/`_untrack_zone` (`manager.py:275-306`), llamados al arrancar (`:151`), al guardar zona (`:969`), al borrarla (`:1000`) y al parar (`:174`) | Reutilizar |
| Aviso | Push `valve_switched` de apagado | Reutilizar |

No sirven `_close_unsubs` ni `_schedule_close`. Son solo de válvulas en `open_valves`, y
`_begin_close_locked` los borra (`manager.py:798-801`). Es otro contrato.

## Backend (`manager.py`)

### 1. `_manual_ends(valve, since) -> datetime`

Devuelve `since + timedelta(minutes=valve.duration_min)`. El latido pasa a comprobar
`now > self._manual_ends(valve, since) + OVERRUN_MARGIN`, con el mismo comportamiento que hoy.

### 2. `_track_manual(zone_id, entity_id, since, valve)`

Programa `_async_manual_due(entity_id)` en `_manual_ends(valve, since)` con
`async_track_point_in_utc_time`. Añade el unsub a `self._zone_unsubs[zone_id]`, así que se cancela
con el resto de la vigilancia de la zona.

Se llama en dos sitios:

- **`_track_zone`**, al final: para cada válvula de la zona que está en `_manual_on()`. Cubre el
  arranque de HA, el guardado de la zona con otro `duration_min` y la reincorporación tras editar.
- **Rama `on` de `_async_valve_state_changed`** (`manager.py:400-416`), cuando el origen leído es
  `external`, con `since = new_state.last_changed`.

### 3. `_async_manual_due(entity_id, _now)`

Con el lock:

1. Busca la switch en `_manual_on()`. Si no está (apagada, o ya la gestiona la integración), sale.
2. Si `dt_util.utcnow() < _manual_ends(valve, since)`, sale. Es un temporizador viejo de un
   encendido anterior, porque la switch se apagó y volvió a encenderse. El nuevo ya está programado.
3. La añade a `_closing`.

Después, sin el lock: `await self._async_close_manual(zone_id, entity_id)`.

Si ya pasó su hora al programarse (arranque de HA), `async_track_point_in_utc_time` dispara al
momento.

Los temporizadores disparados o viejos siguen en la lista de la zona hasta el siguiente
`_track_zone`. Llamar a su unsub entonces no hace nada. Solo hay uno por encendido externo.

## Documentación

- `docs/specs/03-valves-execution.md` §5.3.2: temporizador exacto; el latido queda como red de
  seguridad.
- `docs/alerts/README.md` y `docs/alerts/spec.md`: `manual_overrun` solo salta si el temporizador
  no actúa.
- `README.md`: la válvula encendida a mano se apaga al cumplir sus minutos.

## Verificación

- `uvx ruff check custom_components`
- `py -3.14 -m compileall -q custom_components`

Sin cambios de frontend. El usuario valida en su HA con el botón físico de la SWV.

## Fuera de alcance

- Barra de progreso en «Regando (manual)».
- Cambiar el latido, su margen o el texto de `manual_overrun`.
