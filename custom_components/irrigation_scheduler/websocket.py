"""API WebSocket del panel (01-backend.md §2.2)."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .api.lookup import loaded_manager
from .api.schemas import SETTINGS_SCHEMA, ZONE_SCHEMA
from .const import DOMAIN, SIGNAL_CONFIG, SIGNAL_STATE
from .errors import ZoneDeleteError
from .manager import IrrigationManager


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
    connection: websocket_api.ActiveConnection, msg_id: int, coro: Any
) -> None:
    """Ejecuta un control y traduce los errores de validación a send_error."""
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


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
@callback
def ws_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        connection.send_result(msg["id"], manager.snapshot())


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
        await _async_run(connection, msg["id"], manager.async_delete_zone(msg["zone_id"]))


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
    {vol.Required("type"): f"{DOMAIN}/run_zone", vol.Required("zone_id"): str}
)
@websocket_api.async_response
async def ws_run_zone(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], manager.async_run_zone(msg["zone_id"]))


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
            connection, msg["id"], manager.async_run_valve(msg["entity_id"], msg.get("minutes"))
        )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/stop", vol.Optional("zone_id"): str}
)
@websocket_api.async_response
async def ws_stop(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], manager.async_stop(msg.get("zone_id")))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/pause_valve", vol.Required("entity_id"): str}
)
@websocket_api.async_response
async def ws_pause_valve(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    if manager := _manager(hass, connection, msg["id"]):
        await _async_run(connection, msg["id"], manager.async_pause_valve(msg["entity_id"]))


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
            connection, msg["id"], manager.async_set_zone_enabled(msg["zone_id"], msg["enabled"])
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
            connection.send_message(websocket_api.event_message(msg["id"], current.snapshot()))

    unsub_state = async_dispatcher_connect(hass, SIGNAL_STATE, forward)
    unsub_config = async_dispatcher_connect(hass, SIGNAL_CONFIG, forward)

    @callback
    def unsubscribe() -> None:
        unsub_state()
        unsub_config()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])
    forward()
