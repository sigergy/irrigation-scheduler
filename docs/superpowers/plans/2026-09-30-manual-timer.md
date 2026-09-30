# Apagado a su hora de las válvulas encendidas a mano — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** una switch configurada que se enciende fuera de la integración se apaga justo al cumplir
su `duration_min`, no en el siguiente latido.

**Architecture:** hay un temporizador `async_track_point_in_utc_time` por encendido externo,
guardado en `_zone_unsubs` para reutilizar el ciclo de vida de `_track_zone`/`_untrack_zone`. Al
vencer, reutiliza `_manual_on()` y `_async_close_manual`. El latido sigue igual como red de
seguridad y comparte con el temporizador la regla de vencimiento `_manual_ends`.

**Tech Stack:** integración de Home Assistant en Python (`custom_components/irrigation_scheduler`).

Spec: `docs/superpowers/specs/2026-09-30-manual-timer-design.md`.

## Global Constraints

- Sin alerta propia. El aviso es el push `valve_switched` de apagado. `manual_overrun` solo lo lanza
  el latido, y sus textos no cambian.
- Sin cambios de frontend.
- Sin tests. Gates: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
- Comentarios en español; identificadores en inglés.

---

### Task 1: Temporizador exacto en `manager.py`

**Files:**
- Modify: `custom_components/irrigation_scheduler/manager.py` (latido `:242-247`, `_track_zone`
  `:275-302`, rama `on` de `_async_valve_state_changed` `:400-416`, junto a `_manual_on` `:820`)

**Interfaces:**
- Produces: `_manual_ends(valve: Valve, since: datetime) -> datetime`,
  `_track_manual(zone_id: str, valve: Valve, since: datetime) -> None` y
  `_async_manual_due(entity_id: str, _now: datetime) -> None`.

- [ ] **Step 1: añadir las tres funciones tras `_manual_on`**

```python
    def _manual_ends(self, valve: Valve, since: datetime) -> datetime:
        """Fin de una switch encendida a mano: su último paso a on + duration_min (03 §5.3.2)."""
        return since + timedelta(minutes=valve.duration_min)

    def _track_manual(self, zone_id: str, valve: Valve, since: datetime) -> None:
        """Programa el apagado a su hora; se cancela con la vigilancia de la zona (_untrack_zone)."""
        self._zone_unsubs.setdefault(zone_id, []).append(
            async_track_point_in_utc_time(
                self.hass,
                partial(self._async_manual_due, valve.entity_id),
                self._manual_ends(valve, since),
            )
        )

    async def _async_manual_due(self, entity_id: str, _now: datetime) -> None:
        """Apaga la switch encendida a mano al cumplir su duration_min (03 §5.3.2)."""
        async with self._lock:
            found = next(
                (item for item in self._manual_on() if item[1].entity_id == entity_id), None
            )
            # ya apagada o gestionada por la integración
            if found is None:
                return
            zone, valve, since = found
            # temporizador de un encendido anterior: el actual tiene el suyo
            if dt_util.utcnow() < self._manual_ends(valve, since):
                return
            self._closing.add(entity_id)
        await self._async_close_manual(zone.zone_id, entity_id)
```

- [ ] **Step 2: el latido usa `_manual_ends`**

Cambiar en `_async_heartbeat`:

```python
                if now - since > timedelta(minutes=valve.duration_min) + OVERRUN_MARGIN
```

por:

```python
                if now > self._manual_ends(valve, since) + OVERRUN_MARGIN
```

- [ ] **Step 3: `_track_zone` programa las ya encendidas a mano**

Tras `self._zone_unsubs[zone.zone_id] = unsubs`, añadir:

```python
        # ya encendidas a mano: arranque de HA o zona guardada con otro duration_min (03 §5.3.2)
        for manual_zone, valve, since in self._manual_on():
            if manual_zone.zone_id == zone.zone_id:
                self._track_manual(zone.zone_id, valve, since)
```

- [ ] **Step 4: el encendido externo programa su apagado**

En la rama `on` de `_async_valve_state_changed`, sustituir el bloque de «abre sin agua»:

