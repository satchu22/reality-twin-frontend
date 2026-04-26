"""Pydantic schemas for notification endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    """Request body for creating a manual notification."""

    user_id: int = Field(gt=0)
    message: str = Field(min_length=1, max_length=500)
    type: Literal["info", "warning", "critical"]


class NotificationResponse(BaseModel):
    """Serialized notification returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    message: str
    type: Literal["info", "warning", "critical"]
    is_read: bool
    created_at: datetime
