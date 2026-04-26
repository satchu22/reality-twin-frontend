"""Compatibility wrapper for the modular simulation router."""

try:
    from app.api.routes.simulate import router
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.api.routes.simulate import router
