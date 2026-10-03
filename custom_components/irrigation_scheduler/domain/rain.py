"""Cálculo de lluvia y regla de omisión (05-rain-skip.md §4, §6 y §8). Sin dependencias de HA."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta

from .model import Settings

REASON_PAST = "rain_past"
REASON_FORECAST = "rain_forecast"
# lluvia pasada estimada con previsiones vencidas (docs/no-water/rain-estimated-design.md)
REASON_ESTIMATED = "rain_estimated"

# claves de la fuente en Settings; también en los datos de rain_source_unavailable
SOURCE_PAST = "rain_sensor"
SOURCE_FORECAST = "weather_entity"

# unidades de longitud (acumulado) y de intensidad (§8.12, §8.13)
MM_PER_UNIT = {"mm": 1.0, "cm": 10.0, "in": 25.4}
RATE_MM_PER_HOUR = {"mm/h": 1.0, "mm/d": 1 / 24, "in/h": 25.4, "in/d": 25.4 / 24}

# el pronóstico horario reparte cada valor en su hora
SLOT = timedelta(hours=1)

# purga del registro de previsiones: H máxima (24) + la hora en curso hacia atrás, 24 h hacia delante
LOG_KEEP_PAST = timedelta(hours=25)
LOG_KEEP_AHEAD = timedelta(hours=24)


@dataclass(frozen=True)
class Sample:
    """Un estado del histórico. `value` None: unavailable, unknown o no numérico."""

    when: datetime
    value: float | None


@dataclass(frozen=True)
class ForecastSlot:
    start: datetime
    mm: float


@dataclass(frozen=True)
class Verdict:
    skip: bool
    reason: str | None = None
    # mm del motivo; None si se riega
    rain_mm: float | None = None
    # se riega porque fallan todas las fuentes: no cierra el episodio (§8.19)
    sources_failed: bool = False


@dataclass(frozen=True)
class RainState:
    """Estado de lluvia único (§8.9). mm None: fuente no configurada o caída."""

    past_configured: bool = False
    forecast_configured: bool = False
    past_mm: float | None = None
    # ventana desde el momento del cálculo (§8.18)
    forecast_mm: float | None = None
    # pronóstico en caché para la predicción (§8.21)
    forecast: tuple[ForecastSlot, ...] | None = None
    past_error: str | None = None
    forecast_error: str | None = None
    # estimada con el registro en las últimas rain_forecast_hours; None sin previsión válida
    estimated_mm: float | None = None
    # registro de previsiones en el momento del cálculo, para la predicción
    forecast_log: tuple[ForecastSlot, ...] = ()

    @property
    def configured(self) -> bool:
        return self.past_configured or self.forecast_configured

    @property
    def all_failed(self) -> bool:
        return (
            self.configured
            and self.past_mm is None
            and self.forecast_mm is None
            and self.estimated_mm is None
        )

    @property
    def estimate_in_use(self) -> bool:
        """La estimación sustituye al pluviómetro: no hay o está caído (D5)."""
        return self.past_mm is None and self.estimated_mm is not None

    def failures(self) -> dict[str, str]:
        """Fuente configurada y caída → motivo."""
        result = {}
        if self.past_configured and self.past_error:
            result[SOURCE_PAST] = self.past_error
        if self.forecast_configured and self.forecast_error:
            result[SOURCE_FORECAST] = self.forecast_error
        return result


def to_mm(value: float, unit: str | None) -> float | None:
    """Longitud en mm; None si la unidad no se reconoce (§8.12)."""
    factor = MM_PER_UNIT.get(unit or "")
    return None if factor is None else value * factor


def past_rain_mm(unit: str | None, samples: list[Sample], start: datetime, end: datetime) -> float | None:
    """mm caídos en [start, end]. None si la unidad no se reconoce (§8.13).

    `samples` en orden; el primero es el vigente en `start` (histórico suficiente, §8.3).
    """
    if unit in MM_PER_UNIT:
        return _accumulated(samples) * MM_PER_UNIT[unit]
    if unit in RATE_MM_PER_HOUR:
        return _integrated(samples, start, end) * RATE_MM_PER_HOUR[unit]
    return None


def _accumulated(samples: list[Sample]) -> float:
    """Suma de tramos crecientes (§4.1): un descenso es un reinicio y el tramo nuevo empieza en 0."""
    total = 0.0
    previous: float | None = None
    for sample in samples:
        if sample.value is None:
            continue
        if previous is not None:
            total += sample.value - previous if sample.value >= previous else sample.value
        previous = sample.value
    return total


def _integrated(samples: list[Sample], start: datetime, end: datetime) -> float:
    """Suma escalonada (§8.13): cada estado vale hasta el siguiente; sin valor cuenta 0."""
    total = 0.0
    for index, sample in enumerate(samples):
        begin = max(sample.when, start)
        finish = min(samples[index + 1].when if index + 1 < len(samples) else end, end)
        if sample.value is None or finish <= begin:
            continue
        total += sample.value * (finish - begin).total_seconds() / 3600
    return total


def forecast_rain_mm(slots: Iterable[ForecastSlot], start: datetime, hours: int) -> tuple[float, bool]:
    """mm previstos en [start, start + hours] y si el pronóstico cubre toda la ventana.

    Los tramos de los extremos cuentan en proporción (§8.6). Si el pronóstico es corto, se
    suma lo disponible (§8.7).
    """
    end = start + timedelta(hours=hours)
    total = 0.0
    covered = start
    for slot in slots:
        slot_end = slot.start + SLOT
        overlap = (min(slot_end, end) - max(slot.start, start)).total_seconds()
        if overlap > 0:
            total += slot.mm * overlap / SLOT.total_seconds()
            covered = max(covered, min(slot_end, end))
    return total, covered >= end


def merge_forecast(
    log: dict[datetime, float], slots: Iterable[ForecastSlot], now: datetime
) -> dict[datetime, float]:
    """Fusiona una previsión en el registro y lo purga (rain-estimated-design.md §5.2, §5.4).

    Los tramos aún no empezados sobreescriben su entrada; los ya empezados no se tocan:
    quedan congelados con la última previsión vista antes de empezar.
    """
    merged = dict(log)
    for slot in slots:
        if slot.start >= now:
            merged[slot.start] = slot.mm
    return {
        start: mm
        for start, mm in merged.items()
        if now - LOG_KEEP_PAST <= start <= now + LOG_KEEP_AHEAD
    }


def log_slots(log: dict[datetime, float]) -> tuple[ForecastSlot, ...]:
    return tuple(ForecastSlot(start, mm) for start, mm in sorted(log.items()))


def estimated_rain_mm(slots: Iterable[ForecastSlot], now: datetime, hours: int) -> float:
    """mm estimados en [now − hours, now] con el registro (§5.3). Hora sin dato: 0."""
    total, _covered = forecast_rain_mm(slots, now - timedelta(hours=hours), hours)
    return total


def decide(
    settings: Settings,
    past_mm: float | None,
    forecast_mm: float | None,
    estimated_mm: float | None = None,
) -> Verdict:
    """Regla de §4 con fallos de §6. El motivo es el primero que se cumple.

    La estimación solo cuenta sin lluvia medida: sin pluviómetro o con él caído (D5).
    """
    if past_mm is not None:
        estimated_mm = None
    if past_mm is not None and past_mm >= settings.rain_past_threshold_mm:
        return Verdict(True, REASON_PAST, past_mm)
    if estimated_mm is not None and estimated_mm >= settings.rain_forecast_threshold_mm:
        return Verdict(True, REASON_ESTIMATED, estimated_mm)
    if forecast_mm is not None and forecast_mm >= settings.rain_forecast_threshold_mm:
        return Verdict(True, REASON_FORECAST, forecast_mm)
    return Verdict(
        False, sources_failed=past_mm is None and forecast_mm is None and estimated_mm is None
    )


def predict(state: RainState, settings: Settings, evaluate_at: datetime) -> Verdict | None:
    """Predicción de un bloque que se evaluará en `evaluate_at` (§8.21). None: sin predicción."""
    if not state.configured or state.all_failed:
        return None
    forecast = None
    if state.forecast is not None:
        forecast, _covered = forecast_rain_mm(state.forecast, evaluate_at, settings.rain_forecast_hours)
    estimated = None
    if state.estimated_mm is not None:
        # las horas entre ahora y evaluate_at ya están en el registro como previsión (§5.3)
        estimated = estimated_rain_mm(state.forecast_log, evaluate_at, settings.rain_forecast_hours)
    return decide(settings, state.past_mm, forecast, estimated)


def round_mm(value: float | None) -> float | None:
    return None if value is None else round(value, 1)


def format_rain(mm: float, unit: str) -> str:
    """«6.2 mm» o «0.24 in», según la unidad del sistema (§8.12)."""
    if unit == "in":
        return f"{mm / MM_PER_UNIT['in']:.2f} in"
    return f"{mm:.1f} mm"
