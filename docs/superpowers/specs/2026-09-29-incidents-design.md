# Incidencias de riego: registro, avisos e histórico — diseño

Fecha: 2026-09-29. Estado: **diseño cerrado**, pendiente de revisión. Lo que se fija en el plan va al final.

## Problema

La integración detecta incidencias (fallos de válvula, excesos de tiempo, sensores caídos) y las
emite como eventos de bus y push (`manager.py:126-186`, `236-251`, `378-392`). Hoy:

- No quedan a la vista: los eventos de bus no salen en `history/history_during_period`, y la
  tarjeta de histórico (`2026-09-29-history-card-design.md`) solo lee los `on`/`off` de las switch.
- No se configuran: todo push va a los `notify_targets` globales (`model.py:101`) con prioridad
  fija en el código (`manager.py:380`, `notify.py:17-21`).

## Objetivo

1. Registrar cada incidencia en el historial de HA, en su nivel: válvula, zona o instalación.
2. Mostrarlas en las vistas de la tarjeta de histórico, cada una en la fila de su nivel.
3. Un apartado nuevo en ajustes para decidir, por tipo, si hay push, a qué móviles, con qué
   prioridad y si se muestra en el histórico.

## Decisiones

1. **Alcance: tres subproyectos, en orden 1 → 2 → 3**, cada uno con su ciclo spec → plan →
   implementación:
   1. **Registro de incidencias** (esta spec): entidades `event` en 3 niveles, catálogo de 8
      tipos, apartado «Errores y avisos» en ajustes y envío del push según esa configuración.
   2. **Omisión por lluvia (fase 5)**: spec `docs/specs/05-rain-skip.md`, decisiones cerradas
      (D19-D27, `00-overview.md:145-153`). Ya hecho: configuración, validación V10/V11, ajustes y
      `rain_skip` por zona. Falta la decisión (`schedule.py:18-20`), las entidades de lluvia, el
      evento y el push por episodio. Dispara `rain_skipped` y `rain_source_unavailable` a través
      del registro de 1.
   3. **Tarjeta de histórico con incidencias**: amplía la tarjeta ya implementada
      (`2026-09-29-history-card-design.md`, PR #2) con la decisión 6.

   1 y 2 salen juntos: los 8 tipos se muestran activos en ajustes, sin filas bloqueadas.
2. **Registro: entidades `event` de HA (`EventEntity`), sin registro propio.** Cada incidencia
   llama a `_trigger_event(<tipo>, {...})`. El recorder guarda estado (hora) y atributos
   (`event_type` y datos). Sale en el historial y el logbook de HA y sirve de disparador en
   automatizaciones. Misma fuente que la tarjeta de histórico: el recorder.
3. **Tres niveles de entidad `event`:**
   - **Válvula**: una por válvula configurada.
   - **Zona**: una por zona, en el dispositivo de la zona (`entity.py:28-38`).
   - **Instalación**: una global, en el dispositivo de la instalación (`entity.py:49-60`).
4. **La entidad de válvula cuelga del dispositivo físico de la switch.** Aparece al abrir ese
   dispositivo, junto a la switch, y sus incidencias salen en su «Actividad». Si la switch no tiene
   dispositivo, cuelga del dispositivo de la zona. Candidato:
   `async_device_info_to_link_from_entity` (`homeassistant/helpers/device.py`); **verificar
   contra HA 2026.9 en el plan**. Quitar la válvula de la zona borra su entidad `event`.
5. **Zonas e instalación no cambian.** Siguen siendo dispositivos propios con sus entidades. La
   válvula sigue sin ser entidad propia: la switch es ajena; solo se añade su entidad `event`.
6. **Pintado por nivel en el histórico.** Incidencia de válvula → bajo su válvula. De zona → en la
   fila de la zona, una sola vez (una omisión por lluvia no se repite en cada válvula). Global →
   fila propia «Instalación» encima de las zonas; no se pinta si no hay ninguna en la ventana.
7. **Configuración por tipo (opción C):**
   - push sí/no;
   - móviles destino: subconjunto de los `notify_targets` globales; por defecto, todos;
   - prioridad del push: crítica, alta o normal; por defecto, la de la tabla;
   - mostrar en histórico sí/no.
   Suelo: `turn_off_failed` nunca baja de **alta**, para que una válvula que no apaga no pase
   desapercibida con el móvil en silencio.
8. **La configuración no silencia el registro.** La entidad `event` y el evento de bus se emiten
   siempre. El ajuste decide solo el push y lo que pinta la tarjeta.
9. **Los eventos de bus actuales se mantienen** sin cambios (`const.py:50-52`), por compatibilidad
   con automatizaciones.
10. **Sin tipos informativos nuevos (opción B).** No se añaden `missed_block_recovered` ni
    `block_not_run`.
11. **Borrar una zona apaga primero y borra después.** Si falla el apagado de alguna válvula, la
    zona no se borra, salta `turn_off_failed` y el panel muestra un modal con el error. Detalle en
    `docs/alerts/spec.md` §2.
12. **Referencia de alertas en `docs/alerts/`**: `README.md` (catálogo) y `spec.md` (una sección
    por alerta).

## Catálogo de tipos

| Nivel | Tipo | Caso | Prioridad por defecto | Origen |
|---|---|---|---|---|
| Válvula | `turn_on_failed` | No enciende tras 3 reintentos | Alta | `manager.py:308` |
| Válvula | `turn_off_failed` | No apaga tras 3 reintentos | Crítica (mínimo alta) | `manager.py:135`, `354`, `376` |
| Válvula | `overrun_restart` | Excedió su tiempo con HA parado; apagada al arrancar | Alta | `manager.py:126-133` |
| Válvula | `overrun_running` | Seguía abierta pasado su tiempo; apagada por el latido | Alta | `manager.py:175-179` |
| Válvula | `manual_overrun` | Encendida a mano más de su `duration_min`; apagada por el latido | Alta | `manager.py:180-186` |
| Zona | `sensor_unavailable` | Sensor de zona en `unavailable`/`unknown` | Normal | `manager.py:236-251` |
| Zona | `rain_skipped` | Bloque omitido por lluvia. **Fase 5** | Normal | `05-rain-skip.md` §7 |
| Global | `rain_source_unavailable` | Fuente de lluvia no disponible. **Fase 5** | Normal | `05-rain-skip.md` §6 |

- Los tres excesos comparten hoy el evento de bus `irrigation_scheduler_valve_overrun`
  (`manual: true` en el manual). En la entidad `event` son tres tipos, configurables por separado.
- `rain_skipped` conserva un push por episodio de lluvia (`05-rain-skip.md` §7.1); el histórico
  muestra cada bloque omitido.

## Modelo de datos de la configuración

Campo nuevo en `Settings` (`model.py:98-116`):

```python
alerts: dict[str, AlertConfig]   # clave = ID de alerta

@dataclass
class AlertConfig:
    push: bool = True
    targets: list[str] | None = None   # None = todos los notify_targets
    priority: str | None = None        # None = la del catálogo
    show_in_history: bool = True
```

- ID ausente → valores por defecto. Instalaciones existentes y tipos futuros no necesitan
  migración.
- `targets = None` → todos los `notify_targets` (`model.py:101`), también los que se añadan
  después. Lista → solo ese subconjunto. Un móvil que ya no está en `notify_targets` se ignora.
- `priority = None` → la del catálogo. La validación (`validation.py`) rechaza `normal` en
  `turn_off_failed` (decisión 7).
- Esquema WS (`websocket.py:43-54`): `alerts` con un sub-esquema por ID conocido. Un ID
  desconocido se rechaza.

## Interfaz del apartado «Errores y avisos»

Tarjeta nueva en `frontend/src/panel/settings-view.ts`, debajo de Notificaciones
(`settings-view.ts:169-196`):

```
┌ Errores y avisos ─────────────────────────────────────────────┐
│ Qué alertas llegan al móvil y cuáles salen en el histórico.   │
│ Todas quedan siempre registradas en HA.                        │
│                                                                │
│ VÁLVULA                        Push  Prioridad   Histórico     │
│ La válvula no enciende         [✓]   [Alta   ▾]  [✓]   ›       │
│ La válvula no apaga            [✓]   [Crítica▾]  [✓]   ›       │
│ …                                                              │
│ ZONA                                                           │
│ …                                                              │
│ INSTALACIÓN                                                    │
│ Fuente de lluvia no disponible [✓]   [Normal ▾]  [✓]   ›       │
└────────────────────────────────────────────────────────────────┘
```

- Una fila por alerta, agrupadas por nivel, en el orden del catálogo.
- `›` despliega: línea de ayuda (resumen del catálogo) y móviles en chips, como en
  Notificaciones, con un chip «Todos» encendido por defecto (`targets = None`). Al apagarlo se
  eligen uno a uno.
- Push apagado → prioridad y móviles deshabilitados.
- `turn_off_failed`: el desplegable no ofrece «Normal».
- Sin ningún móvil en Notificaciones: aviso en la tarjeta y los Push deshabilitados.
- Pantalla estrecha: Push, Prioridad e Histórico bajan a una segunda línea bajo el nombre.

## Incidencias en la tarjeta de histórico (subproyecto 3)

La tarjeta ya está implementada (PR #2, `a65ae3c`). El subproyecto 3 amplía ese código.

- **Datos.** Los ajustes llegan en el `Snapshot` (`api.ts:124`): la tarjeta filtra por
  `alerts[tipo].show_in_history`. La consulta de switch pide `no_attributes: true`
  (`api.ts:208-217`); las entidades `event` necesitan una segunda consulta con atributos
  (`event_type` y datos). Sus `entity_id` deben llegar a la tarjeta (p. ej. en el `Snapshot`).
- **Lista.** Alertas intercaladas por hora con los encendidos, en su nivel. Fila «Instalación»
  arriba, solo si hay alguna. Una válvula con alertas y sin encendidos también se muestra.
  ```
    Instalación                        1 aviso
      ⚠ mar 06:50  Sin datos de lluvia: pluviómetro
  ▾ Jardín delantero                 3 · 1:42:10 · 2 avisos
      ☂ lun 06:50  Riego omitido por lluvia (6.2 mm previstos)
      Goteo seto
        lun 20:00 → en curso         12:40
        ⚠ lun 07:00  No enciende
  ```
- **Línea de tiempo.** Cada alerta es una marca (rombo) en el eje a su hora; un color para
  errores (⚠) y otro para omisiones (☂). Las de zona van en una franja fina bajo el nombre de la
  zona; las globales, en una fila «Instalación» arriba. `<title>` con el texto.
- **Totales.** Columna nueva «Avisos» con el recuento por válvula, zona e instalación.

## Se fija en el plan

- Datos de cada `_trigger_event`, nombres de las entidades `event`, del evento de bus de
  `rain_source_unavailable` y textos y traducciones de los pushes nuevos.
- Verificar contra HA 2026.9: `async_device_info_to_link_from_entity` (decisión 4) y la
  conversión de unidades de las entidades de lluvia (`05-rain-skip.md` §8.12).
