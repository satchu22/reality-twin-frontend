"""Deterministic logistics routing for full shipment journeys."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

ROAD_SPEED_KMH = 65.0
AIR_SPEED_KMH = 850.0
SEA_SPEED_KMH = 35.0

WAREHOUSE_LOADING_HOURS = 2.0
AIRPORT_HANDLING_HOURS = 6.0
PORT_LOADING_HOURS = 24.0
PORT_UNLOADING_HOURS = 36.0
FINAL_UNLOADING_HOURS = 2.0

ROAD_COST_PER_KM = 1.2
AIR_COST_PER_KM = 5.5
SEA_COST_PER_KM = 1.1

WAREHOUSE_LOADING_COST_USD = 75.0
AIRPORT_HANDLING_COST_USD = 150.0
PORT_LOADING_COST_USD = 400.0
PORT_UNLOADING_COST_USD = 550.0
FINAL_UNLOADING_COST_USD = 75.0

MODE_RISK_BASE = {
    "air": 55,
    "sea": 35,
    "hybrid": 45,
}


@dataclass(frozen=True)
class Hub:
    code: str
    name: str
    lat: float
    lng: float
    country: str
    distance_km: float | None = None


@dataclass(frozen=True)
class Location:
    name: str
    lat: float
    lng: float


def _round_distance(value: float) -> float:
    return round(value, 1)


def _round_hours(value: float) -> float:
    return round(value, 1)


def _round_cost(value: float) -> float:
    return round(value, 0)


@lru_cache(maxsize=1)
def _load_airports() -> tuple[Hub, ...]:
    with (DATA_DIR / "airports.json").open(encoding="utf-8") as handle:
        records = json.load(handle)
    return tuple(Hub(**record) for record in records)


@lru_cache(maxsize=1)
def _load_ports() -> tuple[Hub, ...]:
    with (DATA_DIR / "ports.json").open(encoding="utf-8") as handle:
        records = json.load(handle)
    return tuple(Hub(**record) for record in records)


def haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance between two coordinates."""

    earth_radius_km = 6371.0
    start_lat = math.radians(lat1)
    end_lat = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(start_lat) * math.cos(end_lat) * math.sin(delta_lng / 2) ** 2
    )
    arc = 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    return earth_radius_km * arc


def find_nearest_airports(lat: float, lng: float, limit: int = 3) -> list[dict[str, object]]:
    airports = sorted(
        _load_airports(),
        key=lambda hub: haversine_distance_km(lat, lng, hub.lat, hub.lng),
    )
    return [
        {
            "code": hub.code,
            "name": hub.name,
            "lat": hub.lat,
            "lng": hub.lng,
            "country": hub.country,
            "distance_km": _round_distance(haversine_distance_km(lat, lng, hub.lat, hub.lng)),
        }
        for hub in airports[:limit]
    ]


def find_nearest_ports(lat: float, lng: float, limit: int = 3) -> list[dict[str, object]]:
    ports = sorted(
        _load_ports(),
        key=lambda hub: haversine_distance_km(lat, lng, hub.lat, hub.lng),
    )
    return [
        {
            "code": hub.code,
            "name": hub.name,
            "lat": hub.lat,
            "lng": hub.lng,
            "country": hub.country,
            "distance_km": _round_distance(haversine_distance_km(lat, lng, hub.lat, hub.lng)),
        }
        for hub in ports[:limit]
    ]


def _location(name: str, lat: float, lng: float) -> Location:
    return Location(name=name, lat=lat, lng=lng)


def _hub_location(hub: Hub) -> Location:
    return _location(hub.name, hub.lat, hub.lng)


def _step(
    *,
    mode: Literal["road", "air", "sea", "handling"],
    source: Location,
    destination: Location,
    purpose: str,
    distance_km: float,
    time_hours: float,
    cost_usd: float,
) -> dict[str, object]:
    return {
        "mode": mode,
        "from": source.name,
        "to": destination.name,
        "purpose": purpose,
        "distance_km": _round_distance(distance_km),
        "time_hours": _round_hours(time_hours),
        "cost_usd": _round_cost(cost_usd),
        "geometry": [
            [round(source.lng, 6), round(source.lat, 6)],
            [round(destination.lng, 6), round(destination.lat, 6)],
        ],
    }


