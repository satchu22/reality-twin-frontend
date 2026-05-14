"""Estimated maritime route helpers using curated ocean waypoint templates."""

from __future__ import annotations

from dataclasses import dataclass

from .nearest_hub import Hub, haversine_distance_km


Coordinate = list[float]


@dataclass(frozen=True)
class SeaRoute:
    geometry: list[Coordinate]
    distance_km: float
    label: str


def _round_coordinate(lng: float, lat: float) -> Coordinate:
    return [round(lng, 6), round(lat, 6)]


def _polyline_distance_km(coordinates: list[Coordinate]) -> float:
    total = 0.0
    for index in range(len(coordinates) - 1):
        start = coordinates[index]
        end = coordinates[index + 1]
        total += haversine_distance_km(start[1], start[0], end[1], end[0])
    return round(total, 1)


def _dedupe_coordinates(coordinates: list[Coordinate]) -> list[Coordinate]:
    deduped: list[Coordinate] = []
    for coordinate in coordinates:
        normalized = _round_coordinate(coordinate[0], coordinate[1])
        if not deduped or deduped[-1] != normalized:
            deduped.append(normalized)
    return deduped


def _east_west_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [-73.5, 39.0],
            [-76.0, 30.0],
            [-80.0, 23.0],
            [-79.9, 9.1],
            [-79.6, 8.9],
            [-90.0, 12.0],
            [-110.0, 20.0],
            [-125.0, 32.0],
            [destination.lng, destination.lat],
        ]
    )


def _west_east_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    return list(reversed(_east_west_template(destination, origin)))


def _east_coast_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    offshore_origin_lng = min(origin.lng + 1.2, -66.0)
    offshore_destination_lng = min(destination.lng + 1.2, -66.0)
    mid_lat = round((origin.lat + destination.lat) / 2, 2)
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [offshore_origin_lng, max(min(origin.lat - 0.8, 44.0), 24.0)],
            [-74.5, mid_lat],
            [offshore_destination_lng, max(min(destination.lat - 0.8, 44.0), 24.0)],
            [destination.lng, destination.lat],
        ]
    )


def _west_coast_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    mid_lat = round((origin.lat + destination.lat) / 2, 2)
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [-124.8, max(min(origin.lat - 0.4, 49.0), 30.0)],
            [-125.3, mid_lat],
            [-124.6, max(min(destination.lat - 0.4, 49.0), 30.0)],
            [destination.lng, destination.lat],
        ]
    )


def _gulf_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    mid_lng = round((origin.lng + destination.lng) / 2, 2)
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [origin.lng, max(origin.lat - 1.2, 24.0)],
            [mid_lng, 25.8],
            [destination.lng, max(destination.lat - 1.2, 24.0)],
            [destination.lng, destination.lat],
        ]
    )


def _east_gulf_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [-79.5, 31.0],
            [-80.3, 26.0],
            [-84.7, 24.6],
            [-89.8, 26.1],
            [destination.lng, destination.lat],
        ]
    )


def _gulf_east_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    return list(reversed(_east_gulf_template(destination, origin)))


def _gulf_west_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [-90.0, 25.5],
            [-86.0, 23.5],
            [-79.9, 9.1],
            [-79.6, 8.9],
            [-96.0, 14.0],
            [-112.0, 22.0],
            [-121.0, 30.0],
            [destination.lng, destination.lat],
        ]
    )


def _west_gulf_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    return list(reversed(_gulf_west_template(destination, origin)))


def _fallback_template(origin: Hub, destination: Hub) -> list[Coordinate]:
    midpoint_lng = round((origin.lng + destination.lng) / 2, 2)
    midpoint_lat = round((origin.lat + destination.lat) / 2, 2)
    offshore_bias = -4.0 if origin.lng < destination.lng else 4.0
    return _dedupe_coordinates(
        [
            [origin.lng, origin.lat],
            [origin.lng + (0.8 if origin.lng < 0 else -0.8), origin.lat - 0.8],
            [midpoint_lng + offshore_bias, midpoint_lat - 2.0],
            [destination.lng + (-0.8 if destination.lng < 0 else 0.8), destination.lat - 0.8],
            [destination.lng, destination.lat],
        ]
    )


def build_estimated_sea_route(origin: Hub, destination: Hub) -> SeaRoute:
    if origin.code == destination.code:
        geometry = _dedupe_coordinates(
            [
                [origin.lng, origin.lat],
                [destination.lng, destination.lat],
            ]
        )
        return SeaRoute(
            geometry=geometry,
            distance_km=_polyline_distance_km(geometry),
            label="estimated maritime route",
        )

    origin_coast = origin.coast or "global"
    destination_coast = destination.coast or "global"

    if origin_coast == "east" and destination_coast == "west":
        geometry = _east_west_template(origin, destination)
    elif origin_coast == "west" and destination_coast == "east":
        geometry = _west_east_template(origin, destination)
    elif origin_coast == "east" and destination_coast == "east":
        geometry = _east_coast_template(origin, destination)
    elif origin_coast == "west" and destination_coast == "west":
        geometry = _west_coast_template(origin, destination)
    elif origin_coast == "gulf" and destination_coast == "gulf":
        geometry = _gulf_template(origin, destination)
    elif origin_coast == "east" and destination_coast == "gulf":
        geometry = _east_gulf_template(origin, destination)
    elif origin_coast == "gulf" and destination_coast == "east":
        geometry = _gulf_east_template(origin, destination)
    elif origin_coast == "gulf" and destination_coast == "west":
        geometry = _gulf_west_template(origin, destination)
    elif origin_coast == "west" and destination_coast == "gulf":
        geometry = _west_gulf_template(origin, destination)
    else:
        geometry = _fallback_template(origin, destination)

    return SeaRoute(
        geometry=geometry,
        distance_km=_polyline_distance_km(geometry),
        label="estimated maritime route",
    )
