"""NOAA / National Weather Service alerts adapter."""

from __future__ import annotations

import json
import logging
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

NWS_BASE_URL = "https://api.weather.gov"
NWS_HEADERS = {
    "Accept": "application/geo+json",
    "User-Agent": "RealityTwin/0.1 (local-dev weather risk)",
}


def _fetch_json(url: str) -> dict[str, object]:
    request = Request(url, headers=NWS_HEADERS)
    with urlopen(request, timeout=10) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def _extract_zone_id(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.rstrip("/").rsplit("/", maxsplit=1)[-1] or None


def _is_us_point(lat: float, lng: float) -> bool:
    return 18.0 <= lat <= 72.0 and -179.9 <= lng <= -60.0


def _fetch_alert_features(url: str) -> list[dict[str, object]]:
    try:
        payload = _fetch_json(url)
    except (OSError, TimeoutError, URLError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("NWS alert lookup failed for %s: %s", url, exc)
        return []

    features = payload.get("features")
    if not isinstance(features, list):
        return []

    alerts: list[dict[str, object]] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            continue
        alerts.append(
            {
                "id": properties.get("id") or properties.get("@id"),
                "event": properties.get("event", "Unknown alert"),
                "severity": properties.get("severity", "Unknown"),
                "certainty": properties.get("certainty", "Unknown"),
                "urgency": properties.get("urgency", "Unknown"),
                "headline": properties.get("headline") or properties.get("description") or "",
                "description": properties.get("description") or "",
                "instruction": properties.get("instruction") or "",
                "area_desc": properties.get("areaDesc") or "",
            }
        )
    return alerts


def get_us_alerts_for_point(lat: float, lng: float) -> list[dict[str, object]]:
    if not _is_us_point(lat, lng):
        return []

    try:
        points_payload = _fetch_json(f"{NWS_BASE_URL}/points/{lat},{lng}")
    except (OSError, TimeoutError, URLError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("NWS points lookup failed for (%s, %s): %s", lat, lng, exc)
        return []

    properties = points_payload.get("properties")
    if not isinstance(properties, dict):
        return []

    zone_candidates = [
        _extract_zone_id(properties.get("forecastZone")),
        _extract_zone_id(properties.get("county")),
        _extract_zone_id(properties.get("fireWeatherZone")),
    ]

    alerts: list[dict[str, object]] = []
    seen_alert_ids: set[str] = set()

    for zone_id in zone_candidates:
        if not zone_id:
            continue

        zone_alerts = _fetch_alert_features(
            f"{NWS_BASE_URL}/alerts/active?{urlencode({'zone': zone_id})}"
        )
        for alert in zone_alerts:
            alert_id = str(alert.get("id") or "")
            if alert_id and alert_id in seen_alert_ids:
                continue
            if alert_id:
                seen_alert_ids.add(alert_id)
            alerts.append(alert)

    if alerts:
        return alerts

    return _fetch_alert_features(
        f"{NWS_BASE_URL}/alerts/active?{urlencode({'point': f'{lat},{lng}'})}"
    )
