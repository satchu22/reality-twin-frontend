"""Compatibility wrapper for the modular scheduler service module."""

try:
    from app.services.scheduler_service import *  # noqa: F401,F403
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.services.scheduler_service import *  # noqa: F401,F403