def _road_step(source: Location, destination: Location, purpose: str, extra_hours: float = 0.0, extra_cost: float = 0.0) -> dict[str, object]:
    distance_km = haversine_distance_km(source.lat, source.lng, destination.lat, destination.lng)
    time_hours = (distance_km / ROAD_SPEED_KMH) + extra_hours
    cost_usd = (distance_km * ROAD_COST_PER_KM) + extra_cost
    return _step(
        mode="road",
        source=source,
        destination=destination,
        purpose=purpose,
        distance_km=distance_km,
        time_hours=time_hours,
        cost_usd=cost_usd,
    )


def _air_step(source: Location, destination: Location, purpose: str) -> dict[str, object]:
    distance_km = haversine_distance_km(source.lat, source.lng, destination.lat, destination.lng)
    return _step(
        mode="air",
        source=source,
        destination=destination,
        purpose=purpose,
        distance_km=distance_km,
        time_hours=distance_km / AIR_SPEED_KMH,
        cost_usd=distance_km * AIR_COST_PER_KM,
    )


def _sea_step(source: Location, destination: Location, purpose: str) -> dict[str, object]:
    distance_km = haversine_distance_km(source.lat, source.lng, destination.lat, destination.lng)
    return _step(
        mode="sea",
        source=source,
        destination=destination,
        purpose=purpose,
        distance_km=distance_km,
        time_hours=distance_km / SEA_SPEED_KMH,
        cost_usd=distance_km * SEA_COST_PER_KM,
    )


def _handling_step(location: Location, purpose: str, hours: float, cost_usd: float) -> dict[str, object]:
    return _step(
        mode="handling",
        source=location,
        destination=location,
        purpose=purpose,
        distance_km=0.0,
        time_hours=hours,
        cost_usd=cost_usd,
    )


def _sum_step_values(steps: list[dict[str, object]], field: str) -> float:
    return sum(float(step[field]) for step in steps)


def _road_risk_increment(distance_km: float) -> int:
    if distance_km > 1000:
        return 10
    if distance_km > 500:
        return 5
    return 0


def _long_road_explanation(distance_km: float, label: str) -> str | None:
    if distance_km > 1000:
        return f"{label} road leg is very long, which raises trucking delay and damage exposure."
    if distance_km > 500:
        return f"{label} road leg is extended, so road congestion and handling risk are higher."
    return None


def _is_heavy_cargo(cargo_type: str) -> bool:
    normalized = cargo_type.strip().lower()
    return any(token in normalized for token in ("heavy", "bulk", "industrial", "machinery"))


def _dedupe_geometry(steps: list[dict[str, object]]) -> list[list[float]]:
    geometry: list[list[float]] = []
    for step in steps:
        for coordinate in step["geometry"]:
            if not geometry or geometry[-1] != coordinate:
                geometry.append(coordinate)
    return geometry


def _risk_level(score: float) -> str:
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _build_analysis(
    *,
    origin: Location,
    destination: Location,
    origin_airport: Hub | None,
    destination_airport: Hub | None,
    origin_port: Hub | None,
    destination_port: Hub | None,
) -> dict[str, float | None]:
    return {
        "origin_to_nearest_airport_km": _round_distance(
            haversine_distance_km(origin.lat, origin.lng, origin_airport.lat, origin_airport.lng)
        )
        if origin_airport
        else None,
        "origin_to_nearest_port_km": _round_distance(
            haversine_distance_km(origin.lat, origin.lng, origin_port.lat, origin_port.lng)
        )
        if origin_port
        else None,
        "destination_airport_to_final_km": _round_distance(
            haversine_distance_km(destination_airport.lat, destination_airport.lng, destination.lat, destination.lng)
        )
        if destination_airport
        else None,
        "destination_port_to_final_km": _round_distance(
            haversine_distance_km(destination_port.lat, destination_port.lng, destination.lat, destination.lng)
        )
        if destination_port
        else None,
        "main_air_distance_km": _round_distance(
            haversine_distance_km(origin_airport.lat, origin_airport.lng, destination_airport.lat, destination_airport.lng)
        )
        if origin_airport and destination_airport
        else None,
        "main_sea_distance_km": _round_distance(
            haversine_distance_km(origin_port.lat, origin_port.lng, destination_port.lat, destination_port.lng)
        )
        if origin_port and destination_port
        else None,
    }


