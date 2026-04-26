"""Static free datasets for ports and airports."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@lru_cache(maxsize=1)
def load_ports() -> list[dict[str, str]]:
    with (DATA_DIR / "ports.csv").open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


@lru_cache(maxsize=1)
def load_airports() -> list[dict[str, str]]:
    with (DATA_DIR / "airports_openflights.csv").open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))
