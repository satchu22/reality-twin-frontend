"""External event ORM model for normalized third-party conditions."""

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from ..db.base import Base


class ExternalEvent(Base):
    """Stores normalized external events from free and mock adapters."""

    __tablename__ = "external_events"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    radius_km = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    raw_payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