def _score_route(
    *,
    route_type: Literal["air", "sea", "hybrid"],
    total_time_hours: float,
    total_cost_usd: float,
    road_distances: list[float],
    has_air_leg: bool,
    has_sea_leg: bool,
    priority: str,
    cargo_type: str,
    explanations: list[str],
) -> tuple[float, int, str, bool]:
    risk_score = MODE_RISK_BASE[route_type]
    practical = True

    for index, road_distance in enumerate(road_distances, start=1):
        risk_score += _road_risk_increment(road_distance)
        explanation = _long_road_explanation(road_distance, f"Road leg {index}")
        if explanation:
            explanations.append(explanation)
        if road_distance > 1800:
            practical = False
            explanations.append(
                f"Road leg {index} exceeds 1,800 km, so this option is operationally difficult."
            )

    if has_air_leg:
        explanations.append("Air leg reduces transit time but depends on airport handling and weather reliability.")
    if has_sea_leg:
        explanations.append("Sea leg is slower but cheaper, with customs and port dwell as the main delay risk.")

    normalized_priority = priority.strip().lower()
    if route_type == "air" and normalized_priority in {"high", "critical"}:
        explanations.append("High-priority shipment improves the case for air despite higher freight cost.")
        total_time_hours = max(total_time_hours - 4.0, 0.0)
        risk_score -= 3
    if route_type == "sea" and (normalized_priority == "low" or _is_heavy_cargo(cargo_type)):
        explanations.append("Low-priority or heavy cargo improves the fit for sea due to lower linehaul cost.")
        total_cost_usd = max(total_cost_usd - 250.0, 0.0)
        risk_score -= 2
    if route_type == "hybrid":
        explanations.append("Hybrid routing trades extra transfer handling for a balance between speed and cost.")

    risk_score = max(risk_score, 0)
    score = (total_time_hours * 0.6) + ((total_cost_usd / 1000.0) * 0.4) + (risk_score * 0.2)
    if not practical:
        score += 12.0

    return round(score, 3), risk_score, _risk_level(risk_score), practical


def _build_option(
    *,
    route_type: Literal["air", "sea", "hybrid"],
    route_name: str,
    steps: list[dict[str, object]],
    explanations: list[str],
    priority: str,
    cargo_type: str,
    analysis: dict[str, float | None],
) -> dict[str, object]:
    total_time_hours = _round_hours(_sum_step_values(steps, "time_hours"))
    total_cost_usd = _round_cost(_sum_step_values(steps, "cost_usd"))
    road_distances = [
        float(step["distance_km"])
        for step in steps
        if step["mode"] == "road"
    ]
    score, risk_score, risk_level, practical = _score_route(
        route_type=route_type,
        total_time_hours=total_time_hours,
        total_cost_usd=total_cost_usd,
        road_distances=road_distances,
        has_air_leg=any(step["mode"] == "air" for step in steps),
        has_sea_leg=any(step["mode"] == "sea" for step in steps),
        priority=priority,
        cargo_type=cargo_type,
        explanations=explanations,
    )
    return {
        "name": route_type,
        "label": route_type.upper(),
        "route_type": route_type,
        "route": route_name,
        "total_time_hours": total_time_hours,
        "total_time": round(total_time_hours / 24.0, 1),
        "total_cost_usd": total_cost_usd,
        "total_cost": total_cost_usd,
        "risk_level": risk_level,
        "risk": risk_level,
        "risk_score": risk_score,
        "score": score,
        "best": False,
        "steps": steps,
        "geometry": _dedupe_geometry(steps),
        "handling_points": [
            step["geometry"][0]
            for step in steps
            if step["mode"] == "handling"
        ],
        "explanations": explanations,
        "explanation": explanations,
        "event_types": [],
        "live_events_used": [],
        "analysis": {
            **analysis,
            "loading_unloading_time_hours": _round_hours(
                sum(float(step["time_hours"]) for step in steps if step["mode"] == "handling")
            ),
            "road_transport_cost_usd": _round_cost(
                sum(float(step["cost_usd"]) for step in steps if step["mode"] == "road")
            ),
            "main_transport_cost_usd": _round_cost(
                sum(
                    float(step["cost_usd"])
                    for step in steps
                    if step["mode"] in {"air", "sea"}
                )
            ),
            "practical": practical,
        },
    }


