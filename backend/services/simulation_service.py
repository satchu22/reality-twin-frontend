"""Compatibility wrapper for the modular simulation service module."""

try:
    from app.services.simulation_service import *  # noqa: F401,F403
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.services.simulation_service import *  # noqa: F401,F403
