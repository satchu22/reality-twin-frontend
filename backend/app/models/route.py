"""Route-related ORM models for uploaded batches and persistent route records."""

from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.orm import synonym
from sqlalchemy.sql import func

from ..db import Base


def _uuid_string() -> str:
    return str(uuid4())


class Route(Base):
    """Persistent route record with compatibility aliases for existing services."""

    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String, unique=True, nullable=False, default=_uuid_string, index=True)
    name = Column(String, nullable=False)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    dest_lat = Column(Float, nullable=False)
    dest_lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False, default=0.0)
    transport_mode = Column(String, nullable=False, default="multimodal")
    risk_score = Column(Float, nullable=False, default=0.0)
    risk_level = Column(String, nullable=False, default="low")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Existing backend flows still rely on these fields.
    cost = Column(Float, nullable=False, default=0.0)
    batch_id = Column(Integer, nullable=True)

    route = synonym("name")
    source_lat = synonym("origin_lat")
    source_lng = synonym("origin_lng")


class Batch(Base):
    """Tracks each uploaded shipment dataset."""

    __tablename__ = "batches"

    id = Column(Integer, primary_key=True)
    created_at = Column(String)
    total_shipments = Column(Integer)


# Backward-compatible alias while the rest of the codebase migrates.
Shipment = Route
