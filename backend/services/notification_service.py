"""Compatibility wrapper for the modular notification service module."""

try:
    from app.services.notification_service import *  # noqa: F401,F403
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.services.notification_service import *  # noqa: F401,F403
