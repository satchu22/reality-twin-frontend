"""Central application settings loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env", override=True)
load_dotenv(PROJECT_DIR / ".env.local", override=True)


def _resolve_database_url() -> str:
    raw_database_url = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BACKEND_DIR / 'realitytwin.db').as_posix()}",
    )

    sqlite_prefix = "sqlite:///./"
    if not raw_database_url.startswith(sqlite_prefix):
        return raw_database_url

    relative_path = Path(raw_database_url.removeprefix(sqlite_prefix))
    if relative_path.parts and relative_path.parts[0] == "backend":
        resolved_path = (PROJECT_DIR / relative_path).resolve()
    else:
        resolved_path = (BACKEND_DIR / relative_path).resolve()

    return f"sqlite:///{resolved_path.as_posix()}"


class Settings:
    """Simple settings object used across the backend."""

    DATABASE_URL = _resolve_database_url()
    CORS_ALLOW_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOW_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]
    TRANSACTION_REMINDER_HOUR = int(os.getenv("TRANSACTION_REMINDER_HOUR", "0"))
    TRANSACTION_REMINDER_MINUTE = int(os.getenv("TRANSACTION_REMINDER_MINUTE", "0"))
    LIVE_EVENT_REFRESH_MINUTES = int(os.getenv("LIVE_EVENT_REFRESH_MINUTES", "10"))
    MAPBOX_TRAFFIC_TOKEN = os.getenv("MAPBOX_TRAFFIC_TOKEN", "")
    NASA_FIRMS_CSV_URL = os.getenv("NASA_FIRMS_CSV_URL", "")


settings = Settings()
