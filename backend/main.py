"""Compatibility entrypoint that forwards to the modular app package."""

try:
    from app.main import app
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.main import app
