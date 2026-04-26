"""Business logic for simulation, route data, overview, and history flows."""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from io import StringIO

from fastapi import HTTPException
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from sqlalchemy.orm import Session

from ..models.event import ExternalEvent
from ..models.route import Batch, Shipment
from ..models.scenario import Simulation, SimulationApproval
from .live_data_service import list_live_events as list_live_event_records
from .location_catalog_service import load_airports, load_ports
from .realtime_service import broadcast_event

logger = logging.getLogger(__name__)

DISRUPTION_MULTIPLIERS = {
    "port_closure": 2.4,
    "weather": 1.8,
    "congestion": 1.4,
    "breakdown": 1.6,
}

OPTION_ADJUSTMENTS = {
    "direct": {
        "route_type": "Direct",
        "delay_multiplier": 1.0,
        "cost_multiplier": 1.0,
        "risk_multiplier": 1.05,
    },
    "balanced_reroute": {
        "route_type": "Balanced Reroute",
        "delay_multiplier": 0.8,
        "cost_multiplier": 1.15,
        "risk_multiplier": 0.8,
    },
    "safety_first": {
        "route_type": "Safety-First Detour",
        "delay_multiplier": 1.15,
        "cost_multiplier": 1.25,
        "risk_multiplier": 0.65,
    },
}

SOURCE_IMPACT_RULES = {
    "weather": {
        "delay_multiplier": 0.25,
        "cost_multiplier": 0.12,
        "risk_delta": 18,
        "explanation_prefix": "Weather pressure from",
    },
    "traffic": {
        "delay_multiplier": 0.18,
        "cost_multiplier": 0.09,
        "risk_delta": 10,
        "explanation_prefix": "Traffic congestion near",
    },
    "satellite": {
        "delay_multiplier": 0.4,
        "cost_multiplier": 0.22,
        "risk_delta": 28,
        "explanation_prefix": "Satellite hazard coverage around",
    },
    "global_event": {
        "delay_multiplier": 0.5,
        "cost_multiplier": 0.3,
        "risk_delta": 36,
        "explanation_prefix": "Global disruption context from",
    },
}

PRIORITY_MULTIPLIERS = {
    "low": 0.95,
    "standard": 1.0,
    "high": 1.12,
    "critical": 1.25,
}

CARGO_RISK_MULTIPLIERS = {
    "pharma": 1.2,
    "perishable": 1.15,
    "electronics": 1.1,
    "hazmat": 1.35,
}


@dataclass
class RouteContext:
    route_id: int | None
    route_name: str
    source_lat: float
    source_lng: float
    dest_lat: float
    dest_lng: float
    distance_km: float
    cargo_type: str
    priority: str


def _fallback_simulation_response(
    *,
    route_name: str = "Fallback route plan",
    reason: str = "Fallback route due to missing data",
) -> dict[str, object]:
    options = [
        {
            "name": "fallback_air",
            "route_type": "air",
            "route": route_name,
            "delay": 8.0,
            "cost": 5000.0,
            "total_time": 8.0,
            "total_cost": 5000.0,
            "risk": "medium",
            "score": 2.4,
            "explanation": [reason],
            "event_types": [],
            "live_events_used": [],
            "geometry": None,
            "total_time_hours": 8,
            "total_cost_usd": 5000,
            "risk_level": "medium",
            "explanations": [reason],
        },
        {
            "name": "fallback_sea",
            "route_type": "sea",
            "route": route_name,
            "delay": 120.0,
            "cost": 2000.0,
            "total_time": 120.0,
            "total_cost": 2000.0,
            "risk": "low",
            "score": 3.1,
            "explanation": ["Fallback route"],
            "event_types": [],
            "live_events_used": [],
            "geometry": None,
            "total_time_hours": 120,
            "total_cost_usd": 2000,
            "risk_level": "low",
            "explanations": ["Fallback route"],
        },
        {
            "name": "fallback_hybrid",
            "route_type": "hybrid",
            "route": route_name,
            "delay": 36.0,
            "cost": 3000.0,
            "total_time": 36.0,
            "total_cost": 3000.0,
            "risk": "medium",
            "score": 2.8,
            "explanation": ["Fallback route"],
            "event_types": [],
            "live_events_used": [],
            "geometry": None,
            "total_time_hours": 36,
            "total_cost_usd": 3000,
            "risk_level": "medium",
            "explanations": ["Fallback route"],
        },
    ]

    return {
        "route": route_name,
        "risk": "medium",
        "total_time": 36.0,
        "total_cost": 3000.0,
        "explanation": [reason],
        "options": options,
        "best_option": "fallback_hybrid",
    }


