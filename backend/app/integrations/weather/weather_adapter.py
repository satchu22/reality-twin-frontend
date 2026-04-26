"""Weather adapter backed by Open-Meteo with deterministic mock fallback."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

logger = logging.getLogger(__name__)


def _severity_from_weather(weather_code: int, wind_speed: float) -> str:
    if weather_code >= 95 or wind_speed >= 18:
        return "high"
    if weather_code >= 60 or wind_speed >= 10:
        return "medium"
    return "low"


def fetch_weather_events(*, lat: float, lng: float, route_name: str) -> list[dict[str, object]]:
    """Fetch nearby severe weather from Open-Meteo or return safe mock data."""

    query = urlencode(
        {
            "latitude": lat,
            "longitude": lng,
            "current": "weather_code,wind_speed_10m",
            "timezone": "UTC",
        }
    )
    url = f"https://api.open-meteo.com/v1/forecast?{query}"

    try:
        with urlopen(url, timeout=10) as response:  # noqa: S310
            payload = json.loads(response.read().decode("utf-8"))

        current = payload.get("current", {})
        weather_code = int(current.get("weather_code", 0))
        wind_speed = float(current.get("wind_speed_10m", 0))
        severity = _severity_from_weather(weather_code, wind_speed)

        if severity == "low":
            return []

        now = datetime.now(UTC)
        return [
            {
                "source": "weather",
                "event_type": "weather",
                "severity": severity,
                "lat": lat,
                "lng": lng,
                "radius_km": 280.0 if severity == "medium" else 420.0,
                "description": f"Open-Meteo weather alert near {route_name}",
                "confidence": 0.8 if severity == "medium" else 0.9,
                "starts_at": now.isoformat(),
                "ends_at": (now + timedelta(hours=8)).isoformat(),
                "raw_payload": payload,
            }
        ]
    except (OSError, TimeoutError, URLError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Weather adapter falling back to mock data: %s", exc)

    if int(abs(lat) + abs(lng)) % 3 != 0:
        return []

    now = datetime.now(UTC)
    severity = "high" if int(abs(lat) * 10) % 2 == 0 else "medium"
    return [
        {
            "source": "weather",
            "event_type": "weather",
            "severity": severity,
            "lat": lat,
            "lng": lng,
            "radius_km": 300.0 if severity == "medium" else 450.0,
            "description": f"Mock weather system affecting {route_name}",
            "confidence": 0.55,
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(hours=6)).isoformat(),
            "raw_payload": {"provider": "mock", "route_name": route_name},
        }
    ]
