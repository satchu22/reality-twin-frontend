"""Shared weather risk dataclasses for route simulation."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal


RiskLevel = Literal["low", "medium", "high", "unknown"]
WeatherRiskSource = Literal["open_meteo", "noaa_nws", "combined"]


@dataclass(frozen=True)
class WeatherSample:
    lat: float
    lng: float
    summary: str
    risk_score: float
    source: str


@dataclass(frozen=True)
class WeatherRisk:
    source: WeatherRiskSource
    risk_level: RiskLevel
    risk_score: float
    delay_hours: float
    summary: str
    alerts: list[dict[str, object]] = field(default_factory=list)
    affected_modes: list[str] = field(default_factory=list)
    lat: float = 0.0
    lng: float = 0.0
    sampled_locations: list[dict[str, object]] = field(default_factory=list)
    risk_explanation: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
