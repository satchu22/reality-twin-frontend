"""OurAirports dataset adapter with local cache support."""

from __future__ import annotations

import logging
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

logger = logging.getLogger(__name__)

OURAIRPORTS_AIRPORTS_CSV_URL = (
    "https://davidmegginson.github.io/ourairports-data/airports.csv"
)
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CACHE_DIR = DATA_DIR / "cache"
AIRPORTS_CACHE_PATH = CACHE_DIR / "airports.csv"


def get_cached_airports_csv_path() -> Path | None:
    if AIRPORTS_CACHE_PATH.exists():
        return AIRPORTS_CACHE_PATH
    return None


def ensure_cached_airports_csv() -> Path | None:
    cached_path = get_cached_airports_csv_path()
    if cached_path:
        return cached_path

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        with urlopen(OURAIRPORTS_AIRPORTS_CSV_URL, timeout=30) as response:  # noqa: S310
            AIRPORTS_CACHE_PATH.write_bytes(response.read())
    except (OSError, TimeoutError, URLError) as exc:
        logger.warning("Unable to download OurAirports airports.csv: %s", exc)
        return None

    return AIRPORTS_CACHE_PATH if AIRPORTS_CACHE_PATH.exists() else None
