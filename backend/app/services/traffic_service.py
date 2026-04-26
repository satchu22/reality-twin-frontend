"""Traffic service delegating to the Mapbox free-tier adapter."""

from __future__ import annotations

from ..integrations.traffic.traffic_adapter import fetch_traffic_events


def fetch_traffic_event(*, lat: float, lng: float, route_name: str) -> dict[str, object] | None:
    """Retain the legacy single-event API for older callers."""

    events = fetch_traffic_events(lat=lat, lng=lng, route_name=route_name)
    return events[0] if events else None
