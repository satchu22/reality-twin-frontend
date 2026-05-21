"""OpenFlights dataset adapter with local cache support."""

from __future__ import annotations

import logging
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CACHE_DIR = DATA_DIR / "cache"

OPENFLIGHTS_ROUTES_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat"
OPENFLIGHTS_AIRLINES_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat"

ROUTES_CACHE_PATH = CACHE_DIR / "routes.dat"
AIRLINES_CACHE_PATH = CACHE_DIR / "airlines.dat"


def _resolve_local_dataset(cache_path: Path, bundled_file_name: str) -> Path | None:
    if cache_path.exists():
        return cache_path

    bundled_path = DATA_DIR / bundled_file_name
    if bundled_path.exists():
        return bundled_path

    return None


def _download_to_cache(url: str, destination: Path) -> Path | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        with urlopen(url, timeout=30) as response:  # noqa: S310
            destination.write_bytes(response.read())
    except (OSError, TimeoutError, URLError) as exc:
        logger.warning("Unable to download OpenFlights dataset %s: %s", destination.name, exc)
        return None

    return destination if destination.exists() else None


def ensure_cached_routes_dat() -> Path | None:
    existing = _resolve_local_dataset(ROUTES_CACHE_PATH, "routes.dat")
    if existing:
        return existing
    return _download_to_cache(OPENFLIGHTS_ROUTES_URL, ROUTES_CACHE_PATH)


def ensure_cached_airlines_dat() -> Path | None:
    existing = _resolve_local_dataset(AIRLINES_CACHE_PATH, "airlines.dat")
    if existing:
        return existing
    return _download_to_cache(OPENFLIGHTS_AIRLINES_URL, AIRLINES_CACHE_PATH)
