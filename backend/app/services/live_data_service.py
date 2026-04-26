"""Aggregate live route-affecting events through adapters and persist normalized rows."""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..integrations.satellite.satellite_adapter import fetch_satellite_hazards
from ..integrations.traffic.traffic_adapter import fetch_traffic_events
from ..integrations.weather.weather_adapter import fetch_weather_events
from ..models.event import ExternalEvent
from ..models.route import Shipment
from .event_service import list_global_events
from .realtime_service import broadcast_event

logger = logging.getLogger(__name__)


def _route_midpoint(shipment: Shipment) -> tuple[float, float]:
    return (
        (shipment.source_lat + shipment.dest_lat) / 2,
        (shipment.source_lng + shipment.dest_lng) / 2,
    )


def _coerce_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _normalize_event(payload: dict[str, object]) -> dict[str, object]:
    return {
        "source": payload["source"],
        "event_type": payload["event_type"],
        "severity": payload["severity"],
        "lat": float(payload["lat"]),
        "lng": float(payload["lng"]),
        "radius_km": float(payload["radius_km"]),
        "description": str(payload["description"]),
        "confidence": float(payload.get("confidence", 0.0) or 0.0),
        "starts_at": _coerce_datetime(payload.get("starts_at")),
        "ends_at": _coerce_datetime(payload.get("ends_at")),
        "raw_payload": payload.get("raw_payload", {}),
    }


def refresh_live_events(db: Session) -> list[ExternalEvent]:
    """Rebuild the normalized external_events table from adapters."""

    shipments = db.query(Shipment).order_by(Shipment.id.desc()).limit(25).all()

    db.query(ExternalEvent).delete()
    db.flush()

    created_events: list[ExternalEvent] = []

    for shipment in shipments:
        midpoint_lat, midpoint_lng = _route_midpoint(shipment)
        route_name = shipment.route or f"Route {shipment.id}"
        adapter_payloads = [
            *fetch_weather_events(lat=midpoint_lat, lng=midpoint_lng, route_name=route_name),
            *fetch_traffic_events(lat=midpoint_lat, lng=midpoint_lng, route_name=route_name),
        ]

        for payload in adapter_payloads:
            try:
                event = ExternalEvent(**_normalize_event(payload))
                db.add(event)
                created_events.append(event)
            except Exception as exc:
                logger.warning("Skipping malformed adapter event: %s", exc)

    for payload in [*list_global_events(), *fetch_satellite_hazards()]:
        try:
            event = ExternalEvent(**_normalize_event(payload))
            db.add(event)
            created_events.append(event)
        except Exception as exc:
            logger.warning("Skipping malformed global/satellite event: %s", exc)

    db.commit()

    for event in created_events:
        db.refresh(event)

    broadcast_event(
        "route_update",
        {
            "status": "events_refreshed",
            "event_count": len(created_events),
        },
    )
    return created_events


def list_live_events(db: Session) -> list[ExternalEvent]:
    """Return all currently active normalized events."""

    return db.query(ExternalEvent).order_by(ExternalEvent.severity.desc(), ExternalEvent.id.desc()).all()
