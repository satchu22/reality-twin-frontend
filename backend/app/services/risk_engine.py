"""Risk scoring helpers for route simulation."""

from __future__ import annotations


def clamp_risk(score: float) -> float:
    return round(min(max(score, 1.0), 99.0), 1)


def risk_level(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def road_risk(
    *,
    distance_km: float,
    traffic_bias: float,
    weather_bias: float,
) -> tuple[float, float, float]:
    traffic_risk = min(95.0, 18.0 + (distance_km / 90.0) + traffic_bias)
    weather_risk = min(95.0, 16.0 + (distance_km / 180.0) + weather_bias)
    overall = clamp_risk((traffic_risk * 0.55) + (weather_risk * 0.45))
    return round(traffic_risk, 1), round(weather_risk, 1), overall


def air_risk(
    *,
    first_road_risk: float,
    linehaul_distance_km: float,
    final_road_risk: float,
    handling_complexity: float,
) -> float:
    airport_delay_risk = 22.0 + (linehaul_distance_km / 420.0) + handling_complexity
    return clamp_risk(
        (first_road_risk * 0.2)
        + (airport_delay_risk * 0.5)
        + (final_road_risk * 0.2)
        + (handling_complexity * 0.1)
    )


def sea_risk(
    *,
    first_road_risk: float,
    linehaul_distance_km: float,
    final_road_risk: float,
    port_congestion_bias: float,
) -> float:
    sea_leg_risk = 18.0 + (linehaul_distance_km / 650.0) + port_congestion_bias
    return clamp_risk(
        (first_road_risk * 0.22)
        + (sea_leg_risk * 0.48)
        + (final_road_risk * 0.22)
        + (port_congestion_bias * 0.08)
    )


def hybrid_risk(*, leg_risks: list[float], transfer_count: int) -> float:
    if not leg_risks:
        return 0.0

    average_risk = sum(leg_risks) / len(leg_risks)
    return clamp_risk(average_risk + (transfer_count * 4.5))
