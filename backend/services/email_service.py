"""Compatibility wrapper for the modular email service module."""

try:
    from app.services.email_service import *  # noqa: F401,F403
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.services.email_service import *  # noqa: F401,F403
