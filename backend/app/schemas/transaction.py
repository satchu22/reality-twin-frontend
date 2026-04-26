"""Pydantic schemas for transaction endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TransactionCreate(BaseModel):
    """Request body for creating a transaction."""

    company_id: int = Field(gt=0)
    amount: float = Field(gt=0)
    status: Literal["pending", "paid", "overdue"]
    due_date: datetime
    description: str = Field(min_length=1, max_length=500)


class TransactionResponse(BaseModel):
    """Serialized transaction returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    amount: float
    status: Literal["pending", "paid", "overdue"]
    due_date: datetime
    description: str
    created_at: datetime
