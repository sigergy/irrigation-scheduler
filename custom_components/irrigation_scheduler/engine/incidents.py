"""Incidencias: entidad event, evento de bus y push (docs/features/alerts/spec.md §0.1).

El push sale en segundo plano: ningún método espera a la red (docs/features/quiet-hours/spec.md §A).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from ..adapters.notify import Notifier, compose_notice, duration_text, message_text
from ..const import (
    EVENT_RAIN_SOURCE_UNAVAILABLE,
    EVENT_VALVE_ERROR,
    ORIGIN_EXTERNAL,
    ORIGIN_MANUAL,
    ORIGIN_SCHEDULED,
    PRIORITY_NORMAL,
    SIGNAL_ALERT,
)
from ..domain.alerts import SEVERITY_INFO, Alert, alert_priority, push_targets, voice_targets
from ..domain.model import Config, Valve, Zone
from ..domain.rain import RainState, format_rain


class Incidents:
    """Emite incidencias sin tocar el runtime; no toma el lock del manager."""

    def __init__(
        self, hass: HomeAssistant, config: Callable[[], Config], rain_unit: Callable[[], str]
    ) -> None:
        self.hass = hass
        # getters: el manager sustituye config al cargar
        self._config = config
        self._rain_unit = rain_unit
        self._notifier = Notifier(hass)

    def find_valve(self, entity_id: str) -> tuple[Zone, Valve] | None:
        for zone in self._config().zones.values():
            for valve in zone.valves:
                if valve.entity_id == entity_id:
                    return zone, valve
        return None

    def _targets(self, alert_id: str) -> tuple[list[str], list[str]]:
        """(móviles del push, altavoces de la voz) según Settings.alerts."""
        settings = self._config().settings
        return push_targets(settings, alert_id), voice_targets(settings, alert_id)

    def _names(self, zone_id: str | None, entity_id: str | None) -> dict[str, str]:
        """Campos zone y entity del push. Válvula: su nombre propio (V12); otra entidad: su nombre en HA."""
        zone = self._config().zones.get(zone_id) if zone_id else None
        valve = (
            next((v for v in zone.valves if v.entity_id == entity_id), None) if zone else None
        )
        state = self.hass.states.get(entity_id) if entity_id else None
        entity = valve.name if valve else state.name if state else entity_id or ""
        return {"zone": zone.name if zone else zone_id or "", "entity": entity}

    def _send(
        self,
        alert_id: str,
        targets: tuple[list[str], list[str]],
        *,
        kind: str | None = None,
        priority: str | None = None,
        severity: str | None = None,
        **fields: str,
    ) -> None:
        """Compone el aviso ahora y lo lanza en segundo plano: no espera a ningún canal.

        `priority` y `severity`: solo si el aviso no usa los del tipo (turn_off_recovered).
        """
        settings = self._config().settings
        phones, speakers = targets
        self._notifier.send(
            compose_notice(
                self.hass,
                alert_id,
                priority or alert_priority(settings, alert_id),
                phones,
                voice_targets=speakers,
                tts_entity=settings.tts_entity,
                tts_volume=settings.tts_volume,
                kind=kind,
                severity=severity,
                **fields,
            )
        )

    async def alert(
        self,
        alert_id: str,
        zone_id: str | None,
        entity_id: str | None,
        event_type: str,
        data: dict[str, Any],
        *,
        push: bool = True,
        **push_fields: str,
    ) -> None:
        """Registra una incidencia (docs/features/alerts/spec.md §0.1).

        Entidad event y evento de bus siempre (decisión 8); el push, según Settings.alerts.
        `push=False`: quien llama agrupa el push (rain_skipped, un push por lote).
        """
        async_dispatcher_send(self.hass, SIGNAL_ALERT, Alert(alert_id, zone_id, entity_id, data))
        self.hass.bus.async_fire(event_type, data)
        if not push or not any(targets := self._targets(alert_id)):
            return
        self._send(alert_id, targets, **self._names(zone_id, entity_id), **push_fields)

    async def valve_error(self, zone_id: str, entity_id: str, turning_on: bool) -> None:
        """La switch no responde tras los reintentos (03 §6)."""
        alert_id = "turn_on_failed" if turning_on else "turn_off_failed"
        await self.alert(
            alert_id,
            zone_id,
            entity_id,
            EVENT_VALVE_ERROR,
            {
                "zone_id": zone_id,
                "entity_id": entity_id,
                "action": "turn_on" if turning_on else "turn_off",
                # la configurada: mismas claves que antes, el valor sigue al ajuste
                "priority": alert_priority(self._config().settings, alert_id),
            },
        )

    async def valve_close_gave_up(self, zone_id: str, entity_id: str) -> None:
        """Fallan los reintentos de cierre en segundo plano (01-close-retry §4).

        Mismo tipo que turn_off_failed: su entidad event, su prioridad y sus destinos; otro texto.
        """
        alert_id = "turn_off_failed"
        await self.alert(
            alert_id,
            zone_id,
            entity_id,
            EVENT_VALVE_ERROR,
            {
                "zone_id": zone_id,
                "entity_id": entity_id,
                "action": "turn_off_gave_up",
                "priority": alert_priority(self._config().settings, alert_id),
            },
            kind="turn_off_gave_up",
        )

    async def push_close_recovered(self, zone_id: str, entity_id: str) -> None:
        """La switch se cierra durante los reintentos (01-close-retry §4).

        Solo push, prioridad normal, destinos de turn_off_failed: sin entidad event ni evento de bus.
        """
        if not any(targets := self._targets("turn_off_failed")):
            return
        self._send(
            "turn_off_failed",
            targets,
            kind="turn_off_recovered",
            priority=PRIORITY_NORMAL,
            severity=SEVERITY_INFO,
            **self._names(zone_id, entity_id),
        )

    async def push_switched(
        self, entity_id: str, kind: str, origin: str | None, seconds: float | None = None
    ) -> None:
        """Push de encendido o apagado de una switch configurada (valve_switched). Solo push."""
        if not any(targets := self._targets("valve_switched")):
            return
        # la válvula se quitó de la configuración entre el cambio de estado y el push
        if (found := self.find_valve(entity_id)) is None:
            return
        zone, valve = found
        fields = {
            "zone": zone.name,
            "entity": valve.name,
            "origin": f" ({message_text(self.hass, f'origin_{origin}')})"
            if origin in (ORIGIN_SCHEDULED, ORIGIN_MANUAL, ORIGIN_EXTERNAL)
            else "",
        }
        if seconds is not None:
            fields["duration"] = duration_text(seconds)
        self._send("valve_switched", targets, kind=kind, **fields)

    async def push_rain_skipped(self, opened: list[tuple[Zone, str]], reason: str, rain_mm: float) -> None:
        """Un push por lote con las zonas que abren episodio (§8.20)."""
        if not any(targets := self._targets("rain_skipped")):
            return
        unit = self._rain_unit()
        zones = ", ".join(
            message_text(self.hass, "rain_zone").format(
                zone=zone.name,
                start=start,
                amount=format_rain(rain_mm, unit),
                reason=message_text(self.hass, reason),
            )
            for zone, start in opened
        )
        self._send("rain_skipped", targets, zones=zones)

    async def rain_source_alert(self, state: RainState) -> None:
        """Una alerta por lote con las fuentes caídas y su motivo (§6, §8.2)."""
        failures = state.failures()
        settings = self._config().settings
        and_text = message_text(self.hass, "rain_and")
        await self.alert(
            "rain_source_unavailable",
            None,
            None,
            EVENT_RAIN_SOURCE_UNAVAILABLE,
            {
                "failures": [
                    {"source": source, "entity_id": getattr(settings, source), "reason": reason}
                    for source, reason in failures.items()
                ],
                "watering": state.all_failed,
                # pluviómetro caído o ausente: decide la estimación (rain-estimated-design.md §6.2)
                "estimated": state.estimate_in_use,
            },
            sources=and_text.join(message_text(self.hass, source) for source in failures),
            outcome=message_text(self.hass, _outcome(state)),
        )


def _outcome(state: RainState) -> str:
    """Desenlace de rain_source_unavailable: con qué se decide."""
    if state.all_failed:
        return "rain_water"
    if state.past_configured and state.estimate_in_use:
        return "rain_estimate"
    return "rain_other"
