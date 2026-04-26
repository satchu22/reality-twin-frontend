"""Global event service delegating to the free/mock adapter."""

from __future__ import annotations

from ..integrations.events.event_adapter import fetch_global_events


def list_global_events() -> list[dict[str, object]]:
    """Return normalized global events from GDELT or mock fallback."""

    return fetch_global_events()
