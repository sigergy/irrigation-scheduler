"""El panel recibe el cambio antes de que se escriba el runtime."""

from __future__ import annotations

import asyncio

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from custom_components.irrigation_scheduler.const import RUNTIME_STORE_KEY, SIGNAL_STATE

from ...conftest import add_zone


async def test_signal_before_disk_write(hass: HomeAssistant, manager, switches, hass_storage, monkeypatch) -> None:
    await add_zone(manager, switches, ["switch.v1", "switch.v2"])
    writes: list[str] = []
    order: list[str] = []

    original = manager._store.async_save_runtime

    async def spy(state):
        writes.append("direct")
        await original(state)

    monkeypatch.setattr(manager._store, "async_save_runtime", spy)

    @callback
    def on_state() -> None:
        order.append("signal")

    async_dispatcher_connect(hass, SIGNAL_STATE, on_state)
    # retiene la apertura; async_run_zone no la espera (se lanza en tarea aparte)
    switches.gate = asyncio.Event()

    try:
        await manager.async_run_zone(next(iter(manager.config.zones)))
        # el comando vuelve sin escritura directa y con la señal ya enviada
        assert writes == []
        assert order and order[0] == "signal"
    finally:
        switches.gate.set()
    await hass.async_block_till_done(wait_background_tasks=True)
    # la escritura diferida (delay 0, call_at + tarea) acaba guardando el último estado
    saved = hass_storage[RUNTIME_STORE_KEY]["data"]
    assert {valve["entity_id"] for valve in saved["open_valves"]} == {"switch.v1"}
    assert [job["entity_id"] for job in saved["pending"]] == ["switch.v2"]
