"""Compatibility exports for the SQLAlchemy database layer."""

try:
    from app.db import Base, SessionLocal, engine, get_db, init_db
except ModuleNotFoundError as exc:
    if exc.name not in {"app", "app.db"}:
        raise
    from backend.app.db import Base, SessionLocal, engine, get_db, init_db

__all__ = ["Base", "SessionLocal", "engine", "get_db", "init_db"]
