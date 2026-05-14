"""Generate multimodal transport-mode simulation options."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Literal

from ...services.cost_engine import (
    AIRPORT_HANDLING_COST_USD,
    PORT_HANDLING_COST_USD,
    TRANSFER_HANDLING_COST_USD,
    air_cost,
    air_time_hours,
    road_cost,
    road_time_hours,
    sea_cost,
    sea_time_hours,
)
from ...services.nearest_hub import (
    Hub,
    find_nearest_airports,
    find_nearest_seaports,
    haversine_distance_km,
)
from ...services.risk_engine import air_risk, hybrid_risk, risk_level, road_risk, sea_risk

SimulationMode = Literal["road", "air", "sea", "hybrid"]
LegMode = Literal["road", "air", "sea"]


@dataclass(frozen=True)
class Location:
    name: str
    lat: float
    lng: float


def _round_distance(value: float) -> float:
    return round(value, 1)


def _round_time(value: float) -> float:
    return round(value, 1)


def _round_cost(value: float) -> float:
    return round(value, 0)


def _curved_geometry(
    start: Location,
    end: Location,
    *,
    curvature: float = 0.0,
) -> list[list[float]]:
    if curvature == 0:
        return [[round(start.lng, 6), round(start.lat, 6)], [round(end.lng, 6), round(end.lat, 6)]]

    midpoint_lng = (start.lng + end.lng) / 2
    midpoint_lat = (start.lat + end.lat) / 2
    delta_lng = end.lng - start.lng
    delta_lat = end.lat - start.lat
    offset_lng = -delta_lat * curvature
    offset_lat = delta_lng * curvature
    return [
        [round(start.lng, 6), round(start.lat, 6)],
        [round(midpoint_lng + offset_lng, 6), round(midpoint_lat + offset_lat, 6)],
        [round(end.lng, 6), round(end.lat, 6)],
    ]


def _build_leg(
    *,
    mode: LegMode,
    source: Location,
    destination: Location,
    distance_km: float,
    time_hours: float,
    cost_usd: float,
    risk_score: float,
    purpose: str,
    curvature: float = 0.0,
) -> dict[str, object]:
    return {
        "mode": mode,
        "from": source.name,
        "to": destination.name,
        "distance_km": _round_distance(distance_km),
        "time_hours": _round_time(time_hours),
        "cost_usd": _round_cost(cost_usd),
        "risk_score": round(risk_score, 1),
        "purpose": purpose,
        "geometry": _curved_geometry(source, destination, curvature=curvature),
    }


def _score_option(total_time_hours: float, total_cost_usd: float, risk_score: float) -> float:
    return round((total_time_hours * 0.45) + ((total_cost_usd / 1000.0) * 0.35) + (risk_score * 0.2), 3)


def _dedupe_geometry(legs: list[dict[str, object]]) -> list[list[float]]:
    coordinates: list[list[float]] = []
    for leg in legs:
        for coordinate in leg["geometry"]:
            if not coordinates or coordinates[-1] != coordinate:
                coordinates.append(coordinate)
    return coordinates


def _summarize_option(
    *,
    option_id: str,
    name: str,
    mode: SimulationMode,
    mode_sequence: list[SimulationMode],
    route_name: str,
    recommendation_reason: str,
    legs: list[dict[str, object]],
    best: bool = False,
    extra_fields: dict[str, object] | None = None,
) -> dict[str, object]:
    total_distance_km = _round_distance(
        sum(float(leg["distance_km"]) for leg in legs)
    )
    total_time = _round_time(sum(float(leg["time_hours"]) for leg in legs))
    total_cost = _round_cost(sum(float(leg["cost_usd"]) for leg in legs))
    risk_score = round(sum(float(leg["risk_score"]) for leg in legs) / max(len(legs), 1), 1)
    option = {
        "id": option_id,
        "name": name,
        "label": name,
        "mode": mode,
        "mode_sequence": mode_sequence,
        "route_type": mode,
        "route": route_name,
        "total_distance_km": total_distance_km,
        "distance_km": total_distance_km,
        "total_time_hours": total_time,
        "total_time": round(total_time / 24.0, 1),
        "estimated_time_hours": total_time,
        "total_cost_usd": total_cost,
        "total_cost": total_cost,
        "estimated_cost_usd": total_cost,
        "risk_score": risk_score,
        "overall_risk_score": risk_score,
        "risk_level": risk_level(risk_score),
        "risk": risk_level(risk_score),
        "score": _score_option(total_time, total_cost, risk_score),
        "recommendation_reason": recommendation_reason,
        "legs": legs,
        "steps": legs,
        "geometry": _dedupe_geometry(legs),
        "best": best,
        "explanation": [recommendation_reason],
        "explanations": [recommendation_reason],
        "event_types": [],
        "live_events_used": [],
    }
    if extra_fields:
        option.update(extra_fields)
    return option


def _as_location(name: str, lat: float, lng: float) -> Location:
    return Location(name=name, lat=lat, lng=lng)


def _hub_location(hub: Hub) -> Location:
    return _as_location(hub.name, hub.lat, hub.lng)


def _road_profiles() -> list[dict[str, object]]:
    return [
        {
            "id": "road-fastest",
            "name": "Fastest Road Route",
            "speed_multiplier": 1.18,
            "rate_multiplier": 1.25,
            "distance_multiplier": 1.0,
            "traffic_bias": 18.0,
            "weather_bias": 6.0,
            "curvature": 0.015,
            "reason": "Prioritizes interstate speed and fewer stops to minimize total drive time.",
        },
        {
            "id": "road-cheapest",
            "name": "Cheapest Road Route",
            "speed_multiplier": 0.94,
            "rate_multiplier": 0.88,
            "distance_multiplier": 1.07,
            "traffic_bias": 8.0,
            "weather_bias": 10.0,
            "curvature": -0.03,
            "reason": "Trades a slightly longer haul for lower per-kilometer trucking cost.",
        },
        {
            "id": "road-safest",
            "name": "Safest Road Route",
            "speed_multiplier": 1.0,
            "rate_multiplier": 1.08,
            "distance_multiplier": 1.04,
            "traffic_bias": -4.0,
            "weather_bias": -6.0,
            "curvature": 0.04,
            "reason": "Avoids the riskiest corridors to reduce traffic and weather exposure.",
        },
    ]


def generate_road_options(origin: Location, destination: Location) -> list[dict[str, object]]:
    direct_distance = haversine_distance_km(origin.lat, origin.lng, destination.lat, destination.lng)
    options: list[dict[str, object]] = []

    for profile in _road_profiles():
        route_distance = direct_distance * float(profile["distance_multiplier"])
        traffic_component, weather_component, overall_risk = road_risk(
            distance_km=route_distance,
            traffic_bias=float(profile["traffic_bias"]),
            weather_bias=float(profile["weather_bias"]),
        )
        leg = _build_leg(
            mode="road",
            source=origin,
            destination=destination,
            distance_km=route_distance,
            time_hours=road_time_hours(route_distance, float(profile["speed_multiplier"])),
            cost_usd=road_cost(route_distance, float(profile["rate_multiplier"])),
            risk_score=overall_risk,
            purpose=profile["reason"],
            curvature=float(profile["curvature"]),
        )
        options.append(
            _summarize_option(
                option_id=str(profile["id"]),
                name=str(profile["name"]),
                mode="road",
                mode_sequence=["road"],
                route_name=f"{origin.name} → {destination.name}",
                recommendation_reason=str(profile["reason"]),
                legs=[leg],
                extra_fields={
                    "origin": origin.name,
                    "destination": destination.name,
                    "distance_km": _round_distance(route_distance),
                    "estimated_time_hours": leg["time_hours"],
                    "estimated_cost_usd": leg["cost_usd"],
                    "traffic_risk": traffic_component,
                    "weather_risk": weather_component,
                    "overall_risk_score": overall_risk,
                },
            )
        )

    return options


def _pick_unique_options(
    candidates: list[dict[str, object]],
    *,
    name_builder: list[str],
    sort_key_builders: list[tuple[str, Callable[[dict[str, object]], object]]],
) -> list[dict[str, object]]:
    chosen: list[dict[str, object]] = []
    used_ids: set[str] = set()

    for index, (option_name, sorter) in enumerate(zip(name_builder, sort_key_builders, strict=True)):
        _, key_builder = sorter
        for candidate in sorted(candidates, key=key_builder):
            candidate_id = str(candidate["id"])
            if candidate_id in used_ids:
                continue

            chosen_candidate = {**candidate, "name": option_name, "label": option_name}
            chosen.append(chosen_candidate)
            used_ids.add(candidate_id)
            break

    return chosen


def generate_air_options(origin: Location, destination: Location) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for origin_airport in find_nearest_airports(origin.lat, origin.lng, limit=3):
        for destination_airport in find_nearest_airports(destination.lat, destination.lng, limit=3):
            total_handling_cost = _round_cost(AIRPORT_HANDLING_COST_USD * 2)
            first_distance = haversine_distance_km(origin.lat, origin.lng, origin_airport.lat, origin_airport.lng)
            air_distance = haversine_distance_km(origin_airport.lat, origin_airport.lng, destination_airport.lat, destination_airport.lng)
            final_distance = haversine_distance_km(destination_airport.lat, destination_airport.lng, destination.lat, destination.lng)
            first_traffic, first_weather, first_risk = road_risk(
                distance_km=first_distance,
                traffic_bias=6.0,
                weather_bias=4.0,
            )
            final_traffic, final_weather, final_risk = road_risk(
                distance_km=final_distance,
                traffic_bias=4.0,
                weather_bias=4.0,
            )
            air_total_risk = air_risk(
                first_road_risk=first_risk,
                linehaul_distance_km=air_distance,
                final_road_risk=final_risk,
                handling_complexity=18.0,
            )
            legs = [
                _build_leg(
                    mode="road",
                    source=origin,
                    destination=_hub_location(origin_airport),
                    distance_km=first_distance,
                    time_hours=road_time_hours(first_distance, 1.05),
                    cost_usd=road_cost(first_distance, 1.05),
                    risk_score=first_risk,
                    purpose=f"First-mile pickup to {origin_airport.code}",
                ),
                _build_leg(
                    mode="air",
                    source=_hub_location(origin_airport),
                    destination=_hub_location(destination_airport),
                    distance_km=air_distance,
                    time_hours=air_time_hours(air_distance, 8.0),
                    cost_usd=air_cost(air_distance, total_handling_cost),
                    risk_score=air_total_risk,
                    purpose=f"Air freight from {origin_airport.code} to {destination_airport.code}",
                    curvature=0.06,
                ),
                _build_leg(
                    mode="road",
                    source=_hub_location(destination_airport),
                    destination=destination,
                    distance_km=final_distance,
                    time_hours=road_time_hours(final_distance, 1.0),
                    cost_usd=road_cost(final_distance, 1.0),
                    risk_score=final_risk,
                    purpose=f"Final delivery from {destination_airport.code}",
                ),
            ]
            route_name = f"{origin.name} → {destination.name}"
            candidates.append(
                _summarize_option(
                    option_id=f"air-{origin_airport.code}-{destination_airport.code}",
                    name=f"Air via {origin_airport.code} → {destination_airport.code}",
                    mode="air",
                    mode_sequence=["road", "air", "road"],
                    route_name=route_name,
                    recommendation_reason=(
                        f"Uses {origin_airport.code} and {destination_airport.code} for a clean airport-to-door air chain."
                    ),
                    legs=legs,
                    extra_fields={
                        "origin": origin.name,
                        "destination": destination.name,
                        "selected_origin_airport": origin_airport.code,
                        "selected_destination_airport": destination_airport.code,
                        "first_road_leg": legs[0],
                        "air_leg": legs[1],
                        "final_road_leg": legs[2],
                        "airport_handling_cost": total_handling_cost,
                        "traffic_risk": max(first_traffic, final_traffic),
                        "weather_risk": max(first_weather, final_weather),
                    },
                )
            )

    options = _pick_unique_options(
        candidates,
        name_builder=[
            "Fastest Air Option",
            "Cheapest Air Option",
            "Safest Air Option",
        ],
        sort_key_builders=[
            ("fastest", lambda candidate: (candidate["total_time_hours"], candidate["risk_score"])),
            ("cheapest", lambda candidate: (candidate["total_cost_usd"], candidate["risk_score"])),
            ("safest", lambda candidate: (candidate["risk_score"], candidate["total_time_hours"])),
        ],
    )
    return options


def generate_sea_options(origin: Location, destination: Location) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for origin_port in find_nearest_seaports(origin.lat, origin.lng, limit=3):
        for destination_port in find_nearest_seaports(destination.lat, destination.lng, limit=3):
            total_handling_cost = _round_cost(PORT_HANDLING_COST_USD * 2)
            first_distance = haversine_distance_km(origin.lat, origin.lng, origin_port.lat, origin_port.lng)
            sea_distance = haversine_distance_km(origin_port.lat, origin_port.lng, destination_port.lat, destination_port.lng)
            final_distance = haversine_distance_km(destination_port.lat, destination_port.lng, destination.lat, destination.lng)
            _, first_weather, first_risk = road_risk(
                distance_km=first_distance,
                traffic_bias=4.0,
                weather_bias=6.0,
            )
            _, final_weather, final_risk = road_risk(
                distance_km=final_distance,
                traffic_bias=4.0,
                weather_bias=6.0,
            )
            sea_total_risk = sea_risk(
                first_road_risk=first_risk,
                linehaul_distance_km=sea_distance,
                final_road_risk=final_risk,
                port_congestion_bias=16.0,
            )
            legs = [
                _build_leg(
                    mode="road",
                    source=origin,
                    destination=_hub_location(origin_port),
                    distance_km=first_distance,
                    time_hours=road_time_hours(first_distance, 0.98),
                    cost_usd=road_cost(first_distance, 0.98),
                    risk_score=first_risk,
                    purpose=f"Drayage to {origin_port.code}",
                ),
                _build_leg(
                    mode="sea",
                    source=_hub_location(origin_port),
                    destination=_hub_location(destination_port),
                    distance_km=sea_distance,
                    time_hours=sea_time_hours(sea_distance, 36.0),
                    cost_usd=sea_cost(sea_distance, total_handling_cost),
                    risk_score=sea_total_risk,
                    purpose=f"Ocean freight from {origin_port.code} to {destination_port.code}",
                    curvature=-0.05,
                ),
                _build_leg(
                    mode="road",
                    source=_hub_location(destination_port),
                    destination=destination,
                    distance_km=final_distance,
                    time_hours=road_time_hours(final_distance, 0.95),
                    cost_usd=road_cost(final_distance, 0.95),
                    risk_score=final_risk,
                    purpose=f"Final delivery from {destination_port.code}",
                ),
            ]
            route_name = f"{origin.name} → {destination.name}"
            candidates.append(
                _summarize_option(
                    option_id=f"sea-{origin_port.code}-{destination_port.code}",
                    name=f"Sea via {origin_port.code} → {destination_port.code}",
                    mode="sea",
                    mode_sequence=["road", "sea", "road"],
                    route_name=route_name,
                    recommendation_reason=(
                        f"Uses {origin_port.code} and {destination_port.code} for the lowest linehaul cost by sea."
                    ),
                    legs=legs,
                    extra_fields={
                        "origin": origin.name,
                        "destination": destination.name,
                        "selected_origin_port": origin_port.code,
                        "selected_destination_port": destination_port.code,
                        "first_road_leg": legs[0],
                        "sea_leg": legs[1],
                        "final_road_leg": legs[2],
                        "port_handling_cost": total_handling_cost,
                        "weather_risk": max(first_weather, final_weather),
                    },
                )
            )

    options = _pick_unique_options(
        candidates,
        name_builder=[
            "Cheapest Sea Option",
            "Balanced Sea Option",
            "Safest Sea Option",
        ],
        sort_key_builders=[
            ("cheapest", lambda candidate: (candidate["total_cost_usd"], candidate["risk_score"])),
            ("balanced", lambda candidate: (candidate["score"], candidate["total_time_hours"])),
            ("safest", lambda candidate: (candidate["risk_score"], candidate["total_time_hours"])),
        ],
    )
    return options


def generate_hybrid_options(origin: Location, destination: Location) -> list[dict[str, object]]:
    origin_airport = find_nearest_airports(origin.lat, origin.lng, limit=1)[0]
    destination_airport = find_nearest_airports(destination.lat, destination.lng, limit=1)[0]
    origin_port = find_nearest_seaports(origin.lat, origin.lng, limit=1)[0]
    destination_port = find_nearest_seaports(destination.lat, destination.lng, limit=1)[0]

    transfer_port = destination_port
    transfer_airport = destination_airport

    candidates: list[dict[str, object]] = []

    air_bridge = generate_air_options(origin, destination)[0]
    candidates.append(
        {
            **air_bridge,
            "id": "hybrid-fastest",
            "mode": "hybrid",
            "route_type": "hybrid",
            "name": "Fastest Hybrid Option",
            "label": "Fastest Hybrid Option",
            "mode_sequence": ["road", "air", "road"],
            "recommendation_reason": "Uses a road-air-road chain to minimize total transit time while keeping transfers limited.",
            "explanation": [
                "Uses a road-air-road chain to minimize total transit time while keeping transfers limited.",
            ],
            "explanations": [
                "Uses a road-air-road chain to minimize total transit time while keeping transfers limited.",
            ],
        }
    )

    sea_bridge = generate_sea_options(origin, destination)[0]
    candidates.append(
        {
            **sea_bridge,
            "id": "hybrid-cheapest",
            "mode": "hybrid",
            "route_type": "hybrid",
            "name": "Cheapest Hybrid Option",
            "label": "Cheapest Hybrid Option",
            "mode_sequence": ["road", "sea", "road"],
            "recommendation_reason": "Uses a road-sea-road chain to minimize cost while preserving first-mile and final-mile flexibility.",
            "explanation": [
                "Uses a road-sea-road chain to minimize cost while preserving first-mile and final-mile flexibility.",
            ],
            "explanations": [
                "Uses a road-sea-road chain to minimize cost while preserving first-mile and final-mile flexibility.",
            ],
        }
    )

    first_to_airport = haversine_distance_km(origin.lat, origin.lng, origin_airport.lat, origin_airport.lng)
    air_to_transfer = haversine_distance_km(origin_airport.lat, origin_airport.lng, transfer_airport.lat, transfer_airport.lng)
    transfer_to_port = haversine_distance_km(transfer_airport.lat, transfer_airport.lng, transfer_port.lat, transfer_port.lng)
    port_to_destination = haversine_distance_km(transfer_port.lat, transfer_port.lng, destination.lat, destination.lng)
    _, _, first_risk = road_risk(distance_km=first_to_airport, traffic_bias=1.0, weather_bias=1.0)
    _, _, transfer_risk = road_risk(distance_km=transfer_to_port, traffic_bias=-3.0, weather_bias=-2.0)
    _, _, final_risk = road_risk(distance_km=port_to_destination, traffic_bias=-2.0, weather_bias=-1.0)
    hybrid_air_risk = air_risk(
        first_road_risk=first_risk,
        linehaul_distance_km=air_to_transfer,
        final_road_risk=transfer_risk,
        handling_complexity=12.0,
    )
    hybrid_sea_risk = sea_risk(
        first_road_risk=transfer_risk,
        linehaul_distance_km=transfer_to_port + 120.0,
        final_road_risk=final_risk,
        port_congestion_bias=10.0,
    )
    mixed_legs = [
        _build_leg(
            mode="road",
            source=origin,
            destination=_hub_location(origin_airport),
            distance_km=first_to_airport,
            time_hours=road_time_hours(first_to_airport, 1.0),
            cost_usd=road_cost(first_to_airport, 1.0),
            risk_score=first_risk,
            purpose=f"Pickup to {origin_airport.code}",
        ),
        _build_leg(
            mode="air",
            source=_hub_location(origin_airport),
            destination=_hub_location(transfer_airport),
            distance_km=air_to_transfer,
            time_hours=air_time_hours(air_to_transfer, 2.5),
            cost_usd=air_cost(air_to_transfer, AIRPORT_HANDLING_COST_USD),
            risk_score=hybrid_air_risk,
            purpose=f"Air bridge to {transfer_airport.code}",
            curvature=0.04,
        ),
        _build_leg(
            mode="road",
            source=_hub_location(transfer_airport),
            destination=_hub_location(transfer_port),
            distance_km=transfer_to_port,
            time_hours=road_time_hours(transfer_to_port, 0.92),
            cost_usd=road_cost(transfer_to_port, 0.95) + TRANSFER_HANDLING_COST_USD,
            risk_score=transfer_risk,
            purpose=f"Transfer from {transfer_airport.code} to {transfer_port.code}",
        ),
        _build_leg(
            mode="sea",
            source=_hub_location(transfer_port),
            destination=_hub_location(destination_port),
            distance_km=max(haversine_distance_km(transfer_port.lat, transfer_port.lng, destination_port.lat, destination_port.lng), 120.0),
            time_hours=sea_time_hours(max(haversine_distance_km(transfer_port.lat, transfer_port.lng, destination_port.lat, destination_port.lng), 120.0), 12.0),
            cost_usd=sea_cost(max(haversine_distance_km(transfer_port.lat, transfer_port.lng, destination_port.lat, destination_port.lng), 120.0), PORT_HANDLING_COST_USD),
            risk_score=hybrid_sea_risk,
            purpose=f"Short-sea transfer into {destination_port.code}",
            curvature=-0.03,
        ),
        _build_leg(
            mode="road",
            source=_hub_location(destination_port),
            destination=destination,
            distance_km=port_to_destination,
            time_hours=road_time_hours(port_to_destination, 0.94),
            cost_usd=road_cost(port_to_destination, 1.02),
            risk_score=final_risk,
            purpose=f"Final delivery from {destination_port.code}",
        ),
    ]
    candidates.append(
        _summarize_option(
            option_id="hybrid-low-risk",
            name="Lowest-Risk Hybrid Option",
            mode="hybrid",
            mode_sequence=["road", "air", "road", "sea", "road"],
            route_name=f"{origin.name} → {destination.name}",
            recommendation_reason="Spreads the trip across multiple controlled handoffs to reduce single-mode exposure.",
            legs=mixed_legs,
            extra_fields={
                "origin": origin.name,
                "destination": destination.name,
                "transfer_count": 3,
            },
        )
    )

    for candidate in candidates:
        candidate["risk_score"] = hybrid_risk(
            leg_risks=[float(leg["risk_score"]) for leg in candidate["legs"]],
            transfer_count=max(len(candidate["mode_sequence"]) - 1, 1),
        )
        candidate["overall_risk_score"] = candidate["risk_score"]
        candidate["risk_level"] = risk_level(float(candidate["risk_score"]))
        candidate["risk"] = candidate["risk_level"]
        candidate["score"] = _score_option(
            float(candidate["total_time_hours"]),
            float(candidate["total_cost_usd"]),
            float(candidate["risk_score"]),
        )

    return candidates


def _mark_best_option(options: list[dict[str, object]]) -> str:
    best_option = min(options, key=lambda option: float(option["score"]))
    best_name = str(best_option["name"])
    for option in options:
        option["best"] = option["name"] == best_name
    return best_name


def generate_mode_simulation(
    *,
    origin_name: str,
    origin_lat: float,
    origin_lng: float,
    destination_name: str,
    destination_lat: float,
    destination_lng: float,
    selected_mode: SimulationMode,
) -> dict[str, object]:
    origin = _as_location(origin_name, origin_lat, origin_lng)
    destination = _as_location(destination_name, destination_lat, destination_lng)

    generators = {
        "road": generate_road_options,
        "air": generate_air_options,
        "sea": generate_sea_options,
        "hybrid": generate_hybrid_options,
    }
    options = generators[selected_mode](origin, destination)
    best_name = _mark_best_option(options)
    best_option = next(option for option in options if option["name"] == best_name)

    return {
        "origin": origin.name,
        "destination": destination.name,
        "selected_mode": selected_mode,
        "route": f"{origin.name} → {destination.name}",
        "total_time_hours": best_option["total_time_hours"],
        "total_time": best_option["total_time"],
        "total_cost_usd": best_option["total_cost_usd"],
        "total_cost": best_option["total_cost"],
        "risk_score": best_option["risk_score"],
        "risk_level": best_option["risk_level"],
        "risk": best_option["risk"],
        "distance_km": best_option["total_distance_km"],
        "explanation": [best_option["recommendation_reason"]],
        "recommendation_reason": best_option["recommendation_reason"],
        "options": options,
        "best_option": best_name,
    }
