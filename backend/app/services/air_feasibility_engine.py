"""Feasibility checks for air freight simulation options."""

from __future__ import annotations

from ..models.shipment import ShipmentModel
from ..models.weather_risk import WeatherRisk
from .airport_data_service import AirportRecord
from .freight_weight_engine import calculate_chargeable_weight


def evaluate_air_feasibility(
    *,
    origin_airport: AirportRecord | None,
    destination_airport: AirportRecord | None,
    shipment: ShipmentModel,
    route_validation: dict[str, object],
    weather_risk: WeatherRisk | None,
    total_time_hours: float,
    hazardous_allowed: bool = True,
    hazardous_reason: str = "",
) -> dict[str, object]:
    warnings: list[str] = []
    blocking_issues: list[str] = []
    confidence_score = 100

    def add_warning(message: str, penalty: int = 5) -> None:
        nonlocal confidence_score
        warnings.append(message)
        confidence_score -= penalty

    if origin_airport is None:
        add_warning("Origin airport record could not be verified.", penalty=10)
    else:
        if not origin_airport.iata:
            add_warning("Origin airport does not have an IATA code.", penalty=8)
        if not origin_airport.scheduled_service:
            add_warning("Origin airport does not have scheduled service.", penalty=8)

    if destination_airport is None:
        add_warning("Destination airport record could not be verified.", penalty=10)
    else:
        if not destination_airport.iata:
            add_warning("Destination airport does not have an IATA code.", penalty=8)
        if not destination_airport.scheduled_service:
            add_warning("Destination airport does not have scheduled service.", penalty=8)

    chargeable_weight = calculate_chargeable_weight(shipment)
    chargeable_weight_kg = float(chargeable_weight["chargeable_weight_kg"])

    if shipment.hazardous:
        add_warning(
            "Hazardous cargo may require carrier-specific approval and special handling.",
            penalty=10,
        )
        if not hazardous_allowed and hazardous_reason:
            add_warning(hazardous_reason, penalty=12)

    if shipment.temperature_controlled:
        add_warning(
            "Temperature-controlled cargo requires confirmed cold-chain capacity.",
            penalty=8,
        )

    if shipment.fragile:
        add_warning(
            "Fragile cargo may require protective packaging and special handling.",
            penalty=4,
        )

    if chargeable_weight_kg > 1000:
        add_warning(
            "Large shipment may require cargo capacity confirmation.",
            penalty=8,
        )

    if shipment.declared_value_usd > 10000 and not shipment.insurance_required:
        add_warning(
            "High-value shipment detected. Insurance is recommended.",
            penalty=6,
        )

    direct_route_known = bool(route_validation.get("direct_route_known"))
    route_source = str(route_validation.get("source") or "estimated")
    if not direct_route_known:
        if route_source == "openflights":
            stops = int(route_validation.get("stops") or 1)
            add_warning(
                f"No direct route found in open route dataset. Estimated {stops}-stop/linehaul model used.",
                penalty=6,
            )
        else:
            add_warning(
                "No direct route found in open route dataset. Estimated one-stop/linehaul model used.",
                penalty=6,
            )

    if weather_risk is not None:
        if weather_risk.risk_level in {"medium", "high"} or weather_risk.risk_score >= 40:
            add_warning(
                "Weather risk may disrupt uplift, handling, or final delivery timing.",
                penalty=5,
            )

    confidence_score = max(0, min(100, confidence_score))

    return {
        "feasible": len(blocking_issues) == 0,
        "warnings": warnings,
        "blocking_issues": blocking_issues,
        "confidence_score": confidence_score,
    }
