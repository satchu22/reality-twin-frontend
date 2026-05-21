"""Air freight cost estimation engine."""

from __future__ import annotations

from typing import Literal

from .freight_weight_engine import calculate_chargeable_weight

AirportType = Literal["large_airport", "medium_airport", "small_airport"]
ServiceLevel = Literal["economy", "standard", "express"]

AIR_RATE_PER_KG_KM: dict[ServiceLevel, float] = {
    "economy": 0.0009,
    "standard": 0.0013,
    "express": 0.0022,
}

AIRPORT_HANDLING_FEE_USD: dict[AirportType, float] = {
    "large_airport": 95.0,
    "medium_airport": 65.0,
    "small_airport": 45.0,
}


def _normalize_airport_type(airport_type: str | None) -> AirportType:
    if airport_type == "large_airport":
        return "large_airport"
    if airport_type == "small_airport":
        return "small_airport"
    return "medium_airport"


def _normalize_service_level(service_level: str | None) -> ServiceLevel:
    if service_level == "economy":
        return "economy"
    if service_level == "express":
        return "express"
    return "standard"


def estimate_air_freight_cost(
    *,
    weight_kg: float,
    volume_cbm: float,
    air_distance_km: float,
    pickup_road_cost: float,
    final_delivery_cost: float,
    origin_airport_type: str | None,
    destination_airport_type: str | None,
    risk_score: float,
    declared_value_usd: float,
    service_level: str,
    insurance_required: bool,
    temperature_controlled: bool,
    fragile: bool,
    hazardous: bool,
    commodity_type: str,
) -> dict[str, float | bool | str]:
    chargeable_weight = calculate_chargeable_weight(
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
    )
    chargeable_weight_kg = chargeable_weight["chargeable_weight_kg"]
    normalized_service_level = _normalize_service_level(service_level)
    air_rate_per_kg_km = AIR_RATE_PER_KG_KM[normalized_service_level]

    linehaul_cost = chargeable_weight_kg * air_rate_per_kg_km * max(air_distance_km, 0.0)
    fuel_surcharge = linehaul_cost * 0.12
    security_fee = max(25.0, chargeable_weight_kg * 0.08)
    risk_surcharge = linehaul_cost * max(risk_score, 0.0) / 100.0
    insurance_cost = declared_value_usd * 0.005 if insurance_required else 0.0

    origin_handling = AIRPORT_HANDLING_FEE_USD[_normalize_airport_type(origin_airport_type)]
    destination_handling = AIRPORT_HANDLING_FEE_USD[
        _normalize_airport_type(destination_airport_type)
    ]

    hazardous_allowed = True
    hazardous_reason = ""
    special_handling = 0.0

    if temperature_controlled:
        special_handling += linehaul_cost * 0.18
    if fragile:
        special_handling += linehaul_cost * 0.08
    if hazardous:
        if commodity_type == "hazardous" and (
            _normalize_airport_type(origin_airport_type) == "small_airport"
            or _normalize_airport_type(destination_airport_type) == "small_airport"
        ):
            hazardous_allowed = False
            hazardous_reason = (
                "Hazardous shipments are not allowed through the selected small-airport chain."
            )
        else:
            special_handling += linehaul_cost * 0.35

    total_estimated_cost_usd = (
        pickup_road_cost
        + linehaul_cost
        + origin_handling
        + destination_handling
        + security_fee
        + fuel_surcharge
        + risk_surcharge
        + insurance_cost
        + special_handling
        + final_delivery_cost
    )

    return {
        "pickup_road_cost": round(pickup_road_cost, 0),
        "air_linehaul_cost": round(linehaul_cost, 0),
        "origin_airport_handling": round(origin_handling, 0),
        "destination_airport_handling": round(destination_handling, 0),
        "security_fee": round(security_fee, 0),
        "fuel_surcharge": round(fuel_surcharge, 0),
        "risk_surcharge": round(risk_surcharge, 0),
        "insurance_cost": round(insurance_cost, 0),
        "special_handling": round(special_handling, 0),
        "final_delivery_cost": round(final_delivery_cost, 0),
        "total_estimated_cost_usd": round(total_estimated_cost_usd, 0),
        "hazardous_allowed": hazardous_allowed,
        "hazardous_reason": hazardous_reason,
        "chargeable_weight_kg": chargeable_weight_kg,
    }
