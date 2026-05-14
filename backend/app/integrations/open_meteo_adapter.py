"""Open-Meteo forecast adapter for route weather risk."""

from __future__ import annotations

import json
import logging
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def get_forecast_for_point(lat: float, lng: float) -> dict[str, object]:
    query = urlencode(
        {
            "latitude": lat,
            "longitude": lng,
            "hourly": ",".join(
                [
                    "precipitation",
                    "rain",
                    "snowfall",
                    "wind_speed_10m",
                    "wind_gusts_10m",
                    "visibility",
                    "weather_code",
                ]
            ),
            "forecast_days": 2,
            "timezone": "auto",
        }
    )
    url = f"{OPEN_METEO_FORECAST_URL}?{query}"

    try:
        with urlopen(url, timeout=10) as response:  # noqa: S310
            return json.loads(response.read().decode("utf-8"))
    except (OSError, TimeoutError, URLError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Open-Meteo forecast lookup failed for (%s, %s): %s", lat, lng, exc)
        return {}