def upload_shipments_from_csv(db: Session, *, file_bytes: bytes) -> dict[str, str]:
    """Create a batch and persist shipment rows from a CSV upload."""

    batch = Batch(created_at=datetime.now(UTC).isoformat(), total_shipments=0)
    db.add(batch)
    db.flush()

    decoded = file_bytes.decode("utf-8")
    reader = csv.DictReader(StringIO(decoded))

    count = 0
    for row in reader:
        try:
            shipment = Shipment(
                route=row.get("route") or f"Shipment {count + 1}",
                cost=float(row.get("cost", 0) or 0),
                source_lat=float(row.get("source_lat", 0) or 0),
                source_lng=float(row.get("source_lng", 0) or 0),
                dest_lat=float(row.get("dest_lat", 0) or 0),
                dest_lng=float(row.get("dest_lng", 0) or 0),
                distance_km=float(row.get("distance_km", 0) or 0),
                batch_id=batch.id,
            )
            db.add(shipment)
            count += 1
        except (TypeError, ValueError) as exc:
            logger.warning("Skipping CSV row because it could not be parsed: %s", exc)

    batch.total_shipments = count
    db.commit()
    return {"message": f"Uploaded batch {batch.id} with {count} shipments"}


def create_manual_route(db: Session, *, source: str, dest: str) -> dict[str, object]:
    """Create a one-off route using geocoded source and destination values."""

    geolocator = Nominatim(user_agent="reality_twin")

    try:
        src = geolocator.geocode(source, timeout=10)
        dst = geolocator.geocode(dest, timeout=10)
        if not src or not dst:
            return {"error": "Invalid location"}

        batch = Batch(created_at=datetime.now(UTC).isoformat(), total_shipments=1)
        db.add(batch)
        db.flush()

        distance_km = geodesic((src.latitude, src.longitude), (dst.latitude, dst.longitude)).km
        shipment = Shipment(
            route=f"{source} → {dest}",
            cost=max(distance_km * 0.75, 900),
            source_lat=src.latitude,
            source_lng=src.longitude,
            dest_lat=dst.latitude,
            dest_lng=dst.longitude,
            distance_km=round(distance_km, 2),
            batch_id=batch.id,
        )

        db.add(shipment)
        batch.total_shipments = 1
        db.commit()
        db.refresh(shipment)

        return {
            "route_id": shipment.id,
            "source": [src.longitude, src.latitude],
            "dest": [dst.longitude, dst.latitude],
            "route_name": shipment.route,
            "distance": shipment.distance_km,
        }
    except Exception as exc:
        logger.warning("Manual route creation failed: %s", exc)
        return {"error": str(exc)}


def get_latest_routes(db: Session) -> list[dict[str, object]]:
    """Return map routes for the latest uploaded batch."""

    latest = db.query(Batch).order_by(Batch.id.desc()).first()
    if not latest:
        return []

    shipments = db.query(Shipment).filter(Shipment.batch_id == latest.id).all()
    return [
        {
            "route_id": shipment.id,
            "source": [shipment.source_lng, shipment.source_lat],
            "dest": [shipment.dest_lng, shipment.dest_lat],
            "route_name": shipment.route,
            "distance": shipment.distance_km,
        }
        for shipment in shipments
    ]


def run_simulation(shipments: list[Shipment]) -> dict[str, object]:
    """Run the existing batch-level simulation logic."""

    total_cost = 0.0
    total_delay = 0.0
    impacted_routes: list[str] = []

    for shipment in shipments:
        delay = shipment.distance_km * 0.001
        extra_cost = shipment.distance_km * 0.5

        if delay > 3:
            impacted_routes.append(shipment.route)

        total_delay += delay
        total_cost += shipment.cost + extra_cost

    return {
        "delay": round(total_delay, 2),
        "cost": round(total_cost, 2),
        "impacted_routes": impacted_routes,
        "recommendation": "Optimize long-distance routes",
    }


