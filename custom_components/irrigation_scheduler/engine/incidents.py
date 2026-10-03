"""Incidencias: entidad event, evento de bus y push (docs/alerts/spec.md §0.1)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from ..adapters.notify import async_push, duration_text, message_text
from ..const import (
    EVENT_RAIN_SOURCE_UNAVAILABLE,
    EVENT_VALVE_ERROR,
    ORIGIN_EXTERNAL,
    ORIGIN_MANUAL,
    ORIGIN_SCHEDULED,
    SIGNAL_ALERT,
)
from ..domain.alerts import Alert, alert_priority, push_targets
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

    def find_valve(self, entity_id: str) -> tuple[Zone, Valve] | None:
        for zone in self._config().zones.values():
            for valve in zone.valves:
                if valve.entity_id == entity_id:
                    return zone, valve
        return None

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
        """Registra una incidencia (docs/alerts/spec.md §0.1).

        Entidad event y evento de bus siempre (decisión 8); el push, según Settings.alerts.
        `push=False`: quien llama agrupa el push (rain_skipped, un push por lote).
        """
        async_dispatcher_send(self.hass, SIGNAL_ALERT, Alert(alert_id, zone_id, entity_id, data))
        self.hass.bus.async_fire(event_type, data)
        settings = self._config().settings
        if not push or not (targets := push_targets(settings, alert_id)):
            return
        zone = self._config().zones.get(zone_id) if zone_id else None
        valve = (
            next((v for v in zone.valves if v.entity_id == entity_id), None) if zone else None
        )
        state = self.hass.states.get(entity_id) if entity_id else None
        # válvula: su nombre propio (V12); sensor u otra entidad: su nombre en HA
        entity = valve.name if valve else state.name if state else entity_id or ""
        await async_push(
            self.hass,
            targets,
            alert_id,
            alert_priority(settings, alert_id),
            zone=zone.name if zone else zone_id or "",
            entity=entity,
            **push_fields,
        )

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

    async def push_switched(
        self, entity_id: str, kind: str, origin: str | None, seconds: float | None = None
    ) -> None:
        """Push de encendido o apagado de una switch configurada (valve_switched). Solo push."""
        settings = self._config().settings
        if not (targets := push_targets(settings, "valve_switched")):
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
        await async_push(
            self.hass,
            targets,
            "valve_switched",
            alert_priority(settings, "valve_switched"),
            kind=kind,
            **fields,
        )

    async def push_rain_skipped(self, opened: list[tuple[Zone, str]], reason: str, rain_mm: float) -> None:
        """Un push por lote con las zonas que abren episodio (§8.20)."""
        settings = self._config().settings
        if not (targets := push_targets(settings, "rain_skipped")):
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
        await async_push(
            self.hass, targets, "rain_skipped", alert_priority(settings, "rain_skipped"), zones=zones
        )

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
