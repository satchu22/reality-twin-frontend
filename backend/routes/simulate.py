from fastapi import APIRouter
from database import SessionLocal
from models import Shipment
from services.simulation_service import run_simulation

router = APIRouter()

@router.post("/")
def simulate():
    db = SessionLocal()
    shipments = db.query(Shipment).all()

    result = run_simulation(shipments)

    db.close()
    return result