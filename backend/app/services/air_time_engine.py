"""Air freight transit time estimation engine."""

from __future__ import annotations

ROAD_SPEED_KMH = 55.0
AIR_CRUISE_SPEED_KMH = 780.0

PROCESSING_HOURS = {
    "express": 2.0,
    "standard": 4.0,
    "economy": 8.0,
}


def _normalize_service_level(service_level: str | None) -> str:
    if service_level == "express":
        return "express"
    if service_level == "economy":
        return "economy"
    return "standard"


def estimate_air_transit_time(
    *,
    pickup_road_distance_km: float,
    air_distance_km: float,
    final_delivery_road_distance_km: float,
    service_level: str,
    stops: int = 0,
    weather_delay_hours: float = 0.0,
) -> dict[str, float]:
    normalized_service_level = _normalize_service_level(service_level)
    pickup_road_time = max(pickup_road_distance_km, 0.0) / ROAD_SPEED_KMH
    air_flight_time = max(air_distance_km, 0.0) / AIR_CRUISE_SPEED_KMH
    final_delivery_road_time = max(final_delivery_road_distance_km, 0.0) / ROAD_SPEED_KMH
    airport_processing_time_origin = PROCESSING_HOURS[normalized_service_level]
    destination_airport_processing_time = PROCESSING_HOURS[normalized_service_level]
    transfer_time_if_any = 0.0 if stops <= 0 else min(8.0, max(3.0, stops * 3.0))
    weather_delay = max(weather_delay_hours, 0.0)

    total_time_hours = (
        pickup_road_time
        + airport_processing_time_origin
        + air_flight_time
        + transfer_time_if_any
        + destination_airport_processing_time
        + final_delivery_road_time
        + weather_delay
    )

    return {
        "pickup_road_time": round(pickup_road_time, 1),
        "airport_processing_time_origin": round(airport_processing_time_origin, 1),
        "air_flight_time": round(air_flight_time, 1),
        "transfer_time_if_any": round(transfer_time_if_any, 1),
        "destination_airport_processing_time": round(
            destination_airport_processing_time,
            1,
        ),
        "final_delivery_road_time": round(final_delivery_road_time, 1),
        "weather_delay": round(weather_delay, 1),
        "total_time_hours": round(total_time_hours, 1),
    }
