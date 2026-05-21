"""Airline route lookup service built on optional OpenFlights datasets."""

from __future__ import annotations

import csv
from functools import lru_cache

from ..integrations.openflights_adapter import (
    ensure_cached_airlines_dat,
    ensure_cached_routes_dat,
)


def _clean_code(value: str | None) -> str:
    return (value or "").strip().upper()


def _clean_text(value: str | None) -> str:
    return (value or "").strip()


@lru_cache(maxsize=1)
def load_airlines_by_code() -> dict[str, str]:
    path = ensure_cached_airlines_dat()
    if not path or not path.exists():
        return {}

    airlines: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 8:
                continue

            name = _clean_text(row[1])
            iata = _clean_code(row[3])
            icao = _clean_code(row[4])
            active = _clean_code(row[7])
            if active == "N":
                continue

            if iata and iata != "\\N":
                airlines[iata] = name
            if icao and icao != "\\N":
                airlines[icao] = name

    return airlines


@lru_cache(maxsize=1)
def load_route_index() -> dict[str, dict[str, dict[str, object]]]:
    path = ensure_cached_routes_dat()
    if not path or not path.exists():
        return {}

    airline_names = load_airlines_by_code()
    route_index: dict[str, dict[str, dict[str, object]]] = {}

    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 8:
                continue

            airline_code = _clean_code(row[0])
            source_code = _clean_code(row[2])
            destination_code = _clean_code(row[4])
            if (
                not airline_code
                or not source_code
                or not destination_code
                or airline_code == "\\N"
                or source_code == "\\N"
                or destination_code == "\\N"
            ):
                continue

            stops_raw = _clean_text(row[7])
            try:
                stops = int(stops_raw)
            except ValueError:
                stops = 0

            route_metadata = route_index.setdefault(source_code, {}).setdefault(
                destination_code,
                {
                    "airlines": set(),
                    "airline_codes": set(),
                    "stops": stops,
                },
            )

            route_metadata["airline_codes"].add(airline_code)
            route_metadata["airlines"].add(airline_names.get(airline_code, airline_code))
            route_metadata["stops"] = min(int(route_metadata["stops"]), stops)

    return route_index


def _direct_route_metadata(origin_iata: str, destination_iata: str) -> dict[str, object] | None:
    route_index = load_route_index()
    destination_map = route_index.get(_clean_code(origin_iata))
    if not destination_map:
        return None
    metadata = destination_map.get(_clean_code(destination_iata))
    if not metadata:
        return None
    return {
        "airlines": tuple(sorted(str(name) for name in metadata["airlines"])),
        "airline_codes": tuple(sorted(str(code) for code in metadata["airline_codes"])),
        "stops": int(metadata["stops"]),
    }


def _one_stop_route_metadata(origin_iata: str, destination_iata: str) -> dict[str, object] | None:
    route_index = load_route_index()
    origin_routes = route_index.get(_clean_code(origin_iata))
    if not origin_routes:
        return None

    destination_code = _clean_code(destination_iata)
    best_option: dict[str, object] | None = None

    for intermediate_code, first_leg in origin_routes.items():
        if int(first_leg.get("stops", 0)) != 0:
            continue

        second_leg = _direct_route_metadata(intermediate_code, destination_code)
        if not second_leg or int(second_leg.get("stops", 0)) != 0:
            continue

        airlines = tuple(
            sorted(
                {
                    *tuple(str(name) for name in first_leg["airlines"]),
                    *tuple(str(name) for name in second_leg["airlines"]),
                }
            )
        )
        candidate = {
            "airlines": airlines,
            "airline_codes": tuple(
                sorted(
                    {
                        *tuple(str(code) for code in first_leg["airline_codes"]),
                        *tuple(str(code) for code in second_leg["airline_codes"]),
                    }
                )
            ),
            "stops": 1,
            "via": intermediate_code,
        }

        if best_option is None or len(candidate["airlines"]) < len(best_option["airlines"]):
            best_option = candidate

    return best_option


def get_route_validation(origin_iata: str, destination_iata: str) -> dict[str, object]:
    direct_route = _direct_route_metadata(origin_iata, destination_iata)
    if direct_route and int(direct_route.get("stops", 0)) == 0:
        return {
            "source": "openflights",
            "direct_route_known": True,
            "possible_airlines": list(direct_route["airlines"]),
            "possible_airline_codes": list(direct_route["airline_codes"]),
            "stops": 0,
            "message": "Direct route validated from OpenFlights route data.",
        }

    one_stop_route = _one_stop_route_metadata(origin_iata, destination_iata)
    if one_stop_route:
        return {
            "source": "openflights",
            "direct_route_known": False,
            "possible_airlines": list(one_stop_route["airlines"]),
            "possible_airline_codes": list(one_stop_route["airline_codes"]),
            "stops": 1,
            "via": one_stop_route["via"],
            "message": (
                f"No direct route found in OpenFlights; using a one-stop candidate via "
                f"{one_stop_route['via']}."
            ),
        }

    if load_route_index():
        return {
            "source": "estimated",
            "direct_route_known": False,
            "possible_airlines": [],
            "possible_airline_codes": [],
            "stops": 0,
            "message": "Route validation unavailable — using estimated air freight route.",
        }

    return {
        "source": "estimated",
        "direct_route_known": False,
        "possible_airlines": [],
        "possible_airline_codes": [],
        "stops": 0,
        "message": "Route validation unavailable — using estimated air freight route.",
    }
