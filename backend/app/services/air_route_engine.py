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
    carriers: tuple[str, ...] = ()
    stops: int | None = None


@lru_cache(maxsize=1)
def load_openflights_route_metadata() -> dict[tuple[str, str], dict[str, object]]:
    route_path = DATA_DIR / "routes.dat"
    if not route_path.exists():
        return {}

    route_pairs: dict[tuple[str, str], dict[str, object]] = {}
    with route_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 8:
                continue

            airline_code = row[0].strip().upper()
            source_code = row[2].strip().upper()
            destination_code = row[4].strip().upper()
            if not source_code or not destination_code:
                continue
            if source_code == "\\N" or destination_code == "\\N":
                continue

            stops_raw = row[7].strip()
            try:
                stops = int(stops_raw)
            except ValueError:
                stops = None

            metadata = route_pairs.setdefault(
                (source_code, destination_code),
                {"carriers": set(), "stops": stops},
            )
            if airline_code and airline_code != "\\N":
                metadata["carriers"].add(airline_code)
            if stops is not None:
                current_stops = metadata.get("stops")
                metadata["stops"] = (
                    stops
                    if current_stops is None
                    else min(int(current_stops), stops)
                )

    return {
        route_pair: {
            "carriers": tuple(sorted(metadata["carriers"])),
            "stops": metadata["stops"],
        }
        for route_pair, metadata in route_pairs.items()
    }


def build_air_route_candidates(
    *,
    origin_airports: list[Hub],
    destination_airports: list[Hub],
) -> list[AirRouteCandidate]:
    route_metadata = load_openflights_route_metadata()
    direct_candidates: list[AirRouteCandidate] = []
    fallback_candidates: list[AirRouteCandidate] = []

    for origin_airport in origin_airports:
        for destination_airport in destination_airports:
            if origin_airport.code == destination_airport.code:
                continue

            route_key = (origin_airport.code, destination_airport.code)
            metadata = route_metadata.get(route_key)
            candidate = AirRouteCandidate(
                origin_airport=origin_airport,
                destination_airport=destination_airport,
                validation=(
                    "openflights_direct"
                    if metadata
                    else "estimated_air_pair"
                ),
                carriers=tuple(metadata.get("carriers", ())) if metadata else (),
                stops=int(metadata["stops"]) if metadata and metadata.get("stops") is not None else None,
            )
            if candidate.validation == "openflights_direct":
                direct_candidates.append(candidate)
            else:
                fallback_candidates.append(candidate)

    return direct_candidates if direct_candidates else fallback_candidates
