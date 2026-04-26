"""Seed the database with a minimal local dataset for development."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..models.notification import Notification
from ..models.route import Batch, Shipment
from ..models.scenario import Simulation
from ..models.transaction import Transaction


def seed_local_data(db: Session) -> None:
    """Create a small starter dataset if the database is empty."""

    if db.query(Batch).first():
        return

    batch = Batch(created_at=datetime.now().isoformat(), total_shipments=3)
    db.add(batch)
    db.flush()

    db.add_all(
        [
            Shipment(
                route="Los Angeles → Dallas",
                cost=1800,
                source_lat=34.0522,
                source_lng=-118.2437,
                dest_lat=32.7767,
                dest_lng=-96.7970,
                distance_km=1995,
                batch_id=batch.id,
            ),
            Shipment(
                route="Seattle → Chicago",
                cost=2200,
                source_lat=47.6062,
                source_lng=-122.3321,
                dest_lat=41.8781,
                dest_lng=-87.6298,
                distance_km=2788,
                batch_id=batch.id,
            ),
            Shipment(
                route="Miami → Atlanta",
                cost=1200,
                source_lat=25.7617,
                source_lng=-80.1918,
                dest_lat=33.7490,
                dest_lng=-84.3880,
                distance_km=1065,
                batch_id=batch.id,
            ),
        ]
    )

    db.add(
        Simulation(
            batch_id=batch.id,
            avg_delay=2.4,
            total_cost=5200,
            risk_count=1,
            best_action="Reroute Seattle → Chicago",
            impact_summary="Weather disruption detected on 1 route",
        )
    )

    transaction = Transaction(
        company_id=1,
        amount=2499.0,
        status="pending",
        due_date=datetime.now() + timedelta(days=2),
        description="Starter subscription invoice",
    )
    db.add(transaction)
    db.flush()

    db.add(
        Notification(
            user_id=1,
            transaction_id=transaction.id,
            message="Welcome to RealityTwin. Your starter dataset is ready.",
            type="info",
            is_read=False,
        )
    )

    db.commit()