def _nearest_hub(hubs: tuple[Hub, ...], lat: float, lng: float) -> Hub:
    return min(
        hubs,
        key=lambda hub: haversine_distance_km(lat, lng, hub.lat, hub.lng),
    )


def build_air_route(origin: dict[str, object], destination: dict[str, object], *, priority: str = "standard", cargo_type: str = "general") -> dict[str, object]:
    origin_location = _location(str(origin["name"]), float(origin["lat"]), float(origin["lng"]))
    destination_location = _location(
        str(destination["name"]),
        float(destination["lat"]),
        float(destination["lng"]),
    )
    origin_airports = [
        Hub(**airport)
        for airport in find_nearest_airports(origin_location.lat, origin_location.lng, limit=3)
    ]
    destination_airports = [
        Hub(**airport)
        for airport in find_nearest_airports(destination_location.lat, destination_location.lng, limit=3)
    ]
    analysis = _build_analysis(
        origin=origin_location,
        destination=destination_location,
        origin_airport=origin_airports[0],
        destination_airport=destination_airports[0],
        origin_port=_nearest_hub(_load_ports(), origin_location.lat, origin_location.lng),
        destination_port=_nearest_hub(_load_ports(), destination_location.lat, destination_location.lng),
    )

    best_option: dict[str, object] | None = None
    for origin_airport in origin_airports:
        for destination_airport in destination_airports:
            steps = [
                _road_step(
                    origin_location,
                    _hub_location(origin_airport),
                    "First-mile transport to air hub after warehouse loading",
                    extra_hours=WAREHOUSE_LOADING_HOURS,
                    extra_cost=WAREHOUSE_LOADING_COST_USD,
                ),
                _handling_step(
                    _hub_location(origin_airport),
                    "Airport loading and export handling",
                    AIRPORT_HANDLING_HOURS,
                    AIRPORT_HANDLING_COST_USD,
                ),
                _air_step(
                    _hub_location(origin_airport),
                    _hub_location(destination_airport),
                    "Main international air freight leg",
                ),
                _handling_step(
                    _hub_location(destination_airport),
                    "Airport unloading and import handling",
                    AIRPORT_HANDLING_HOURS,
                    AIRPORT_HANDLING_COST_USD,
                ),
                _road_step(
                    _hub_location(destination_airport),
                    destination_location,
                    "Last-mile delivery with final unloading",
                    extra_hours=FINAL_UNLOADING_HOURS,
                    extra_cost=FINAL_UNLOADING_COST_USD,
                ),
            ]
            explanations = [
                f"Selected {origin_airport.code} and {destination_airport.code} because they minimize the full airport-to-door journey.",
                "Air route is usually the fastest option, but it carries the highest linehaul cost.",
            ]
            option = _build_option(
                route_type="air",
                route_name=f"{origin_location.name} → {destination_location.name}",
                steps=steps,
                explanations=explanations,
                priority=priority,
                cargo_type=cargo_type,
                analysis={
                    **analysis,
                    "origin_to_nearest_airport_km": _round_distance(
                        haversine_distance_km(origin_location.lat, origin_location.lng, origin_airport.lat, origin_airport.lng)
                    ),
                    "destination_airport_to_final_km": _round_distance(
                        haversine_distance_km(destination_airport.lat, destination_airport.lng, destination_location.lat, destination_location.lng)
                    ),
                    "main_air_distance_km": _round_distance(
                        haversine_distance_km(origin_airport.lat, origin_airport.lng, destination_airport.lat, destination_airport.lng)
                    ),
                },
            )
            if best_option is None or float(option["score"]) < float(best_option["score"]):
                best_option = option

    if best_option is None:
        raise ValueError("No air route could be generated")
    return best_option


