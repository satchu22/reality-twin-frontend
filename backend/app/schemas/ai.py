"""Pydantic schemas for AI explanation endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AIExplainRequest(BaseModel):
    """Request payload for AI route explanations."""

    route_options: list[dict[str, Any]] = Field(default_factory=list)
    events: list[dict[str, Any]] = Field(default_factory=list)


class AIExplainResponse(BaseModel):
    """Response payload for AI route explanations."""

    explanation: str = ""
