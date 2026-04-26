"""Pydantic schemas for normalized external events."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class EventResponse(BaseModel):
    """Serialized event returned to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source: Literal["weather", "traffic", "satellite", "global_event"]
    event_type: str
    severity: Literal["low", "medium", "high"]
    lat: float
    lng: float
    radius_km: float
    description: str
    confidence: float
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    raw_payload: dict[str, Any]
