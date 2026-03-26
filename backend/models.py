from sqlalchemy import Column, Integer, String, Float
from database import Base


# 🔹 EXISTING (UNCHANGED)
class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    route = Column(String)
    cost = Column(Float)

    source_lat = Column(Float)
    source_lng = Column(Float)
    dest_lat = Column(Float)
    dest_lng = Column(Float)

    distance_km = Column(Float)

    # 🔥 IMPORTANT (already correct)
    batch_id = Column(Integer)


# 🔥 NEW TABLE (FOR DATASET / HISTORY)
class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True)
    created_at = Column(String)
    total_shipments = Column(Integer)


# 🔥 NEW TABLE (FOR DASHBOARD / UI)
class Simulation(Base):
    __tablename__ = "simulations"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer)

    avg_delay = Column(Float)
    total_cost = Column(Float)

    risk_count = Column(Integer)
    best_action = Column(String)
    impact_summary = Column(String)