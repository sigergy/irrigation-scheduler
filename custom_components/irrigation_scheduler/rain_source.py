"""Lectura de las fuentes de lluvia: histórico del pluviómetro y pronóstico horario (05-rain-skip.md §8)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from homeassistant.components.recorder import get_instance, history
from homeassistant.components.weather import WeatherEntityFeature
from homeassistant.const import ATTR_SUPPORTED_FEATURES, ATTR_UNIT_OF_MEASUREMENT, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant, State
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

from .rain import MM_PER_UNIT, RATE_MM_PER_HOUR, ForecastSlot, Sample, past_rain_mm, to_mm

_LOGGER = logging.getLogger(__name__)

# motivos de fallo de una fuente (datos de rain_source_unavailable)
UNAVAILABLE = "unavailable"
UNIT = "unit"
NO_HISTORY = "no_history"
NO_HOURLY = "no_hourly"
ERROR = "error"


def _value(state: State) -> float | None:
    try:
        return float(state.state)
    except ValueError:
        return None


def _usable(state: State | None) -> bool:
    return state is not None and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)


async def async_past_rain(hass: HomeAssistant, entity_id: str | None, hours: int) -> tuple[float | None, str | None]:
    """mm caídos en las últimas `hours` y motivo del fallo (§6, §8.3, §8.13)."""
    if entity_id is None:
        return None, None
    state = hass.states.get(entity_id)
    if not _usable(state):
        return None, UNAVAILABLE
    unit = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)
    if unit not in MM_PER_UNIT and unit not in RATE_MM_PER_HOUR:
        return None, UNIT
    end = dt_util.utcnow()
    start = end - timedelta(hours=hours)
    try:
        changes = await get_instance(hass).async_add_executor_job(
            _history, hass, entity_id, start, end
        )
    except (HomeAssistantError, KeyError) as err:
        _LOGGER.warning("No se pudo leer el histórico de %s: %s", entity_id, err)
        return None, ERROR
    # histórico suficiente: un estado en o antes del inicio de la ventana (§8.3)
    if not changes or changes[0].last_changed > start:
        return None, NO_HISTORY
    samples = [Sample(item.last_changed, _value(item)) for item in changes]
    # el recorder puede ir unos segundos por detrás del estado actual
    samples.append(Sample(end, _value(state)))
    return past_rain_mm(unit, samples, start, end), None


def _history(hass: HomeAssistant, entity_id: str, start: datetime, end: datetime) -> list[State]:
    """En el executor del recorder. Incluye el estado vigente en `start`."""
    result = history.state_changes_during_period(
        hass, start, end, entity_id, no_attributes=True, include_start_time_state=True
    )
    return list(result.get(entity_id, []))


async def async_forecast(hass: HomeAssistant, entity_id: str | None) -> tuple[list[ForecastSlot] | None, str | None]:
    """Pronóstico horario en mm por tramo de 1 h y motivo del fallo (§6, §8.12)."""
    if entity_id is None:
        return None, None
    state = hass.states.get(entity_id)
    if not _usable(state):
        return None, UNAVAILABLE
    if not int(state.attributes.get(ATTR_SUPPORTED_FEATURES, 0)) & WeatherEntityFeature.FORECAST_HOURLY:
        return None, NO_HOURLY
    unit = state.attributes.get("precipitation_unit")
    if unit not in MM_PER_UNIT:
        return None, UNIT
    try:
        response = await hass.services.async_call(
            "weather",
            "get_forecasts",
            {"entity_id": entity_id, "type": "hourly"},
            blocking=True,
            return_response=True,
        )
    except HomeAssistantError as err:
        _LOGGER.warning("No se pudo leer el pronóstico de %s: %s", entity_id, err)
        return None, ERROR
    items = ((response or {}).get(entity_id) or {}).get("forecast") or []
    if not items:
        return None, NO_HOURLY
    slots = []
    for item in items:
        start = dt_util.parse_datetime(str(item.get("datetime", "")))
        if start is None:
            continue
        slots.append(ForecastSlot(start, to_mm(float(item.get("precipitation") or 0), unit) or 0.0))
    return slots, None
