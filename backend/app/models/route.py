"""Route-related ORM models for shipments and uploaded batches."""

from sqlalchemy import Column, Float, Integer, String

from ..db.base import Base


class Shipment(Base):
    """Represents a shipment row inside an uploaded batch."""

    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    route = Column(String)
    cost = Column(Float)
    source_lat = Column(Float)
    source_lng = Column(Float)
    dest_lat = Column(Float)
    dest_lng = Column(Float)
    distance_km = Column(Float)
    batch_id = Column(Integer)


class Batch(Base):
    """Tracks each uploaded shipment dataset."""

    __tablename__ = "batches"

    id = Column(Integer, primary_key=True)
    created_at = Column(String)
    total_shipments = Column(Integer)
