"""Air route helpers using free airport and route-network datasets."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .nearest_hub import Hub

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass(frozen=True)
class AirRouteCandidate:
    origin_airport: Hub
    destination_airport: Hub
    validation: str


@lru_cache(maxsize=1)
def load_openflights_route_pairs() -> frozenset[tuple[str, str]]:
    route_path = DATA_DIR / "routes.dat"
    if not route_path.exists():
        return frozenset()

    route_pairs: set[tuple[str, str]] = set()
    with route_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 5:
                continue

            source_code = row[2].strip().upper()
            destination_code = row[4].strip().upper()
            if not source_code or not destination_code:
                continue
            if source_code == "\\N" or destination_code == "\\N":
                continue

            route_pairs.add((source_code, destination_code))

    return frozenset(route_pairs)


def build_air_route_candidates(
    *,
    origin_airports: list[Hub],
    destination_airports: list[Hub],
) -> list[AirRouteCandidate]:
    route_pairs = load_openflights_route_pairs()
    direct_candidates: list[AirRouteCandidate] = []
    fallback_candidates: list[AirRouteCandidate] = []

    for origin_airport in origin_airports:
        for destination_airport in destination_airports:
            if origin_airport.code == destination_airport.code:
                continue

            candidate = AirRouteCandidate(
                origin_airport=origin_airport,
                destination_airport=destination_airport,
                validation=(
                    "openflights_direct"
                    if (origin_airport.code, destination_airport.code) in route_pairs
                    else "estimated_air_pair"
                ),
            )
            if candidate.validation == "openflights_direct":
                direct_candidates.append(candidate)
            else:
                fallback_candidates.append(candidate)

    return direct_candidates if direct_candidates else fallback_candidates
