"""Hub lookup helpers for multimodal route simulation."""

from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass(frozen=True)
class Hub:
    code: str
    name: str
    lat: float
    lng: float
    country: str
    coast: str | None = None


def haversine_distance_km(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
) -> float:
    earth_radius_km = 6371.0
    start_lat_radians = math.radians(start_lat)
    end_lat_radians = math.radians(end_lat)
    delta_lat = math.radians(end_lat - start_lat)
    delta_lng = math.radians(end_lng - start_lng)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(start_lat_radians)
        * math.cos(end_lat_radians)
        * math.sin(delta_lng / 2) ** 2
    )
    arc = 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    return earth_radius_km * arc


def _load_hubs(file_name: str) -> tuple[Hub, ...]:
    with (DATA_DIR / file_name).open(encoding="utf-8") as handle:
        records = json.load(handle)
    return tuple(Hub(**record) for record in records)


def _merge_hub_collections(*collections: tuple[Hub, ...]) -> tuple[Hub, ...]:
    merged: dict[str, Hub] = {}

    for collection in collections:
        for hub in collection:
            merged[hub.code] = hub

    return tuple(merged.values())


@lru_cache(maxsize=1)
def load_airports() -> tuple[Hub, ...]:
    csv_path = DATA_DIR / "airports_openflights.csv"
    csv_airports: list[Hub] = []
    if csv_path.exists():
        with csv_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if row.get("type") != "airport":
                    continue

                code = (row.get("iata") or "").strip().upper()
                if not code or code == "\\N":
                    continue

                try:
                    lat = float(row["latitude"])
                    lng = float(row["longitude"])
                except (TypeError, ValueError):
                    continue

                name = (row.get("name") or code).strip()
                country = (row.get("country") or "Unknown").strip()
                csv_airports.append(
                    Hub(
                        code=code,
                        name=name,
                        lat=lat,
                        lng=lng,
                        country=country,
                    )
                )

    merged_airports = _merge_hub_collections(_load_hubs("airports.json"), tuple(csv_airports))
    if merged_airports:
        return merged_airports

    return _load_hubs("airports.json")


@lru_cache(maxsize=1)
def load_seaports() -> tuple[Hub, ...]:
    return _load_hubs("seaports.json")


def find_nearest_hubs(
    lat: float,
    lng: float,
    hubs: tuple[Hub, ...],
    *,
    limit: int = 3,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[Hub]:
    ranked = sorted(
        hubs,
        key=lambda hub: haversine_distance_km(lat, lng, hub.lat, hub.lng),
    )
    if preferred_country:
        same_country = [hub for hub in ranked if hub.country == preferred_country]
        if same_country:
            ranked = same_country

    def _within(distance_limit: float | None) -> list[Hub]:
        if distance_limit is None:
            return ranked
        return [
            hub
            for hub in ranked
            if haversine_distance_km(lat, lng, hub.lat, hub.lng) <= distance_limit
        ]

    primary = _within(max_distance_km)
    if len(primary) >= min(limit, min_results):
        return primary[:limit]

    fallback = _within(fallback_distance_km)
    if len(fallback) >= min(limit, min_results):
        return fallback[:limit]

    if primary:
        return primary[:limit]

    if fallback:
        return fallback[:limit]

    return ranked[:limit]


def find_nearest_airports(
    lat: float,
    lng: float,
    limit: int = 3,
    *,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[Hub]:
    return find_nearest_hubs(
        lat,
        lng,
        load_airports(),
        limit=limit,
        max_distance_km=max_distance_km,
        fallback_distance_km=fallback_distance_km,
        preferred_country=preferred_country,
        min_results=min_results,
    )


def find_nearest_seaports(
    lat: float,
    lng: float,
    limit: int = 3,
    *,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[Hub]:
    return find_nearest_hubs(
        lat,
        lng,
        load_seaports(),
        limit=limit,
        max_distance_km=max_distance_km,
        fallback_distance_km=fallback_distance_km,
        preferred_country=preferred_country,
        min_results=min_results,
    )
