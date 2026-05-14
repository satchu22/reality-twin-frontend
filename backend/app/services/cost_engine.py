"""Cost and timing assumptions for multimodal routing."""

from __future__ import annotations

ROAD_RATE_PER_KM = 1.1
AIR_RATE_PER_KM = 5.4
SEA_RATE_PER_KM = 0.72

AIRPORT_HANDLING_COST_USD = 220.0
PORT_HANDLING_COST_USD = 480.0
TRANSFER_HANDLING_COST_USD = 160.0

ROAD_SPEED_KMH = 72.0
AIR_SPEED_KMH = 820.0
SEA_SPEED_KMH = 33.0


def road_cost(distance_km: float, rate_multiplier: float = 1.0) -> float:
    return round(distance_km * ROAD_RATE_PER_KM * rate_multiplier, 0)


def air_cost(distance_km: float, handling_cost: float = AIRPORT_HANDLING_COST_USD) -> float:
    return round((distance_km * AIR_RATE_PER_KM) + handling_cost, 0)


def sea_cost(distance_km: float, handling_cost: float = PORT_HANDLING_COST_USD) -> float:
    return round((distance_km * SEA_RATE_PER_KM) + handling_cost, 0)


def road_time_hours(distance_km: float, speed_multiplier: float = 1.0) -> float:
    return round(distance_km / (ROAD_SPEED_KMH * speed_multiplier), 1)


def air_time_hours(distance_km: float, handling_hours: float = 4.0) -> float:
    return round((distance_km / AIR_SPEED_KMH) + handling_hours, 1)


def sea_time_hours(distance_km: float, handling_hours: float = 18.0) -> float:
    return round((distance_km / SEA_SPEED_KMH) + handling_hours, 1)
