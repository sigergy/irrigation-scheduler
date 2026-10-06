"""config_edit: validación y preparación de cambios de configuración, sin runtime."""

from __future__ import annotations

import pytest
from homeassistant.exceptions import ServiceValidationError

from custom_components.irrigation_scheduler.const import DOMAIN, MODE_AUTO
from custom_components.irrigation_scheduler.domain.model import Config, Settings, Zone
from custom_components.irrigation_scheduler.engine.config_edit import (
    check_zone_option,
    prepare_settings,
    prepare_zone,
    require_zone,
)

from ...conftest import zone_data


def config_with(zone: Zone) -> Config:
    return Config(zones={zone.zone_id: zone})


def test_prepare_zone_new_gets_id_and_sorted_times() -> None:
    data = zone_data(["switch.v1"], start="07:00")
    data["start_times"] = ["07:00", "06:00"]
    data["valves"][0]["start_times"] = ["07:00", "06:00"]
    zone, issues, is_new = prepare_zone(Config(), data)
    assert issues == []
    assert is_new
    assert zone is not None
    assert len(zone.zone_id) == 32
    assert zone.start_times == ["06:00", "07:00"]
    assert zone.valves[0].start_times == ["06:00", "07:00"]
    # el dict de entrada no se modifica
    assert "zone_id" not in data


def test_prepare_zone_edit_unknown_zone_raises() -> None:
    with pytest.raises(ServiceValidationError) as err:
        prepare_zone(Config(), {**zone_data(["switch.v1"]), "zone_id": "missing"})
    assert err.value.translation_domain == DOMAIN
    assert err.value.translation_key == "unknown_zone"
    assert err.value.translation_placeholders == {"zone_id": "missing"}


def test_prepare_zone_edit_keeps_id() -> None:
    zone, _issues, _is_new = prepare_zone(Config(), zone_data(["switch.v1"]))
    assert zone is not None
    edited, issues, is_new = prepare_zone(config_with(zone), {**zone_data(["switch.v2"]), "zone_id": zone.zone_id})
    assert issues == []
    assert not is_new
    assert edited is not None and edited.zone_id == zone.zone_id


def test_prepare_zone_returns_issues() -> None:
    zone, issues, is_new = prepare_zone(Config(), {**zone_data(["switch.v1"]), "name": " "})
    assert zone is None
    assert is_new
    assert [issue.rule for issue in issues] == ["name"]


def test_prepare_settings_keeps_unsent_fields() -> None:
    # 6 h, distinto del defecto (24): debe sobrevivir a una edición que no lo envía
    config = Config(settings=Settings(rain_past_hours=6))
    settings, issues = prepare_settings(config, {"global_max_valves": 2})
    assert issues == []
    assert settings is not None
    assert settings.global_max_valves == 2
    assert settings.rain_past_hours == 6


def test_prepare_settings_invalid_returns_issues() -> None:
    settings, issues = prepare_settings(Config(), {"global_max_valves": 0})
    assert settings is None
    assert [issue.rule for issue in issues] == ["V9"]


def test_require_zone() -> None:
    zone, _issues, _is_new = prepare_zone(Config(), zone_data(["switch.v1"]))
    assert zone is not None
    assert require_zone(config_with(zone), zone.zone_id) is zone
    with pytest.raises(ServiceValidationError):
        require_zone(Config(), "missing")


def test_check_zone_option_invalid_mode() -> None:
    zone, _issues, _is_new = prepare_zone(Config(), zone_data(["switch.v1"]))
    assert zone is not None
    with pytest.raises(ValueError, match="bogus"):
        check_zone_option(zone, "mode", "bogus")


def test_check_zone_option_auto_without_calc_method() -> None:
    zone, _issues, _is_new = prepare_zone(Config(), zone_data(["switch.v1"]))
    assert zone is not None and zone.calc_method is None
    with pytest.raises(ServiceValidationError) as err:
        check_zone_option(zone, "mode", MODE_AUTO)
    assert err.value.translation_key == "auto_unavailable"
    # otras opciones no se comprueban aquí
    check_zone_option(zone, "rain_skip", True)
