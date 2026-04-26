"""Simulation-related ORM models."""

from sqlalchemy import Column, Float, Integer, String

from ..db.base import Base


class Simulation(Base):
    """Stores simulation aggregates for a batch."""

    __tablename__ = "simulations"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer)
    avg_delay = Column(Float)
    total_cost = Column(Float)
    risk_count = Column(Integer)
    best_action = Column(String)
    impact_summary = Column(String)


class SimulationApproval(Base):
    """Stores the selected option for a scenario approval event."""

    __tablename__ = "simulation_approvals"

    id = Column(Integer, primary_key=True)
    scenario_id = Column(String, index=True)
    selected_option = Column(String)
    timestamp = Column(String)
