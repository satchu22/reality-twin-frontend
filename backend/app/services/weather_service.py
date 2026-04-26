"""Weather service delegating to the free Open-Meteo adapter."""

from __future__ import annotations

from ..integrations.weather.weather_adapter import fetch_weather_events


def fetch_weather_event(*, lat: float, lng: float, route_name: str) -> dict[str, object] | None:
    """Retain the legacy single-event API for older callers."""

    events = fetch_weather_events(lat=lat, lng=lng, route_name=route_name)
    return events[0] if events else None