def run_full_simulation(db: Session) -> dict[str, object]:
    """Run the existing batch endpoint against all shipments."""

    shipments = db.query(Shipment).all()
    return run_simulation(shipments)


def _risk_label(risk_score: float) -> str:
    if risk_score >= 67:
        return "high"
    if risk_score >= 34:
        return "medium"
    return "low"


def _severity_multiplier(severity: str) -> float:
    return {
        "low": 0.55,
        "medium": 1.0,
        "high": 1.45,
    }.get(severity, 1.0)


def _resolve_route_context(db: Session, route) -> RouteContext:
    if getattr(route, "route_id", None) is not None:
        shipment = db.query(Shipment).filter(Shipment.id == route.route_id).first()
        if not shipment:
            raise HTTPException(status_code=404, detail="Route not found")

        return RouteContext(
            route_id=shipment.id,
            route_name=shipment.route,
            source_lat=shipment.source_lat,
            source_lng=shipment.source_lng,
            dest_lat=shipment.dest_lat,
            dest_lng=shipment.dest_lng,
            distance_km=float(getattr(route, "distance_km", None) or shipment.distance_km),
            cargo_type=(route.cargo_type or "general").strip().lower(),
            priority=route.priority,
        )

    distance_km = geodesic(
        (route.origin_latitude, route.origin_longitude),
        (route.destination_latitude, route.destination_longitude),
    ).km
    return RouteContext(
        route_id=None,
        route_name=f"{route.origin_name} → {route.destination_name}",
        source_lat=float(route.origin_latitude),
        source_lng=float(route.origin_longitude),
        dest_lat=float(route.destination_latitude),
        dest_lng=float(route.destination_longitude),
        distance_km=round(distance_km, 2),
        cargo_type=(route.cargo_type or "general").strip().lower(),
        priority=route.priority,
    )


def _route_points(context: RouteContext) -> list[tuple[float, float]]:
    midpoint = (
        (context.source_lat + context.dest_lat) / 2,
        (context.source_lng + context.dest_lng) / 2,
    )
    return [
        (context.source_lat, context.source_lng),
        midpoint,
        (context.dest_lat, context.dest_lng),
    ]


def _event_within_route_radius(context: RouteContext, event: ExternalEvent) -> bool:
    event_point = (event.lat, event.lng)
    return any(
        geodesic(route_point, event_point).km <= event.radius_km
        for route_point in _route_points(context)
    )


def _nearest_dataset_labels(context: RouteContext) -> list[str]:
    labels: list[str] = []
    midpoint = (
        (context.source_lat + context.dest_lat) / 2,
        (context.source_lng + context.dest_lng) / 2,
    )

    closest_port = min(
        load_ports(),
        key=lambda port: geodesic(midpoint, (float(port["lat"]), float(port["lng"]))).km,
        default=None,
    )
    closest_airport = min(
        load_airports(),
        key=lambda airport: geodesic(
            midpoint, (float(airport["latitude"]), float(airport["longitude"]))
        ).km,
        default=None,
    )

    if closest_port:
        labels.append(f"Nearest port context: {closest_port['name']}")
    if closest_airport:
        labels.append(f"Nearest airport context: {closest_airport['name']} ({closest_airport['iata']})")
    return labels


def _serialize_event(event: ExternalEvent) -> dict[str, object]:
    return {
        "id": event.id,
        "source": event.source,
        "event_type": event.event_type,
        "severity": event.severity,
        "lat": event.lat,
        "lng": event.lng,
        "radius_km": event.radius_km,
        "description": event.description,
        "confidence": round(event.confidence, 2),
    }