```python
            # abre sin agua: se cierra nada más confirmarse. Si ya se está pausando por el
            # sensor (_cancelled o _closing), no se repite la alerta
            if entity_id not in self._cancelled and entity_id not in self._closing:
                try:
                    _zone, valve = self._find_valve(entity_id)
                except ServiceValidationError:
                    valve = None
                if valve is not None and self._supply_on(valve):
                    self._spawn(self._async_no_water(entity_id), f"{DOMAIN}_no_water")
            return
```

por:

```python
            try:
                zone, valve = self._find_valve(entity_id)
            except ServiceValidationError:
                return
            # encendida fuera de la integración: se apaga al cumplir sus minutos (03 §5.3.2)
            if self._switch_origin[entity_id] == ORIGIN_EXTERNAL:
                self._track_manual(zone.zone_id, valve, new_state.last_changed)
            # abre sin agua: se cierra nada más confirmarse. Si ya se está pausando por el
            # sensor (_cancelled o _closing), no se repite la alerta
            if (
                entity_id not in self._cancelled
                and entity_id not in self._closing
                and self._supply_on(valve)
            ):
                self._spawn(self._async_no_water(entity_id), f"{DOMAIN}_no_water")
            return
```

- [ ] **Step 5: gates**

Run: `uvx ruff check custom_components` → `All checks passed!`
Run: `py -3.14 -m compileall -q custom_components` → código 0, sin salida.

- [ ] **Step 6: commit**

```bash
git add custom_components/irrigation_scheduler/manager.py
git commit -F - <<'EOF'
feat(valves): la válvula encendida a mano se apaga al cumplir sus minutos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wmpz4L6uAj7XV6REWKeZah
EOF
```

### Task 2: Documentación

**Files:**
- Modify: `docs/specs/03-valves-execution.md` §5.3 (`:109-125`) y §7.2 (`:152`)
- Modify: `docs/alerts/README.md:51`
- Modify: `docs/alerts/spec.md` §5 (`:224-252`)
- Modify: `README.md:124` y sus notas

- [ ] **Step 1: `03-valves-execution.md` §5.3, punto 2.** Sustituir la viñeta «si supera su
  `duration_min` + 1 min, se apaga…» por:

```markdown
   - al pasar a `on` se programa su apagado en `last_changed + duration_min`. Al vencer se apaga
     (con reintentos, §6) sin alerta propia: avisa el push de apagado (§7.2, «Encendido y apagado»).
     También se programa al arrancar HA y al guardar su zona;
   - red de seguridad: si el latido la ve encendida más de `duration_min` + 1 min, la apaga, emite
     `irrigation_scheduler_valve_overrun` con `manual: true` y notifica (§7.2);
```

En §7.2, la fila `:152` pasa a: `` `switch` encendida a mano que el latido apaga tras su `duration_min` + 1 min (red de seguridad, §5.3.2) ``.

- [ ] **Step 2: `docs/alerts/README.md:51`.** Última columna:
  `Red de seguridad: el latido ve una switch encendida fuera de la integración más de su duration_min + 1 min. Se apaga. Lo normal es que la apague antes su temporizador, sin alerta.`

- [ ] **Step 3: `docs/alerts/spec.md` §5.** Tras «**Disparador.** Latido cada 5 min.», añadir:

```markdown
Lo normal es que no salte. Al pasar a `on`, `_track_manual` programa el apagado en
`last_changed + duration_min` (`_manual_ends`), y `_async_manual_due` lo ejecuta sin alerta
propia: solo el push `valve_switched` de apagado. Esta alerta queda como red de seguridad si el
temporizador no actúa.
```

- [ ] **Step 4: `README.md`.** Bajo la tabla de alertas, añadir a las notas:
  `- Una válvula encendida fuera de la integración (botón físico, otra automatización) se apaga al cumplir sus minutos. «Exceso manual» solo salta si no se apagó a su hora.`

- [ ] **Step 5: commit**

```bash
git add docs/specs/03-valves-execution.md docs/alerts/README.md docs/alerts/spec.md README.md
git commit -F - <<'EOF'
docs: apagado a su hora de la válvula encendida a mano

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wmpz4L6uAj7XV6REWKeZah
EOF
```
