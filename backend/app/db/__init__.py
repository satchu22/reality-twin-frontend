"""Database package exports."""

from .base import Base
from .session import SessionLocal, engine, get_db


def init_db() -> None:
    """Create all ORM-managed tables for the configured engine."""

    Base.metadata.create_all(bind=engine)


__all__ = ["Base", "SessionLocal", "engine", "get_db", "init_db"]