def build_sea_route(origin: dict[str, object], destination: dict[str, object], *, priority: str = "standard", cargo_type: str = "general") -> dict[str, object]:
    origin_location = _location(str(origin["name"]), float(origin["lat"]), float(origin["lng"]))
    destination_location = _location(
        str(destination["name"]),
        float(destination["lat"]),
        float(destination["lng"]),
    )
    origin_ports = [Hub(**port) for port in find_nearest_ports(origin_location.lat, origin_location.lng, limit=3)]
    destination_ports = [Hub(**port) for port in find_nearest_ports(destination_location.lat, destination_location.lng, limit=3)]
    nearest_airports_origin = find_nearest_airports(origin_location.lat, origin_location.lng, limit=1)
    nearest_airports_destination = find_nearest_airports(destination_location.lat, destination_location.lng, limit=1)
    analysis = _build_analysis(
        origin=origin_location,
        destination=destination_location,
        origin_airport=Hub(**nearest_airports_origin[0]) if nearest_airports_origin else None,
        destination_airport=Hub(**nearest_airports_destination[0]) if nearest_airports_destination else None,
        origin_port=origin_ports[0],
        destination_port=destination_ports[0],
    )

    best_option: dict[str, object] | None = None
    for origin_port in origin_ports:
        for destination_port in destination_ports:
            steps = [
                _road_step(
                    origin_location,
                    _hub_location(origin_port),
                    "First-mile transport to seaport after warehouse loading",
                    extra_hours=WAREHOUSE_LOADING_HOURS,
                    extra_cost=WAREHOUSE_LOADING_COST_USD,
                ),
                _handling_step(
                    _hub_location(origin_port),
                    "Port loading and export handling",
                    PORT_LOADING_HOURS,
                    PORT_LOADING_COST_USD,
                ),
                _sea_step(
                    _hub_location(origin_port),
                    _hub_location(destination_port),
                    "Main international sea freight leg",
                ),
                _handling_step(
                    _hub_location(destination_port),
                    "Port unloading, customs, and import handling",
                    PORT_UNLOADING_HOURS,
                    PORT_UNLOADING_COST_USD,
                ),
                _road_step(
                    _hub_location(destination_port),
                    destination_location,
                    "Last-mile delivery with final unloading",
                    extra_hours=FINAL_UNLOADING_HOURS,
                    extra_cost=FINAL_UNLOADING_COST_USD,
                ),
            ]
            explanations = [
                f"Selected {origin_port.code} and {destination_port.code} because they minimize the port-to-door journey.",
                "Sea route is slower, but it usually offers the lowest long-haul freight cost.",
            ]
            option = _build_option(
                route_type="sea",
                route_name=f"{origin_location.name} → {destination_location.name}",
                steps=steps,
                explanations=explanations,
                priority=priority,
                cargo_type=cargo_type,
                analysis={
                    **analysis,
                    "origin_to_nearest_port_km": _round_distance(
                        haversine_distance_km(origin_location.lat, origin_location.lng, origin_port.lat, origin_port.lng)
                    ),
                    "destination_port_to_final_km": _round_distance(
                        haversine_distance_km(destination_port.lat, destination_port.lng, destination_location.lat, destination_location.lng)
                    ),
                    "main_sea_distance_km": _round_distance(
                        haversine_distance_km(origin_port.lat, origin_port.lng, destination_port.lat, destination_port.lng)
                    ),
                },
            )
            if best_option is None or float(option["score"]) < float(best_option["score"]):
                best_option = option

    if best_option is None:
        raise ValueError("No sea route could be generated")
    return best_option


def _nearest_airport_for_port(port: Hub) -> Hub:
    return min(
        _load_airports(),
        key=lambda airport: haversine_distance_km(port.lat, port.lng, airport.lat, airport.lng),
    )


