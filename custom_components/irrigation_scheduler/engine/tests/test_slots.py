"""ValveSlots: único dueño del estado en tránsito."""

from datetime import UTC, datetime

from custom_components.irrigation_scheduler.domain.runtime import Job, RuntimeState
from custom_components.irrigation_scheduler.engine.slots import ValveSlots

NOW = datetime(2026, 9, 30, 6, 0, tzinfo=UTC)


def slots_with(*jobs: tuple[str, str]) -> ValveSlots:
    runtime = RuntimeState()
    for zone_id, entity_id in jobs:
        runtime.enqueue(zone_id, entity_id, 600, origin="manual")
    return ValveSlots(runtime)


def reserve_startable(slots: ValveSlots, zone_limits: dict[str, int], global_limit: int | None) -> list[Job]:
    """Una pasada de despacho como la del manager: calcula y reserva uno a uno."""
    jobs = slots.startable(zone_limits, global_limit)
    for job in jobs:
        slots.reserve(job)
    return jobs


def test_reserve_respects_zone_limit_and_counts_opening() -> None:
    slots = slots_with(("z1", "switch.a"), ("z1", "switch.b"))
    assert [job.entity_id for job in reserve_startable(slots, {"z1": 1}, None)] == ["switch.a"]
    # «a» abriéndose ocupa el hueco de la zona
    assert reserve_startable(slots, {"z1": 1}, None) == []
    assert slots.reserved() == {"switch.a": "z1"}
    assert [job.entity_id for job in slots.runtime.pending] == ["switch.b"]


def test_open_then_close_frees_slot() -> None:
    slots = slots_with(("z1", "switch.a"))
    (job,) = reserve_startable(slots, {"z1": 1}, None)
    assert slots.finish_opening("switch.a") is False
    valve = slots.opened(job, NOW)
    assert slots.runtime.open_valves["switch.a"] is valve
    assert slots.runtime.batch_started == {"z1": NOW}
    assert slots.begin_close("switch.a") is True
    # dos cierres a la vez no
    assert slots.begin_close("switch.a") is False
    assert slots.busy() == {"switch.a"}
    assert slots.closed("switch.a") is valve
    assert slots.busy() == set()


def test_cancel_marks_opening_and_closes_open() -> None:
    slots = slots_with(("z1", "switch.a"), ("z1", "switch.b"), ("z2", "switch.c"))
    (job_a,) = reserve_startable(slots, {"z1": 1, "z2": 0}, None)
    slots.finish_opening("switch.a")
    slots.opened(job_a, NOW)
    (job_b,) = reserve_startable(slots, {"z1": 2, "z2": 0}, None)
    assert job_b.entity_id == "switch.b"

    closing = slots.cancel(lambda zone_id, _entity: zone_id == "z1")
    assert closing == ["switch.a"]
    assert slots.is_cancelled("switch.b")
    assert slots.visible_opening() == {}
    assert slots.reserved() == {"switch.b": "z1"}
    # la cola de otras zonas no se toca
    assert [job.entity_id for job in slots.runtime.pending] == ["switch.c"]
    assert slots.finish_opening("switch.b") is True
    assert not slots.is_cancelled("switch.b")


def test_prune_batches_keeps_active_zones() -> None:
    slots = slots_with(("z2", "switch.c"))
    slots.runtime.batch_started = {"z1": NOW, "z2": NOW, "gone": NOW}
    slots.prune_batches({"z1", "z2"})
    # z1 sin actividad, gone borrada; z2 tiene cola
    assert slots.runtime.batch_started == {"z2": NOW}


def test_manual_close_marks_busy() -> None:
    slots = ValveSlots(RuntimeState())
    slots.begin_manual_close(["switch.m"])
    assert slots.is_closing("switch.m") and slots.busy() == {"switch.m"}
    slots.end_manual_close("switch.m")
    assert slots.busy() == set()
