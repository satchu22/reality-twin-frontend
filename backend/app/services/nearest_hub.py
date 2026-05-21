"""Hub lookup helpers for multimodal route simulation."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .airport_data_service import (
    AirportRecord,
    find_nearest_airport_records,
    load_airport_records,
)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass(frozen=True)
class Hub:
    code: str
    name: str
    lat: float
    lng: float
    country: str
    coast: str | None = None
    distance_km: float | None = None


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


def _airport_record_to_hub(
    record: AirportRecord,
    *,
    distance_km: float | None = None,
) -> Hub:
    code = record.iata or record.icao or record.ident or record.id
    country = record.iso_country or "Unknown"
    return Hub(
        code=code,
        name=record.name,
        lat=record.lat,
        lng=record.lng,
        country=country,
        distance_km=distance_km,
    )


@lru_cache(maxsize=1)
def load_airports() -> tuple[Hub, ...]:
    return tuple(_airport_record_to_hub(record) for record in load_airport_records())


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
    limit: int = 5,
    *,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[Hub]:
    return [
        _airport_record_to_hub(result.airport, distance_km=result.distance_km)
        for result in find_nearest_airport_records(
            lat,
            lng,
            limit=limit,
            max_distance_km=max_distance_km,
            fallback_distance_km=fallback_distance_km,
            preferred_country=preferred_country,
            min_results=min_results,
        )
    ]


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
