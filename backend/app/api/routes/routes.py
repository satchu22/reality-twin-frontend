"""General application routes that delegate work to services."""

from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ...db.session import get_db
from ...schemas.event import EventResponse
from ...schemas.route import BatchDataResponse, BatchResponse, ManualRouteRequest
from ...services.route_service import (
    create_manual_route,
    get_batch_data,
    get_batches,
    get_latest_routes,
    list_live_events,
    get_overview,
    upload_shipments_from_csv,
)
from ...services.airport_data_service import find_nearest_airports_payload

router = APIRouter(tags=["routes"])


@router.get("/")
def home():
    """Health-style root endpoint."""

    return {"message": "Backend running"}


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a shipment CSV and create a new batch."""

    contents = await file.read()
    try:
        return upload_shipments_from_csv(db, file_bytes=contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/manual-route")
def manual_route(
    data: ManualRouteRequest,
    db: Session = Depends(get_db),
):
    """Create a route from manually entered source and destination values."""

    return create_manual_route(db, source=data.source, dest=data.dest)


@router.get("/routes")
def get_routes(db: Session = Depends(get_db)):
    """Return routes for the latest batch."""

    return get_latest_routes(db)


@router.get("/events", response_model=list[EventResponse])
def get_events(db: Session = Depends(get_db)):
    """Return the active live events shown on the map."""

    return list_live_events(db)


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """Return dashboard overview metrics."""

    return get_overview(db)


@router.get("/airports/nearest")
def nearest_airports(
    lat: float,
    lng: float,
    limit: int = 5,
    max_distance_km: float | None = None,
):
    """Return nearest suitable airports from the worldwide airport dataset."""

    return {
        "lat": lat,
        "lng": lng,
        "limit": limit,
        "airports": find_nearest_airports_payload(
            lat,
            lng,
            limit=limit,
            max_distance_km=max_distance_km,
        ),
    }


@router.get("/batches", response_model=list[BatchResponse])
def list_batches(db: Session = Depends(get_db)):
    """Return upload history batches."""

    return get_batches(db)


@router.get("/batch-data", response_model=list[BatchDataResponse])
def batch_data(batch_id: int, db: Session = Depends(get_db)):
    """Return shipment details for one batch."""

    return get_batch_data(db, batch_id=batch_id)
