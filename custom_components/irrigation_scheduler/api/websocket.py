"""API WebSocket del panel (01-backend.md §2.2)."""

from __future__ import annotations

import logging
import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from ..adapters.notify import message_text
from ..adapters.speak import async_say
from ..const import DOMAIN, SIGNAL_CONFIG, SIGNAL_STATE, SPEAKER_PREFIX, TTS_PREFIX
from ..engine.manager import IrrigationManager
from ..errors import ZoneDeleteError
from .lookup import loaded_manager
from .schemas import SETTINGS_SCHEMA, ZONE_SCHEMA
from .snapshot import build_snapshot

_LOGGER = logging.getLogger(__name__)


def async_register_websocket(hass: HomeAssistant) -> None:
    for handler in (
        ws_list,
        ws_save_zone,
        ws_delete_zone,
        ws_save_settings,
        ws_run_zone,
        ws_run_valve,
        ws_stop,
        ws_pause_valve,
        ws_set_valve_enabled,
        ws_set_zone_enabled,
        ws_test_speak,
        ws_subscribe,
    ):
        websocket_api.async_register_command(hass, handler)


def _manager(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg_id: int
) -> IrrigationManager | None:
    if manager := loaded_manager(hass):
        return manager
    connection.send_error(msg_id, "not_loaded", "Irrigation Scheduler is not loaded")
    return None


async def _async_run(
    connection: websocket_api.ActiveConnection, msg_id: int, msg_type: str, coro: Any
) -> None:
    """Ejecuta un control y traduce los errores de validación a send_error."""
    # medición clic → respuesta, visible con log de depuración
    started = time.monotonic()
    try:
        await coro
    except ServiceValidationError as err:
        connection.send_error(msg_id, "invalid", str(err))
        return
    except ZoneDeleteError as err:
        # el panel compone el texto en su idioma con el código y las válvulas
        connection.send_error(msg_id, err.reason, ", ".join(err.valves))
        return
    connection.send_result(msg_id)
    _LOGGER.debug("%s en %.0f ms", msg_type, (time.monotonic() - started) * 1000)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
@callback
def ws_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        connection.send_result(msg["id"], build_snapshot(manager))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save_zone", vol.Required("zone"): ZONE_SCHEMA}
)
@websocket_api.async_response
async def ws_save_zone(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if not (manager := _manager(hass, connection, msg["id"])):
        return
    try:
        zone, issues = await manager.async_save_zone(msg["zone"])
    except ServiceValidationError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    connection.send_result(
        msg["id"],
        {"zone": zone.to_dict() if zone else None, "errors": [issue.to_dict() for issue in issues]},
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/delete_zone", vol.Required("zone_id"): str}
)
@websocket_api.async_response
async def ws_delete_zone(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], msg["type"], manager.async_delete_zone(msg["zone_id"]))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/save_settings", vol.Required("settings"): SETTINGS_SCHEMA}
)
@websocket_api.async_response
async def ws_save_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if not (manager := _manager(hass, connection, msg["id"])):
        return
    settings, issues = await manager.async_save_settings(msg["settings"])
    connection.send_result(
        msg["id"],
        {
            "settings": settings.to_dict() if settings else None,
            "errors": [issue.to_dict() for issue in issues],
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/test_speak",
        vol.Required("entity_id"): vol.All(str, vol.Match(f"^{SPEAKER_PREFIX}")),
        vol.Required("tts_entity"): vol.All(str, vol.Match(f"^{TTS_PREFIX}")),
        vol.Optional("volume"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=1))),
    }
)
@websocket_api.async_response
async def ws_test_speak(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Botón «Probar» (cast-notifies/spec.md §3): responde al empezar a sonar, no al acabar."""
    if not _manager(hass, connection, msg["id"]):
        return
    try:
        await async_say(
            hass, msg["entity_id"], msg["tts_entity"], msg.get("volume"), message_text(hass, "voice_test")
        )
    except (HomeAssistantError, TimeoutError) as err:
        connection.send_error(msg["id"], "speak_failed", str(err) or type(err).__name__)
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/run_zone", vol.Required("zone_id"): str}
)
@websocket_api.async_response
async def ws_run_zone(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], msg["type"], manager.async_run_zone(msg["zone_id"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/run_valve",
        vol.Required("entity_id"): str,
        vol.Optional("minutes"): vol.All(int, vol.Range(min=1)),
    }
)
@websocket_api.async_response
async def ws_run_valve(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(
            connection, msg["id"], msg["type"], manager.async_run_valve(msg["entity_id"], msg.get("minutes"))
        )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/stop", vol.Optional("zone_id"): str}
)
@websocket_api.async_response
async def ws_stop(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], msg["type"], manager.async_stop(msg.get("zone_id")))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/pause_valve", vol.Required("entity_id"): str}
)
@websocket_api.async_response
async def ws_pause_valve(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], msg["type"], manager.async_pause_valve(msg["entity_id"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_valve_enabled",
        vol.Required("entity_id"): str,
        vol.Required("enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_set_valve_enabled(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(
            connection,
            msg["id"],
            msg["type"],
            manager.async_set_valve_enabled(msg["entity_id"], msg["enabled"]),
        )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_zone_enabled",
        vol.Required("zone_id"): str,
        vol.Required("enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_set_zone_enabled(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(
            connection, msg["id"], msg["type"], manager.async_set_zone_enabled(msg["zone_id"], msg["enabled"])
        )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Envía el snapshot al suscribirse y en cada cambio de estado o configuración."""
    if not _manager(hass, connection, msg["id"]):
        return

    @callback
    def forward() -> None:
        # se resuelve en cada envío: tras recargar la entry el manager es otro
        if current := loaded_manager(hass):
            connection.send_message(websocket_api.event_message(msg["id"], build_snapshot(current)))

    unsub_state = async_dispatcher_connect(hass, SIGNAL_STATE, forward)
    unsub_config = async_dispatcher_connect(hass, SIGNAL_CONFIG, forward)

    @callback
    def unsubscribe() -> None:
        unsub_state()
        unsub_config()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])
    forward()
