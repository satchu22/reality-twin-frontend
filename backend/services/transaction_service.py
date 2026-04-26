"""Compatibility wrapper for the modular transaction service module."""

try:
    from app.services.transaction_service import *  # noqa: F401,F403
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.services.transaction_service import *  # noqa: F401,F403