def _analyze_route_events(context: RouteContext, events: list[ExternalEvent]) -> dict[str, object]:
    try:
        nearby_events = [event for event in events if _event_within_route_radius(context, event)]
    except Exception:
        logger.exception("Failed to inspect external events for route %s", context.route_name)
        nearby_events = []

    delay_multiplier = 1.0
    cost_multiplier = 1.0
    risk_delta = 0.0
    explanations: list[str] = []

    for event in nearby_events:
        impact = SOURCE_IMPACT_RULES.get(event.source, SOURCE_IMPACT_RULES["global_event"])
        severity_weight = _severity_multiplier(event.severity)
        delay_multiplier += impact["delay_multiplier"] * severity_weight
        cost_multiplier += impact["cost_multiplier"] * severity_weight
        risk_delta += impact["risk_delta"] * severity_weight
        explanations.append(f"{impact['explanation_prefix']} {event.description}")

    if not explanations:
        explanations.append("No major external events are currently intersecting this route.")

    try:
        explanations.extend(_nearest_dataset_labels(context))
    except Exception:
        logger.exception("Failed to load nearest dataset labels for route %s", context.route_name)
        explanations.append("Dataset context unavailable, continuing with safe defaults.")

    return {
        "nearby_events": nearby_events,
        "delay_multiplier": delay_multiplier,
        "cost_multiplier": cost_multiplier,
        "risk_delta": risk_delta,
        "explanations": explanations,
    }


def _build_simulation_options(
    *,
    context: RouteContext,
    weighted_delay: float,
    weighted_cost: float,
    risk_score: float,
    explanations: list[str],
    nearby_events: list[ExternalEvent],
) -> list[dict[str, object]]:
    options: list[dict[str, object]] = []
    priority_weight = PRIORITY_MULTIPLIERS.get(context.priority, 1.0)
    cargo_weight = CARGO_RISK_MULTIPLIERS.get(context.cargo_type, 1.0)
    live_events_used = [_serialize_event(event) for event in nearby_events]

    for name, adjustment in OPTION_ADJUSTMENTS.items():
        option_delay = weighted_delay * adjustment["delay_multiplier"] * priority_weight
        option_cost = weighted_cost * adjustment["cost_multiplier"]
        option_risk_score = risk_score * adjustment["risk_multiplier"] * cargo_weight
        score = (option_delay * 0.5) + ((option_cost / 1000) * 0.3) + ((option_risk_score / 100) * 0.2)

        options.append(
            {
                "name": name,
                "route_type": adjustment["route_type"],
                "route": context.route_name,
                "delay": round(option_delay, 2),
                "cost": round(option_cost, 2),
                "total_time": round(option_delay, 2),
                "total_cost": round(option_cost, 2),
                "risk": _risk_label(option_risk_score),
                "score": round(score, 2),
                "explanation": explanations,
                "event_types": sorted({event.source for event in nearby_events}),
                "live_events_used": live_events_used,
                "_raw_score": score,
            }
        )

    return options