def _nearest_port_for_airport(airport: Hub) -> Hub:
    return min(
        _load_ports(),
        key=lambda port: haversine_distance_km(airport.lat, airport.lng, port.lat, port.lng),
    )


def build_hybrid_route(origin: dict[str, object], destination: dict[str, object], *, priority: str = "standard", cargo_type: str = "general") -> dict[str, object]:
    origin_location = _location(str(origin["name"]), float(origin["lat"]), float(origin["lng"]))
    destination_location = _location(
        str(destination["name"]),
        float(destination["lat"]),
        float(destination["lng"]),
    )
    origin_airports = [Hub(**airport) for airport in find_nearest_airports(origin_location.lat, origin_location.lng, limit=3)]
    origin_ports = [Hub(**port) for port in find_nearest_ports(origin_location.lat, origin_location.lng, limit=3)]
    destination_airports = [Hub(**airport) for airport in find_nearest_airports(destination_location.lat, destination_location.lng, limit=3)]
    destination_ports = [Hub(**port) for port in find_nearest_ports(destination_location.lat, destination_location.lng, limit=3)]
    analysis = _build_analysis(
        origin=origin_location,
        destination=destination_location,
        origin_airport=origin_airports[0],
        destination_airport=destination_airports[0],
        origin_port=origin_ports[0],
        destination_port=destination_ports[0],
    )

    candidates: list[dict[str, object]] = []

    for origin_airport in origin_airports:
        for transfer_port in _load_ports():
            transfer_airport = _nearest_airport_for_port(transfer_port)
            for destination_port in destination_ports:
                steps = [
                    _road_step(
                        origin_location,
                        _hub_location(origin_airport),
                        "First-mile transport to airport after warehouse loading",
                        extra_hours=WAREHOUSE_LOADING_HOURS,
                        extra_cost=WAREHOUSE_LOADING_COST_USD,
                    ),
                    _handling_step(
                        _hub_location(origin_airport),
                        "Airport loading and export handling",
                        AIRPORT_HANDLING_HOURS,
                        AIRPORT_HANDLING_COST_USD,
                    ),
                    _air_step(
                        _hub_location(origin_airport),
                        _hub_location(transfer_airport),
                        "Air transfer leg to the sea transshipment region",
                    ),
                    _handling_step(
                        _hub_location(transfer_airport),
                        "Transfer handling after air arrival",
                        AIRPORT_HANDLING_HOURS,
                        AIRPORT_HANDLING_COST_USD,
                    ),
                    _road_step(
                        _hub_location(transfer_airport),
                        _hub_location(transfer_port),
                        "Road transfer from airport to seaport",
                    ),
                    _handling_step(
                        _hub_location(transfer_port),
                        "Port loading and customs transfer handling",
                        PORT_LOADING_HOURS,
                        PORT_LOADING_COST_USD,
                    ),
                    _sea_step(
                        _hub_location(transfer_port),
                        _hub_location(destination_port),
                        "Sea transfer leg",
                    ),
                    _handling_step(
                        _hub_location(destination_port),
                        "Port unloading, customs, and import handling",
                        PORT_UNLOADING_HOURS,
                        PORT_UNLOADING_COST_USD,
                    ),
                    _road_step(
                        _hub_location(destination_port),
                        destination_location,
                        "Last-mile delivery with final unloading",
                        extra_hours=FINAL_UNLOADING_HOURS,
                        extra_cost=FINAL_UNLOADING_COST_USD,
                    ),
                ]
                candidates.append(
                    _build_option(
                        route_type="hybrid",
                        route_name=f"{origin_location.name} → {destination_location.name}",
                        steps=steps,
                        explanations=[
                            (
                                f"Hybrid candidate uses {origin_airport.code}, transfers through "
                                f"{transfer_airport.code} and {transfer_port.code}, then finishes via {destination_port.code}."
                            ),
                        ],
                        priority=priority,
                        cargo_type=cargo_type,
                        analysis=analysis,
                    )
                )

    for origin_port in origin_ports:
        for transfer_port in _load_ports():
            transfer_airport = _nearest_airport_for_port(transfer_port)
            for destination_airport in destination_airports:
                steps = [
                    _road_step(
                        origin_location,
                        _hub_location(origin_port),
                        "First-mile transport to seaport after warehouse loading",
                        extra_hours=WAREHOUSE_LOADING_HOURS,
                        extra_cost=WAREHOUSE_LOADING_COST_USD,
                    ),
                    _handling_step(
                        _hub_location(origin_port),
                        "Port loading and export handling",
                        PORT_LOADING_HOURS,
                        PORT_LOADING_COST_USD,
                    ),
                    _sea_step(
                        _hub_location(origin_port),
                        _hub_location(transfer_port),
                        "Sea transfer leg to the air transshipment region",
                    ),
                    _handling_step(
                        _hub_location(transfer_port),
                        "Port unloading and transfer handling",
                        PORT_UNLOADING_HOURS,
                        PORT_UNLOADING_COST_USD,
                    ),
                    _road_step(
                        _hub_location(transfer_port),
                        _hub_location(transfer_airport),
                        "Road transfer from seaport to airport",
                    ),
                    _handling_step(
                        _hub_location(transfer_airport),
                        "Airport loading and transfer handling",
                        AIRPORT_HANDLING_HOURS,
                        AIRPORT_HANDLING_COST_USD,
                    ),
                    _air_step(
                        _hub_location(transfer_airport),
                        _hub_location(destination_airport),
                        "Final international air freight leg",
                    ),
                    _handling_step(
                        _hub_location(destination_airport),
                        "Airport unloading and import handling",
                        AIRPORT_HANDLING_HOURS,
                        AIRPORT_HANDLING_COST_USD,
                    ),
                    _road_step(
                        _hub_location(destination_airport),
                        destination_location,
                        "Last-mile delivery with final unloading",
                        extra_hours=FINAL_UNLOADING_HOURS,
                        extra_cost=FINAL_UNLOADING_COST_USD,
                    ),
                ]
                candidates.append(
                    _build_option(
                        route_type="hybrid",
                        route_name=f"{origin_location.name} → {destination_location.name}",
                        steps=steps,
                        explanations=[
                            (
                                f"Hybrid candidate uses {origin_port.code}, transfers through "
                                f"{transfer_port.code} and {transfer_airport.code}, then finishes via {destination_airport.code}."
                            ),
                        ],
                        priority=priority,
                        cargo_type=cargo_type,
                        analysis=analysis,
                    )
                )

    if not candidates:
        raise ValueError("No hybrid route could be generated")

    return min(candidates, key=lambda option: float(option["score"]))


