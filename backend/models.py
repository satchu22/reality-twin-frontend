"""Compatibility exports for the modular ORM model package."""

try:
    from app.models import (
        Batch,
        Disruption,
        Notification,
        Route,
        Shipment,
        Simulation,
        SimulationApproval,
        Transaction,
    )
except ModuleNotFoundError as exc:
    if exc.name != "app":
        raise
    from backend.app.models import (
        Batch,
        Disruption,
        Notification,
        Route,
        Shipment,
        Simulation,
        SimulationApproval,
        Transaction,
    )
