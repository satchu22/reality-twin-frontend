"""Compatibility exports for the modular database package."""

try:
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.db.base import Base
    from backend.app.db.session import SessionLocal, engine
