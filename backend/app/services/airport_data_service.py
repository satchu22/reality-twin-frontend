"""Airport data loading and normalization service."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from ..integrations.ourairports_adapter import ensure_cached_airports_csv

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PREFERRED_AIRPORT_TYPES = {"large_airport", "medium_airport"}
FALLBACK_AIRPORT_TYPES = {"small_airport"}
EXCLUDED_AIRPORT_TYPES = {"closed", "heliport", "balloonport", "seaplane_base"}
COUNTRY_ALIASES = {
    "UNITED STATES": "US",
    "USA": "US",
    "UNITED STATES OF AMERICA": "US",
}


@dataclass(frozen=True)
class AirportRecord:
    id: str
    ident: str
    iata: str
    icao: str
    name: str
    type: str
    lat: float
    lng: float
    continent: str
    iso_country: str
    iso_region: str
    municipality: str
    scheduled_service: bool
    gps_code: str
    local_code: str


@dataclass(frozen=True)
class NearestAirportRecord:
    airport: AirportRecord
    distance_km: float


def _clean_code(value: str | None) -> str:
    return (value or "").strip().upper()


def _clean_text(value: str | None) -> str:
    return (value or "").strip()


def _parse_float(value: str | None) -> float | None:
    try:
        return float((value or "").strip())
    except (TypeError, ValueError):
        return None


def _scheduled_service_flag(value: str | None) -> bool:
    return _clean_text(value).lower() == "yes"


def _normalize_ourairports_row(row: dict[str, str]) -> AirportRecord | None:
    airport_type = _clean_text(row.get("type")).lower()
    if not airport_type or airport_type in EXCLUDED_AIRPORT_TYPES:
        return None

    lat = _parse_float(row.get("latitude_deg"))
    lng = _parse_float(row.get("longitude_deg"))
    if lat is None or lng is None:
        return None

    ident = _clean_code(row.get("ident"))
    iata = _clean_code(row.get("iata_code"))
    icao = _clean_code(row.get("icao_code")) or ident
    airport_id = _clean_text(row.get("id")) or ident or iata or icao
    if not airport_id:
        return None

    return AirportRecord(
        id=airport_id,
        ident=ident or icao or iata,
        iata=iata,
        icao=icao,
        name=_clean_text(row.get("name")) or ident or iata or icao,
        type=airport_type,
        lat=lat,
        lng=lng,
        continent=_clean_code(row.get("continent")),
        iso_country=_clean_code(row.get("iso_country")),
        iso_region=_clean_code(row.get("iso_region")),
        municipality=_clean_text(row.get("municipality")),
        scheduled_service=_scheduled_service_flag(row.get("scheduled_service")),
        gps_code=_clean_code(row.get("gps_code")),
        local_code=_clean_code(row.get("local_code")),
    )


def _normalize_json_airport(record: dict[str, object]) -> AirportRecord | None:
    code = _clean_code(str(record.get("code") or ""))
    if not code:
        return None

    lat = record.get("lat")
    lng = record.get("lng")
    try:
        lat_value = float(lat)
        lng_value = float(lng)
    except (TypeError, ValueError):
        return None

    return AirportRecord(
        id=code,
        ident=code,
        iata=code,
        icao=code,
        name=_clean_text(str(record.get("name") or code)),
        type="medium_airport",
        lat=lat_value,
        lng=lng_value,
        continent="",
        iso_country=_clean_code(str(record.get("country") or "")),
        iso_region="",
        municipality="",
        scheduled_service=True,
        gps_code=code,
        local_code=code,
    )


def _normalize_openflights_row(row: dict[str, str]) -> AirportRecord | None:
    if _clean_text(row.get("type")).lower() != "airport":
        return None

    iata = _clean_code(row.get("iata"))
    if not iata or iata == "\\N":
        return None

    lat = _parse_float(row.get("latitude"))
    lng = _parse_float(row.get("longitude"))
    if lat is None or lng is None:
        return None

    icao = _clean_code(row.get("icao"))
    country = _clean_code(row.get("country"))
    ident = icao or iata

    return AirportRecord(
        id=_clean_text(row.get("airport_id")) or ident,
        ident=ident,
        iata=iata,
        icao=icao,
        name=_clean_text(row.get("name")) or iata,
        type="medium_airport",
        lat=lat,
        lng=lng,
        continent="",
        iso_country=country,
        iso_region="",
        municipality=_clean_text(row.get("city")),
        scheduled_service=True,
        gps_code=icao or iata,
        local_code=iata,
    )


def _merge_records(*collections: tuple[AirportRecord, ...]) -> tuple[AirportRecord, ...]:
    merged: dict[str, AirportRecord] = {}
    for collection in collections:
        for record in collection:
            key = record.iata or record.icao or record.ident or record.id
            if not key:
                continue
            if key not in merged:
                merged[key] = record
    return tuple(merged.values())


def _load_ourairports_records() -> tuple[AirportRecord, ...]:
    csv_path = ensure_cached_airports_csv()
    if not csv_path or not csv_path.exists():
        return ()

    records: list[AirportRecord] = []
    with csv_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            record = _normalize_ourairports_row(row)
            if record:
                records.append(record)
    return tuple(records)


def _load_json_fallback_records() -> tuple[AirportRecord, ...]:
    json_path = DATA_DIR / "airports.json"
    if not json_path.exists():
        return ()

    with json_path.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    records: list[AirportRecord] = []
    for record in payload:
        if not isinstance(record, dict):
            continue
        normalized = _normalize_json_airport(record)
        if normalized:
            records.append(normalized)
    return tuple(records)


def _load_openflights_fallback_records() -> tuple[AirportRecord, ...]:
    csv_path = DATA_DIR / "airports_openflights.csv"
    if not csv_path.exists():
        return ()

    records: list[AirportRecord] = []
    with csv_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            record = _normalize_openflights_row(row)
            if record:
                records.append(record)
    return tuple(records)


@lru_cache(maxsize=1)
def load_airport_records() -> tuple[AirportRecord, ...]:
    ourairports_records = _load_ourairports_records()
    if ourairports_records:
        return _merge_records(
            ourairports_records,
            _load_json_fallback_records(),
            _load_openflights_fallback_records(),
        )

    return _merge_records(
        _load_json_fallback_records(),
        _load_openflights_fallback_records(),
    )


@lru_cache(maxsize=1)
def load_airports_by_code() -> dict[str, AirportRecord]:
    airports_by_code: dict[str, AirportRecord] = {}
    for record in load_airport_records():
        for code in (record.iata, record.icao, record.ident, record.id):
            if code and code not in airports_by_code:
                airports_by_code[code] = record
    return airports_by_code


def get_airport_record_by_code(code: str | None) -> AirportRecord | None:
    if not code:
        return None
    return load_airports_by_code().get(_clean_code(code))


def serialize_airport_record(
    record: AirportRecord,
    *,
    distance_km: float | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": record.id,
        "ident": record.ident,
        "iata": record.iata,
        "icao": record.icao,
        "name": record.name,
        "type": record.type,
        "lat": record.lat,
        "lng": record.lng,
        "continent": record.continent,
        "iso_country": record.iso_country,
        "iso_region": record.iso_region,
        "municipality": record.municipality,
        "scheduled_service": record.scheduled_service,
        "gps_code": record.gps_code,
        "local_code": record.local_code,
    }
    if distance_km is not None:
        payload["distance_km"] = round(distance_km, 1)
    return payload


def _distance_km(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
) -> float:
    from math import atan2, cos, radians, sin, sqrt

    earth_radius_km = 6371.0
    start_lat_radians = radians(start_lat)
    end_lat_radians = radians(end_lat)
    delta_lat = radians(end_lat - start_lat)
    delta_lng = radians(end_lng - start_lng)
    haversine = (
        sin(delta_lat / 2) ** 2
        + cos(start_lat_radians) * cos(end_lat_radians) * sin(delta_lng / 2) ** 2
    )
    arc = 2 * atan2(sqrt(haversine), sqrt(1 - haversine))
    return earth_radius_km * arc


def _apply_distance_limit(
    ranked: list[AirportRecord],
    lat: float,
    lng: float,
    distance_limit: float | None,
) -> list[AirportRecord]:
    if distance_limit is None:
        return ranked
    return [
        record
        for record in ranked
        if _distance_km(lat, lng, record.lat, record.lng) <= distance_limit
    ]


def _rank_airports(records: tuple[AirportRecord, ...], lat: float, lng: float) -> list[AirportRecord]:
    return sorted(
        records,
        key=lambda record: (
            _distance_km(lat, lng, record.lat, record.lng),
            0 if record.type in PREFERRED_AIRPORT_TYPES else 1,
            0 if record.scheduled_service else 1,
            0 if record.iata else 1,
            record.name,
        ),
    )


def _country_matches(record: AirportRecord, preferred_country: str) -> bool:
    normalized_preference = _clean_code(preferred_country)
    normalized_preference = COUNTRY_ALIASES.get(normalized_preference, normalized_preference)
    record_country = _clean_code(record.iso_country)
    return bool(record_country) and record_country == normalized_preference


def select_airport_records(
    lat: float,
    lng: float,
    *,
    limit: int = 3,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[AirportRecord]:
    all_records = load_airport_records()
    if preferred_country:
        preferred_records = tuple(
            record
            for record in all_records
            if _country_matches(record, preferred_country)
        )
        records = preferred_records or all_records
    else:
        records = all_records

    preferred_records = tuple(
        record
        for record in records
        if record.type in PREFERRED_AIRPORT_TYPES
        and record.iata
        and record.scheduled_service
    )
    secondary_records = tuple(
        record
        for record in records
        if record.type in PREFERRED_AIRPORT_TYPES and record.iata
    )
    tertiary_records = tuple(
        record for record in records if record.type in PREFERRED_AIRPORT_TYPES
    )
    small_airport_records = tuple(
        record
        for record in records
        if record.type in FALLBACK_AIRPORT_TYPES and record.iata
    )

    tiers = [
        _rank_airports(preferred_records, lat, lng),
        _rank_airports(secondary_records, lat, lng),
        _rank_airports(tertiary_records, lat, lng),
        _rank_airports(small_airport_records, lat, lng),
    ]

    candidates: list[AirportRecord] = []
    seen_codes: set[str] = set()

    def extend_from_tiers(distance_limit: float | None) -> list[AirportRecord]:
        selected: list[AirportRecord] = []
        selected_codes: set[str] = set()
        for tier in tiers:
            for record in _apply_distance_limit(tier, lat, lng, distance_limit):
                code = record.iata or record.icao or record.ident or record.id
                if code in selected_codes:
                    continue
                selected_codes.add(code)
                selected.append(record)
                if len(selected) >= limit:
                    return selected
        return selected

    primary = extend_from_tiers(max_distance_km)
    if len(primary) >= min(limit, min_results):
        return primary[:limit]

    fallback = extend_from_tiers(fallback_distance_km)
    if len(fallback) >= min(limit, min_results):
        return fallback[:limit]

    for tier in tiers:
        for record in tier:
            code = record.iata or record.icao or record.ident or record.id
            if code in seen_codes:
                continue
            seen_codes.add(code)
            candidates.append(record)
            if len(candidates) >= limit:
                return candidates

    return candidates


def find_nearest_airport_records(
    lat: float,
    lng: float,
    *,
    limit: int = 5,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[NearestAirportRecord]:
    selected_records = select_airport_records(
        lat,
        lng,
        limit=limit,
        max_distance_km=max_distance_km,
        fallback_distance_km=fallback_distance_km,
        preferred_country=preferred_country,
        min_results=min_results,
    )
    return [
        NearestAirportRecord(
            airport=record,
            distance_km=_distance_km(lat, lng, record.lat, record.lng),
        )
        for record in selected_records
    ]


def find_nearest_airports_payload(
    lat: float,
    lng: float,
    *,
    limit: int = 5,
    max_distance_km: float | None = None,
    fallback_distance_km: float | None = None,
    preferred_country: str | None = None,
    min_results: int = 2,
) -> list[dict[str, object]]:
    return [
        serialize_airport_record(result.airport, distance_km=result.distance_km)
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
