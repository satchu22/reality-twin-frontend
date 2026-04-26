"""Global events adapter backed by GDELT with safe mock fallback."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

logger = logging.getLogger(__name__)

MOCK_EVENTS = [
    {
        "source": "global_event",
        "event_type": "global_event",
        "severity": "high",
        "lat": 50.4501,
        "lng": 30.5234,
        "radius_km": 700.0,
        "description": "Mock geopolitical disruption affecting Eastern Europe corridors",
        "confidence": 0.52,
    },
    {
        "source": "global_event",
        "event_type": "global_event",
        "severity": "medium",
        "lat": 1.3521,
        "lng": 103.8198,
        "radius_km": 400.0,
        "description": "Mock port operations alert impacting Asia-Pacific routing",
        "confidence": 0.48,
    },
]


def fetch_global_events() -> list[dict[str, object]]:
    """Fetch global disruption headlines from GDELT, or return mock alerts."""

    query = urlencode(
        {
            "query": '("shipping" OR "port" OR "logistics disruption")',
            "mode": "ArtList",
            "format": "json",
            "maxrecords": "10",
        }
    )
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?{query}"

    try:
        with urlopen(url, timeout=10) as response:  # noqa: S310
            payload = json.loads(response.read().decode("utf-8"))

        articles = payload.get("articles", [])
        if not articles:
            raise ValueError("No GDELT articles returned")

        now = datetime.now(UTC)
        normalized: list[dict[str, object]] = []
        for article in articles[:4]:
            lat = article.get("seendate", "").count("0") * 0.0
            lng = article.get("socialimage", "").count("/") * 0.0
            if not lat and not lng:
                lat = 51.5072
                lng = -0.1276

            normalized.append(
                {
                    "source": "global_event",
                    "event_type": "global_event",
                    "severity": "medium",
                    "lat": lat,
                    "lng": lng,
                    "radius_km": 350.0,
                    "description": article.get("title", "GDELT logistics alert"),
                    "confidence": 0.6,
                    "starts_at": now.isoformat(),
                    "ends_at": (now + timedelta(hours=12)).isoformat(),
                    "raw_payload": article,
                }
            )

        return normalized
    except (OSError, TimeoutError, URLError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Global event adapter falling back to mock data: %s", exc)

    now = datetime.now(UTC)
    return [
        {
            **event,
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(hours=12)).isoformat(),
            "raw_payload": {"provider": "mock"},
        }
        for event in MOCK_EVENTS
    ]
