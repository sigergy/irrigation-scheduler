"""Formatos de unique_id y alta incremental."""

from custom_components.irrigation_scheduler.entities.sync import KnownSet
from custom_components.irrigation_scheduler.entities.unique_ids import installation_uid, valve_uid, zone_uid


def test_unique_id_formats_are_stable() -> None:
    # cambiar un formato duplica entidades en instalaciones existentes
    assert zone_uid("z1", "status") == "z1_status"
    assert installation_uid("alerts") == "installation_alerts"
    assert valve_uid("z1", "valve_mode", "switch.v1") == "z1_valve_mode_switch.v1"


def test_known_set_returns_only_new_and_forgets_removed() -> None:
    known: KnownSet[str] = KnownSet()
    assert known.sync(["a", "b"]) == ["a", "b"]
    assert known.sync(["a", "b", "c"]) == ["c"]
    assert known.sync(["a"]) == []
    # «b» se olvidó: si vuelve, es nueva
    assert known.sync(["a", "b"]) == ["b"]
