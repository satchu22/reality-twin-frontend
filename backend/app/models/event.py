"""Disruption ORM model for normalized third-party conditions."""

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import synonym
from sqlalchemy.sql import func

from ..db import Base


class Disruption(Base):
    """Stores disruption records with compatibility aliases for live-event flows."""

    __tablename__ = "external_events"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, index=True)
    affected_route_id = Column(String, nullable=True, index=True)
    description = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Existing normalized-event fields used by current integrations.
    source = Column(String, nullable=False, index=True, default="global_event")
    lat = Column(Float, nullable=False, default=0.0)
    lng = Column(Float, nullable=False, default=0.0)
    radius_km = Column(Float, nullable=False, default=0.0)
    confidence = Column(Float, nullable=False, default=0.0)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    raw_payload = Column(JSON, nullable=False, default=dict)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    event_type = synonym("type")


# Backward-compatible alias while the rest of the codebase migrates.
ExternalEvent = Disruption