def generate_logistics_options(
    *,
    origin_name: str,
    origin_lat: float,
    origin_lng: float,
    destination_name: str,
    destination_lat: float,
    destination_lng: float,
    priority: str = "standard",
    cargo_type: str = "general",
) -> dict[str, object]:
    origin = {"name": origin_name, "lat": origin_lat, "lng": origin_lng}
    destination = {
        "name": destination_name,
        "lat": destination_lat,
        "lng": destination_lng,
    }

    air_option = build_air_route(origin, destination, priority=priority, cargo_type=cargo_type)
    sea_option = build_sea_route(origin, destination, priority=priority, cargo_type=cargo_type)
    hybrid_option = build_hybrid_route(origin, destination, priority=priority, cargo_type=cargo_type)

    options = sorted(
        [air_option, sea_option, hybrid_option],
        key=lambda option: float(option["score"]),
    )

    best_option = str(options[0]["route_type"])
    for option in options:
        option["best"] = option["route_type"] == best_option

    return {
        "route": f"{origin_name} → {destination_name}",
        "total_time_hours": options[0]["total_time_hours"],
        "total_time": options[0]["total_time"],
        "total_cost_usd": options[0]["total_cost_usd"],
        "total_cost": options[0]["total_cost"],
        "risk_level": options[0]["risk_level"],
        "risk": options[0]["risk"],
        "explanation": options[0]["explanations"],
        "options": options,
        "best_option": best_option,
    }
