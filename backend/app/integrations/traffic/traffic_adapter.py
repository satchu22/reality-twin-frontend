"""Traffic adapter backed by Mapbox with deterministic mock fallback."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from ...core.config import settings

logger = logging.getLogger(__name__)


def _severity_from_congestion(congestion_score: float) -> str:
    if congestion_score >= 0.8:
        return "high"
    if congestion_score >= 0.4:
        return "medium"
    return "low"


def fetch_traffic_events(*, lat: float, lng: float, route_name: str) -> list[dict[str, object]]:
    """Estimate traffic congestion from Mapbox or return safe mock data."""

    token = settings.MAPBOX_TRAFFIC_TOKEN
    if token:
        destination_lng = lng + 0.14
        destination_lat = lat + 0.09
        query = urlencode({"access_token": token, "overview": "false"})
        driving_url = (
            "https://api.mapbox.com/directions/v5/mapbox/driving/"
            f"{lng},{lat};{destination_lng},{destination_lat}?{query}"
        )
        traffic_url = (
            "https://api.mapbox.com/directions/v5/mapbox/driving-traffic/"
            f"{lng},{lat};{destination_lng},{destination_lat}?{query}"
        )

        try:
            with urlopen(driving_url, timeout=10) as response:  # noqa: S310
                driving_payload = json.loads(response.read().decode("utf-8"))
            with urlopen(traffic_url, timeout=10) as response:  # noqa: S310
                traffic_payload = json.loads(response.read().decode("utf-8"))

            base_duration = float(driving_payload["routes"][0]["duration"])
            traffic_duration = float(traffic_payload["routes"][0]["duration"])
            congestion_score = max(traffic_duration - base_duration, 0) / max(base_duration, 1)
            severity = _severity_from_congestion(congestion_score)

            if severity == "low":
                return []

            now = datetime.now(UTC)
            return [
                {
                    "source": "traffic",
                    "event_type": "traffic",
                    "severity": severity,
                    "lat": lat,
                    "lng": lng,
                    "radius_km": 90.0 if severity == "medium" else 150.0,
                    "description": f"Mapbox traffic slowdown near {route_name}",
                    "confidence": 0.82,
                    "starts_at": now.isoformat(),
                    "ends_at": (now + timedelta(hours=3)).isoformat(),
                    "raw_payload": {
                        "driving": driving_payload,
                        "traffic": traffic_payload,
                        "congestion_score": congestion_score,
                    },
                }
            ]
        except (OSError, TimeoutError, URLError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("Traffic adapter falling back to mock data: %s", exc)
    else:
        logger.info("Traffic adapter using mock data because MAPBOX_TRAFFIC_TOKEN is not set")

    seed = int(abs(lat * 10) + abs(lng * 10)) % 4
    if seed == 0:
        return []

    now = datetime.now(UTC)
    severity = "high" if seed == 3 else "medium"
    return [
        {
            "source": "traffic",
            "event_type": "traffic",
            "severity": severity,
            "lat": lat + 0.08,
            "lng": lng - 0.08,
            "radius_km": 110.0 if severity == "medium" else 170.0,
            "description": f"Mock congestion hotspot affecting {route_name}",
            "confidence": 0.5,
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(hours=2)).isoformat(),
            "raw_payload": {"provider": "mock", "route_name": route_name},
        }
    ]
