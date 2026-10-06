# 1. Reintentos de cierre en segundo plano

> Estado: **implementado** · 2026-10-06
> Actualiza: [`docs/features/valves-execution/spec.md`](../../valves-execution/spec.md) §6 y §7.2,
> [`docs/features/alerts/spec.md`](../../alerts/spec.md) §2, [`docs/features/alerts/README.md`](../../alerts/README.md).

## 1. Objetivo

Cuando una válvula no cierra, el aviso `turn_off_failed` pide al usuario que la cierre a mano.
Si no hay nadie en casa, la integración debe seguir intentándolo un rato más. Así da tiempo a
que vuelva la red Zigbee y la válvula se cierre sola.

Solo afecta al **apagado**. El encendido no cambia.

## 2. Secuencia

| Momento | Qué pasa |
|---|---|
| 0 s | Orden de cierre: ráfaga actual de 1 intento + 3 reintentos (~8 s), sin cambios |
| ~8 s | Falla la ráfaga: aviso `turn_off_failed`, como hoy. Empieza el fallback |
| +10, +20, +30 s | Reintentos 1, 2 y 3 |
| +90, +150, +210, +270, +330, +390, +450 s | Reintentos 4 a 10, uno por minuto |
| ~7,5 min | Si fallan los 10: aviso «límite superado» (§4) y fin |

- Los momentos cuentan desde el inicio del fallback.
- Cada reintento es **un solo** `switch.turn_off` y su verificación de 2 s (`VERIFY_DELAY_S`),
  sin ráfaga.
- Constantes nuevas en `const.py`. No se exponen en los ajustes.
- Un reintento cuyo momento llega con otro aún en curso se salta y cuenta como hecho.
- **No hay aviso por cada reintento fallido.**

### 2.1 Reintento inmediato al volver la switch

Mientras dura el fallback se escucha el estado de la switch:

- Si pasa de `unavailable` o `unknown` a `on`, se lanza un reintento en ese momento, sin esperar
  al siguiente de la tabla. Es el caso de Zigbee volviendo tras un reinicio.
- Este reintento es extra: no cuenta entre los 10 ni mueve la tabla.

## 3. Fin del fallback

| Situación | Qué hace |
|---|---|
| La switch pasa a `off`: por un reintento, a mano o por otro motivo | Para. Aviso «ya cerrada» (§4) |
| Fallan los 10 reintentos | Para. Aviso «límite superado» (§4) |
| La integración abre esa misma válvula con un trabajo nuevo | Para sin aviso: el trabajo nuevo programa su cierre |
| Se descarga la entry o se para HA | Para sin aviso. Ver límites (§7) |

- Una válvula tiene como mucho un fallback activo. Si vuelve a fallar un cierre con uno en
  marcha, sigue el que hay: no se reinicia la tabla ni se repite el aviso `turn_off_failed`.

## 4. Avisos

Reutilizan los destinos (móviles y altavoces) de `turn_off_failed` mediante `kind`, como ya hace
`no_water_closed`. No son tipos de alerta nuevos en los ajustes.

| Aviso | Cuándo | Prioridad | Qué emite |
|---|---|---|---|
| `turn_off_failed` | Falla la ráfaga inicial | La de `turn_off_failed` (crítica, mínimo alta) | Sin cambios: entidad event, evento de bus y push |
| `turn_off_gave_up` | Fallan los 10 reintentos | La de `turn_off_failed` | Entidad event de `turn_off_failed` de la válvula, evento `irrigation_scheduler_valve_error` con `action: turn_off_gave_up`, y push |
| `turn_off_recovered` | La switch pasa a `off` durante el fallback | Normal | Solo push |

Textos:

- `turn_off_gave_up`
  - es: «{zone} · {entity}: error en cierre de válvula. Se ha superado el límite de reintentos
    ({time}). Ciérrala a mano.»
  - en: «{zone} · {entity}: valve close error. Retry limit exceeded ({time}). Close it by hand.»
- `turn_off_recovered`
  - es: «{zone} · {entity}: cerrada por reintento a las {time}. Ya no hace falta cerrarla a mano.»
  - en: «{zone} · {entity}: closed on retry at {time}. No need to close it by hand.»

## 5. Dónde se engancha

Un único punto en el manager sustituye a las llamadas `valve_error(..., False)` actuales: emite
`turn_off_failed` y arranca el fallback. Cubre todos los caminos de apagado:

- cierre programado y pausa (⏸): `_async_finish_close` (`engine/manager.py:620-632`);
- encendido a mano al vencer y pausa: `_async_close_manual` (`engine/manager.py:655-663`);
- recuperación al arrancar, válvula excedida: `_async_recover` (`engine/manager.py:162-176`);
- vigilancia del latido (§5.3 de la spec de válvulas): pasa por `_async_finish_close`.

Queda fuera `async_remove_entry` (`__init__.py:90-100`): al borrar la integración no hay quién
reintente.

Mientras una válvula tiene fallback activo:

- queda fuera de la detección de «encendida a mano» (`engine/manager.py:634-636`). Así no salta
  `manual_overrun` ni se programa un segundo cierre;
- no ocupa hueco de simultaneidad: el hueco se libera al fallar la ráfaga, como hoy
  (`engine/manager.py:630`).

## 6. Diseño

- Módulo nuevo en `engine/` con una clase que gestiona los fallbacks por `entity_id`:
  temporizadores con `async_call_later`, listener de estado y contador de reintentos.
- No toma el lock del manager. Recibe callbacks para cerrar, para avisar y para saber si la
  integración ha vuelto a abrir la válvula.
- `async_set_valve` admite un número de reintentos distinto del por defecto, para hacer el
  intento único del fallback.
- Sin tests nuevos, según la norma del proyecto para features. Gates:
  `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
  La validación funcional la hace el usuario en su HA.

## 7. Límites

- Si HA se reinicia durante el fallback, este se pierde. Al arrancar, la válvula ya no está en
  `open_valves`. Si sigue en `on`, la trata la vigilancia de «encendida a mano»
  (`docs/features/valves-execution/spec.md` §5.3.2). En un reinicio ordenado, el cambio 2 la
  intenta cerrar antes de parar.
- Una válvula fuera de alcance de forma permanente agota los 10 reintentos. Solo queda el aviso
  «límite superado».
