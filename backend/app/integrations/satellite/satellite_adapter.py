"""Satellite hazard adapter backed by NASA FIRMS when available."""

from __future__ import annotations

import csv
import io
import logging
from datetime import UTC, datetime, timedelta
from urllib.error import URLError
from urllib.request import urlopen

from ...core.config import settings

logger = logging.getLogger(__name__)


def fetch_satellite_hazards() -> list[dict[str, object]]:
    """Fetch NASA FIRMS hazard rows or return safe mock hazards."""

    data_url = settings.NASA_FIRMS_CSV_URL
    if data_url:
        try:
            with urlopen(data_url, timeout=12) as response:  # noqa: S310
                payload = response.read().decode("utf-8")

            reader = csv.DictReader(io.StringIO(payload))
            now = datetime.now(UTC)
            hazards: list[dict[str, object]] = []
            for row in list(reader)[:5]:
                lat = float(row.get("latitude", 0))
                lng = float(row.get("longitude", 0))
                if not lat and not lng:
                    continue

                hazards.append(
                    {
                        "source": "satellite",
                        "event_type": "satellite_hazard",
                        "severity": "high" if float(row.get("confidence", 0) or 0) >= 80 else "medium",
                        "lat": lat,
                        "lng": lng,
                        "radius_km": 220.0,
                        "description": "NASA FIRMS thermal anomaly alert",
                        "confidence": min(float(row.get("confidence", 75) or 75) / 100, 0.95),
                        "starts_at": now.isoformat(),
                        "ends_at": (now + timedelta(hours=10)).isoformat(),
                        "raw_payload": row,
                    }
                )

            if hazards:
                return hazards
            raise ValueError("No FIRMS hazards parsed")
        except (OSError, TimeoutError, URLError, ValueError) as exc:
            logger.warning("Satellite adapter falling back to mock data: %s", exc)
    else:
        logger.info("Satellite adapter using mock data because NASA_FIRMS_CSV_URL is not set")

    now = datetime.now(UTC)
    return [
        {
            "source": "satellite",
            "event_type": "satellite_hazard",
            "severity": "high",
            "lat": 34.5023,
            "lng": -119.4179,
            "radius_km": 180.0,
            "description": "Mock wildfire hazard from satellite monitoring",
            "confidence": 0.58,
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(hours=8)).isoformat(),
            "raw_payload": {"provider": "mock"},
        }
    ]