def run_route_simulation(db: Session, route) -> dict[str, object]:
    """Run the route-level disruption simulation from stored external events."""

    route_name = (
        f"{getattr(route, 'origin_name', 'Origin')} → {getattr(route, 'destination_name', 'Destination')}"
        if getattr(route, "origin_name", None) and getattr(route, "destination_name", None)
        else f"Route {getattr(route, 'route_id', 'fallback')}"
    )

    try:
        context = _resolve_route_context(db, route)
        route_name = context.route_name
        if context.distance_km <= 0:
            raise HTTPException(status_code=422, detail="distance_km must be greater than 0")

        disruption_multiplier = DISRUPTION_MULTIPLIERS[route.disruption_type]
        try:
            external_events = db.query(ExternalEvent).all()
        except Exception:
            logger.exception("Failed to load external events for simulation")
            external_events = []

        route_events = _analyze_route_events(context, external_events)
        normalized_distance = min(context.distance_km / 10000, 1)
        risk_score = (
            (normalized_distance * 42)
            + route_events["risk_delta"]
            + (PRIORITY_MULTIPLIERS.get(context.priority, 1.0) - 1) * 18
        )

        base_delay = max(context.distance_km / 4200, 0.4)
        base_cost = max(context.distance_km * 0.72, 800)
        weighted_delay = base_delay * disruption_multiplier * route_events["delay_multiplier"]
        weighted_cost = base_cost * disruption_multiplier * route_events["cost_multiplier"]

        options = _build_simulation_options(
            context=context,
            weighted_delay=weighted_delay,
            weighted_cost=weighted_cost,
            risk_score=risk_score,
            explanations=route_events["explanations"],
            nearby_events=route_events["nearby_events"],
        )
        if not options:
            logger.warning("Simulation produced no options for route %s; returning fallback", route_name)
            return _fallback_simulation_response(route_name=route_name)

        best_option = min(options, key=lambda option: option["_raw_score"])["name"]
        serialized_options = [
            {key: value for key, value in option.items() if not key.startswith("_")}
            for option in options
        ]
        payload = {
            "route_id": context.route_id,
            "route": context.route_name,
            "distance_km": context.distance_km,
            "disruption_type": route.disruption_type,
            "best_option": best_option,
            "options": serialized_options,
            "risk": _risk_label(risk_score),
            "explanation": route_events["explanations"],
        }

        broadcast_event("simulation_update", payload)
        if context.route_id is not None:
            broadcast_event(
                "route_update",
                {
                    "route_id": context.route_id,
                    "status": "high risk" if payload["risk"] == "high" else "monitored",
                    "disruption_type": route.disruption_type,
                    "best_option": best_option,
                },
            )

        return {
            "route": context.route_name,
            "risk": payload["risk"],
            "total_time": round(weighted_delay, 2),
            "total_cost": round(weighted_cost, 2),
            "explanation": route_events["explanations"],
            "options": serialized_options,
            "best_option": best_option,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Route simulation failed; returning fallback response")
        return _fallback_simulation_response(
            route_name=route_name,
            reason="Fallback route due to missing data",
        )


def approve_simulation_decision(
    db: Session, *, scenario_id: int | str, selected_option: str
) -> dict[str, str]:
    """Persist the selected simulation option."""

    approval = SimulationApproval(
        scenario_id=str(scenario_id),
        selected_option=selected_option,
        timestamp=datetime.now(UTC).isoformat(),
    )
    db.add(approval)
    db.commit()
    broadcast_event(
        "simulation_update",
        {
            "route_id": scenario_id,
            "approved_option": selected_option,
            "message": "Simulation decision approved successfully",
        },
    )
    return {"message": "Simulation decision approved successfully"}


def get_overview(db: Session) -> dict[str, object]:
    """Return dashboard overview metrics for the latest batch."""

    latest = db.query(Batch).order_by(Batch.id.desc()).first()
    if not latest:
        return {
            "active_routes": 0,
            "risk_alerts": 0,
            "cost_exposure": 0,
            "best_action": "Upload data to begin",
        }

    shipments = db.query(Shipment).filter(Shipment.batch_id == latest.id).all()
    simulation = db.query(Simulation).filter(Simulation.batch_id == latest.id).first()
    high_risk_events = (
        db.query(ExternalEvent).filter(ExternalEvent.severity == "high").count()
    )

    return {
        "active_routes": len(shipments),
        "risk_alerts": high_risk_events,
        "cost_exposure": round(simulation.total_cost, 2) if simulation else 0,
        "best_action": simulation.best_action if simulation else "Review top route option",
    }


def get_batches(db: Session) -> list[dict[str, object]]:
    """Return the upload history across all batches."""

    batches = db.query(Batch).all()
    return [
        {
            "batch_id": batch.id,
            "total_shipments": batch.total_shipments,
            "created_at": batch.created_at,
        }
        for batch in batches
    ]


def get_batch_data(db: Session, *, batch_id: int) -> list[dict[str, object]]:
    """Return shipment rows for one batch."""

    shipments = db.query(Shipment).filter(Shipment.batch_id == batch_id).all()
    return [
        {
            "route_id": shipment.id,
            "route": shipment.route,
            "cost": shipment.cost,
            "distance": shipment.distance_km,
            "source": [shipment.source_lng, shipment.source_lat],
            "dest": [shipment.dest_lng, shipment.dest_lat],
        }
        for shipment in shipments
    ]


def list_live_events(db: Session) -> list[ExternalEvent]:
    """Expose active live events for route map overlays."""

    return list_live_event_records(db)
