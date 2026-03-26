from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import csv
from io import StringIO
from datetime import datetime
from geopy.geocoders import Nominatim

from database import engine, SessionLocal
from models import Base, Shipment, Batch, Simulation

Base.metadata.create_all(bind=engine)

app = FastAPI()

# 🔥 CORS (SAFE FOR DEV)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# MODELS
# =========================

class Query(BaseModel):
    query: str

class ManualRoute(BaseModel):
    source: str
    dest: str


@app.get("/")
def home():
    return {"message": "Backend running"}


# =========================
# 🔥 CSV UPLOAD
# =========================
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    db = SessionLocal()

    batch = Batch(
        created_at=str(datetime.now()),
        total_shipments=0
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(StringIO(decoded))

    count = 0

    for row in reader:
        try:
            shipment = Shipment(
                route=row.get("route"),
                cost=float(row.get("cost", 0)),
                source_lat=float(row.get("source_lat", 0)),
                source_lng=float(row.get("source_lng", 0)),
                dest_lat=float(row.get("dest_lat", 0)),
                dest_lng=float(row.get("dest_lng", 0)),
                distance_km=float(row.get("distance_km", 0)),
                batch_id=batch.id
            )
            db.add(shipment)
            count += 1
        except Exception as e:
            print("Error parsing row:", e)

    batch.total_shipments = count
    db.commit()

    batch_id = batch.id
    db.close()

    return {"message": f"Uploaded batch {batch_id}"}


# =========================
# 🔥 MANUAL ROUTE (UPDATED)
# =========================
@app.post("/manual-route")
def manual_route(data: ManualRoute):
    db = SessionLocal()
    geolocator = Nominatim(user_agent="reality_twin")

    try:
        src = geolocator.geocode(data.source, timeout=10)
        dst = geolocator.geocode(data.dest, timeout=10)

        if not src or not dst:
            return {"error": "Invalid location"}

        # 🔥 CREATE NEW BATCH (kept same)
        batch = Batch(
            created_at=str(datetime.now()),
            total_shipments=1
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        shipment = Shipment(
            route=f"{data.source} → {data.dest}",
            cost=1000,
            source_lat=src.latitude,
            source_lng=src.longitude,
            dest_lat=dst.latitude,
            dest_lng=dst.longitude,
            distance_km=1000,
            batch_id=batch.id
        )

        db.add(shipment)
        db.commit()

        # 🔥 ONLY CHANGE: removed batch_id
        response = {
            "source": [src.longitude, src.latitude],
            "dest": [dst.longitude, dst.latitude],
            "route_name": shipment.route
        }

        db.close()
        return response

    except Exception as e:
        db.close()
        return {"error": str(e)}


# =========================
# 🔥 ROUTES (LATEST BATCH)
# =========================
@app.get("/routes")
def get_routes():
    db = SessionLocal()

    latest = db.query(Batch).order_by(Batch.id.desc()).first()
    if not latest:
        return []

    shipments = db.query(Shipment).filter(
        Shipment.batch_id == latest.id
    ).all()

    routes = []
    for s in shipments:
        routes.append({
            "source": [s.source_lng, s.source_lat],
            "dest": [s.dest_lng, s.dest_lat],
            "route_name": s.route
        })

    db.close()
    return routes


# =========================
# 🔥 SIMULATION
# =========================
@app.post("/simulate")
def simulate(data: Query):
    db = SessionLocal()

    latest = db.query(Batch).order_by(Batch.id.desc()).first()
    if not latest:
        return {"error": "No data"}

    shipments = db.query(Shipment).filter(
        Shipment.batch_id == latest.id
    ).all()

    total_delay = 0
    total_cost = 0
    high_risk = []
    medium_risk = []

    for s in shipments:
        delay = s.distance_km * 0.001
        extra_cost = s.distance_km * 0.5

        total_delay += delay
        total_cost += s.cost + extra_cost

        if delay > 0.5:
            high_risk.append(s.route)
        elif delay > 0.2:
            medium_risk.append(s.route)

    avg_delay = round(total_delay / len(shipments), 2)
    total_cost = round(total_cost, 2)

    options = [
        {
            "name": "Reroute via alternate path",
            "delay": round(avg_delay * 0.6, 2),
            "cost": round(total_cost * 1.15, 2),
            "risk": "medium"
        },
        {
            "name": "Delay shipment by 24h",
            "delay": round(avg_delay * 1.0, 2),
            "cost": round(total_cost * 0.95, 2),
            "risk": "high"
        },
        {
            "name": "Split shipment",
            "delay": round(avg_delay * 0.8, 2),
            "cost": round(total_cost * 1.05, 2),
            "risk": "low"
        }
    ]

    best_option = min(options, key=lambda x: x["delay"] + (x["cost"] / 10000))

    sim = Simulation(
        batch_id=latest.id,
        avg_delay=avg_delay,
        total_cost=total_cost,
        risk_count=len(high_risk),
        best_action=best_option["name"],
        impact_summary=f"{len(high_risk)} high risk routes"
    )
    db.add(sim)
    db.commit()

    db.close()

    return {
        "impact": {
            "high_risk": high_risk,
            "medium_risk": medium_risk,
            "avg_delay_days": avg_delay,
            "total_cost": total_cost,
        },
        "options": options,
        "best_option": best_option
    }


# =========================
# 🔥 OVERVIEW
# =========================
@app.get("/overview")
def get_overview():
    db = SessionLocal()

    latest = db.query(Batch).order_by(Batch.id.desc()).first()
    if not latest:
        return {}

    shipments = db.query(Shipment).filter(
        Shipment.batch_id == latest.id
    ).all()

    sim = db.query(Simulation).filter(
        Simulation.batch_id == latest.id
    ).first()

    return {
        "active_routes": len(shipments),
        "risk_alerts": sim.risk_count if sim else 0,
        "cost_exposure": sim.total_cost if sim else 0,
        "best_action": sim.best_action if sim else "N/A"
    }


# =========================
# 🔥 HISTORY
# =========================
@app.get("/batches")
def get_batches():
    db = SessionLocal()

    batches = db.query(Batch).all()

    result = []
    for b in batches:
        result.append({
            "batch_id": b.id,
            "total_shipments": b.total_shipments,
            "created_at": b.created_at
        })

    db.close()
    return result


# =========================
# 🔥 BATCH DATA
# =========================
@app.get("/batch-data")
def get_batch_data(batch_id: int):
    db = SessionLocal()

    shipments = db.query(Shipment).filter(
        Shipment.batch_id == batch_id
    ).all()

    result = []

    for s in shipments:
        result.append({
            "route": s.route,
            "cost": s.cost,
            "distance": s.distance_km,
            "source": [s.source_lng, s.source_lat],
            "dest": [s.dest_lng, s.dest_lat]
        })

    db.close()
    return result