"""Air route helpers using free airport and route-network datasets."""

from __future__ import annotations

from dataclasses import dataclass

from .nearest_hub import Hub
from .airline_route_service import get_route_validation


@dataclass(frozen=True)
class AirRouteCandidate:
    origin_airport: Hub
    destination_airport: Hub
    validation: str
    carriers: tuple[str, ...] = ()
    airline_codes: tuple[str, ...] = ()
    stops: int | None = None


def build_air_route_candidates(
    *,
    origin_airports: list[Hub],
    destination_airports: list[Hub],
) -> list[AirRouteCandidate]:
    direct_candidates: list[AirRouteCandidate] = []
    one_stop_candidates: list[AirRouteCandidate] = []
    fallback_candidates: list[AirRouteCandidate] = []

    for origin_airport in origin_airports:
        for destination_airport in destination_airports:
            if origin_airport.code == destination_airport.code:
                continue

            route_validation = get_route_validation(
                origin_airport.code,
                destination_airport.code,
            )
            candidate = AirRouteCandidate(
                origin_airport=origin_airport,
                destination_airport=destination_airport,
                validation=str(route_validation["source"]),
                carriers=tuple(route_validation.get("possible_airlines", ())),
                airline_codes=tuple(route_validation.get("possible_airline_codes", ())),
                stops=int(route_validation.get("stops", 0)),
            )
            if bool(route_validation.get("direct_route_known")):
                direct_candidates.append(candidate)
            elif candidate.validation == "openflights" and candidate.stops == 1:
                one_stop_candidates.append(candidate)
            else:
                fallback_candidates.append(candidate)

    if direct_candidates:
        return direct_candidates
    if one_stop_candidates:
        return one_stop_candidates
    return fallback_candidates
