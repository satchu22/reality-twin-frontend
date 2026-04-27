"""Business logic for simulation, route data, overview, and history flows."""

from __future__ import annotations

import csv
import logging
import math
from dataclasses import dataclass
from datetime import UTC, datetime
from io import StringIO
from typing import Any

from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from sqlalchemy.orm import Session

from ..models.event import Disruption
from ..models.route import Batch, Route
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
    "customs_delay": 1.9,
    "strike": 2.1,
}

OPTION_PROFILES = [
    {
        "label": "A",
        "name": "reroute",
        "route_type": "reroute",
        "delay_multiplier": 0.6,
        "cost_multiplier": 1.2,
        "risk_level": "medium",
    },
    {
        "label": "B",
        "name": "hold",
        "route_type": "hold",
        "delay_multiplier": 1.3,
        "cost_multiplier": 0.9,
        "risk_level": "low",
    },
    {
        "label": "C",
        "name": "split",
        "route_type": "split",
        "delay_multiplier": 0.8,
        "cost_multiplier": 1.5,
        "risk_level": "high",
    },
]


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


def _coerce_positive_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value) and value > 0:
        return float(value)
    return None


def _coerce_coordinate(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return None


def _calculate_distance_km_from_coordinates(
    origin_lat: Any,
    origin_lng: Any,
    destination_lat: Any,
    destination_lng: Any,
) -> float | None:
    start_lat = _coerce_coordinate(origin_lat)
    start_lng = _coerce_coordinate(origin_lng)
    end_lat = _coerce_coordinate(destination_lat)
    end_lng = _coerce_coordinate(destination_lng)

    if None in (start_lat, start_lng, end_lat, end_lng):
        return None

    earth_radius_km = 6371.0
    start_lat_rad = math.radians(start_lat)
    end_lat_rad = math.radians(end_lat)
    delta_lat = math.radians(end_lat - start_lat)
    delta_lng = math.radians(end_lng - start_lng)

    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(start_lat_rad)
        * math.cos(end_lat_rad)
        * math.sin(delta_lng / 2) ** 2
    )
    arc = 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    return round(earth_radius_km * arc, 2)


def _derive_route_name(route: Any) -> str:
    origin_name = getattr(route, "origin_name", None)
    destination_name = getattr(route, "destination_name", None)
    if origin_name and destination_name:
        return f"{origin_name} → {destination_name}"

    route_id = getattr(route, "route_id", None)
    if route_id is not None:
        return f"Route {route_id}"

    return "Deterministic route plan"


def _derive_distance_km(route: Any) -> float | None:
    explicit_distance = _coerce_positive_number(getattr(route, "distance_km", None))
    if explicit_distance is not None:
        return explicit_distance

    return _calculate_distance_km_from_coordinates(
        getattr(route, "origin_latitude", None),
        getattr(route, "origin_longitude", None),
        getattr(route, "destination_latitude", None),
        getattr(route, "destination_longitude", None),
    )


def _safe_distance_km(route: Any) -> float:
    derived_distance = _derive_distance_km(route)
    if derived_distance is not None and derived_distance > 0:
        return derived_distance

    return 0.0


def build_deterministic_simulation_response(
    route: Any,
    *,
    detail: str,
    error: str | None = None,
) -> dict[str, object]:
    route_name = _derive_route_name(route)
    distance_km = _safe_distance_km(route)
    disruption_type = getattr(route, "disruption_type", None) or "weather"
    context = RouteContext(
        route_id=getattr(route, "route_id", None),
        route_name=route_name,
        source_lat=float(getattr(route, "origin_latitude", 0) or 0),
        source_lng=float(getattr(route, "origin_longitude", 0) or 0),
        dest_lat=float(getattr(route, "destination_latitude", 0) or 0),
        dest_lng=float(getattr(route, "destination_longitude", 0) or 0),
        distance_km=distance_km,
        cargo_type=(getattr(route, "cargo_type", None) or "general").strip().lower(),
        priority=getattr(route, "priority", "standard"),
    )
    formula_metrics = _calculate_formula_metrics(
        distance_km=distance_km,
        disruption_type=disruption_type,
    )
    explanations = [
        detail,
        (
            f"Distance {round(distance_km, 2)} km with disruption "
            f"{disruption_type} applied at multiplier {formula_metrics['multiplier']}."
        ),
    ]
    options = _build_formula_options(
        context=context,
        formula_metrics=formula_metrics,
        explanations=explanations,
        nearby_events=[],
    )
    best_option = min(options, key=lambda option: float(option["score"]))

    response: dict[str, object] = {
        "route": route_name,
        "risk": best_option["risk"],
        "total_time": best_option["total_time"],
        "total_cost": best_option["total_cost"],
        "explanation": best_option["explanation"],
        "detail": detail,
        "options": options,
        "best_option": best_option["name"],
        "delay_days": formula_metrics["delay_days"],
        "cost_impact_usd": formula_metrics["cost_impact_usd"],
    }
    if error:
        response["error"] = error
    return response


def upload_shipments_from_csv(db: Session, *, file_bytes: bytes) -> dict[str, str]:
    """Create a batch and persist shipment rows from a CSV upload."""

    batch = Batch(created_at=datetime.now(UTC).isoformat(), total_shipments=0)
    db.add(batch)
    db.flush()

    decoded = file_bytes.decode("utf-8")
    reader = csv.DictReader(StringIO(decoded))
    required_fields = {"source_lat", "source_lng", "dest_lat", "dest_lng"}
    available_fields = set(reader.fieldnames or [])

    missing_fields = sorted(required_fields - available_fields)
    if missing_fields:
        db.rollback()
        raise ValueError(
            f"CSV is missing required fields: {', '.join(missing_fields)}"
        )

    inserted_rows = 0
    for row in reader:
        try:
            origin_lat = float(row["source_lat"])
            origin_lng = float(row["source_lng"])
            dest_lat = float(row["dest_lat"])
            dest_lng = float(row["dest_lng"])
            distance_km = _calculate_distance_km_from_coordinates(
                origin_lat,
                origin_lng,
                dest_lat,
                dest_lng,
            )
            if distance_km is None:
                raise ValueError("Route coordinates could not be converted into distance")

            route = Route(
                name=(row.get("route") or f"Shipment {inserted_rows + 1}").strip(),
                cost=float(row.get("cost", 0) or 0),
                origin_lat=origin_lat,
                origin_lng=origin_lng,
                dest_lat=dest_lat,
                dest_lng=dest_lng,
                distance_km=float(row.get("distance_km") or distance_km),
                batch_id=batch.id,
                transport_mode=(row.get("transport_mode") or "multimodal").strip(),
                risk_score=float(row.get("risk_score", 0) or 0),
                risk_level=(row.get("risk_level") or "low").strip().lower(),
            )
            db.add(route)
            inserted_rows += 1
        except (TypeError, ValueError) as exc:
            logger.warning("Skipping CSV row because it could not be parsed: %s", exc)

    batch.total_shipments = inserted_rows
    db.commit()
    return {
        "batch_id": str(batch.id),
        "rows_inserted": str(inserted_rows),
        "message": f"Inserted {inserted_rows} route rows into batch {batch.id}",
    }


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
        route = Route(
            route=f"{source} → {dest}",
            cost=max(distance_km * 0.75, 900),
            source_lat=src.latitude,
            source_lng=src.longitude,
            dest_lat=dst.latitude,
            dest_lng=dst.longitude,
            distance_km=round(distance_km, 2),
            batch_id=batch.id,
        )

        db.add(route)
        batch.total_shipments = 1
        db.commit()
        db.refresh(route)

        return {
            "route_id": route.id,
            "source": [src.longitude, src.latitude],
            "dest": [dst.longitude, dst.latitude],
            "route_name": route.route,
            "distance": route.distance_km,
        }
    except Exception as exc:
        logger.warning("Manual route creation failed: %s", exc)
        return {"error": str(exc)}


def get_latest_routes(db: Session) -> list[dict[str, object]]:
    """Return map routes for the latest uploaded batch."""

    latest = db.query(Batch).order_by(Batch.id.desc()).first()
    if not latest:
        return []

    routes = db.query(Route).filter(Route.batch_id == latest.id).all()
    return [
        {
            "route_id": route.id,
            "source": [route.source_lng, route.source_lat],
            "dest": [route.dest_lng, route.dest_lat],
            "route_name": route.route,
            "distance": route.distance_km,
        }
        for route in routes
    ]


def run_simulation(routes: list[Route]) -> dict[str, object]:
    """Run deterministic batch-level simulation aggregates."""

    total_cost = 0.0
    total_delay = 0.0
    impacted_routes: list[str] = []

    for route in routes:
        metrics = _calculate_formula_metrics(
            distance_km=float(route.distance_km or 0),
            disruption_type="weather",
        )

        if metrics["delay_days"] > metrics["base_delay_days"]:
            impacted_routes.append(route.route)

        total_delay += float(metrics["delay_days"])
        total_cost += float(metrics["cost_impact_usd"])

    return {
        "delay": round(total_delay, 1),
        "cost": round(total_cost, 0),
        "impacted_routes": impacted_routes,
        "recommendation": "Review reroute, hold, and split options for impacted shipments.",
    }


def run_full_simulation(db: Session) -> dict[str, object]:
    """Run the batch simulation against persisted route records."""

    routes = db.query(Route).all()
    if not routes:
        raise ValueError("No routes available")
    return run_simulation(routes)


def _risk_label(risk_score: float) -> str:
    if risk_score >= 67:
        return "high"
    if risk_score >= 34:
        return "medium"
    return "low"


def _calculate_formula_metrics(
    *, distance_km: float, disruption_type: str | None
) -> dict[str, float | str]:
    normalized_disruption = disruption_type if disruption_type in DISRUPTION_MULTIPLIERS else None
    multiplier = DISRUPTION_MULTIPLIERS.get(normalized_disruption or "", 1.0)
    base_delay_days = round(distance_km / 3500, 1)
    delay_days = round(base_delay_days * multiplier, 1)
    base_cost = round(distance_km * 0.85, 0)
    cost_impact_usd = round(base_cost * multiplier, 0)

    return {
        "disruption_type": normalized_disruption or "none",
        "multiplier": multiplier,
        "base_delay_days": base_delay_days,
        "delay_days": delay_days,
        "base_cost": base_cost,
        "cost_impact_usd": cost_impact_usd,
    }


def _severity_multiplier(severity: str) -> float:
    return {
        "low": 0.34,
        "medium": 0.67,
        "high": 1.0,
    }.get(severity, 1.0)


def _resolve_route_context(db: Session, route) -> RouteContext:
    if getattr(route, "route_id", None) is not None:
        available_routes = db.query(Route).all()
        if not available_routes:
            raise ValueError("No routes available")

        db_route = next(
            (candidate for candidate in available_routes if candidate.id == route.route_id),
            None,
        )
        if not db_route:
            raise ValueError("Route not found")

        distance_km = _coerce_positive_number(getattr(route, "distance_km", None))
        if distance_km is None:
            distance_km = _coerce_positive_number(getattr(db_route, "distance_km", None))
        if distance_km is None:
            distance_km = _calculate_distance_km_from_coordinates(
                db_route.source_lat,
                db_route.source_lng,
                db_route.dest_lat,
                db_route.dest_lng,
            )
        if distance_km is None or distance_km <= 0:
            raise ValueError("Invalid route data")

        return RouteContext(
            route_id=db_route.id,
            route_name=db_route.route,
            source_lat=db_route.source_lat,
            source_lng=db_route.source_lng,
            dest_lat=db_route.dest_lat,
            dest_lng=db_route.dest_lng,
            distance_km=distance_km,
            cargo_type=(route.cargo_type or "general").strip().lower(),
            priority=route.priority,
        )

    distance_km = _derive_distance_km(route)
    if distance_km is None or distance_km <= 0:
        raise ValueError("Invalid route data")

    origin_name = getattr(route, "origin_name", None) or "Origin"
    destination_name = getattr(route, "destination_name", None) or "Destination"

    return RouteContext(
        route_id=None,
        route_name=f"{origin_name} → {destination_name}",
        source_lat=float(route.origin_latitude),
        source_lng=float(route.origin_longitude),
        dest_lat=float(route.destination_latitude),
        dest_lng=float(route.destination_longitude),
        distance_km=distance_km,
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


def _event_within_route_radius(context: RouteContext, event: Disruption) -> bool:
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


def _serialize_event(event: Disruption) -> dict[str, object]:
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


def _analyze_route_events(context: RouteContext, events: list[Disruption]) -> dict[str, object]:
    try:
        nearby_events = [event for event in events if _event_within_route_radius(context, event)]
    except Exception:
        logger.exception("Failed to inspect external events for route %s", context.route_name)
        nearby_events = []

    disruption_count = len(nearby_events)
    weather_score = 0.0
    explanations: list[str] = []

    for event in nearby_events:
        severity_weight = _severity_multiplier(event.severity)
        if event.source == "weather":
            weather_score += severity_weight
            explanations.append(f"Weather pressure from {event.description}")
        elif event.source == "traffic":
            explanations.append(f"Traffic congestion near {event.description}")
        elif event.source == "satellite":
            explanations.append(f"Satellite hazard coverage around {event.description}")
        else:
            explanations.append(f"Global disruption context from {event.description}")

    if not explanations:
        explanations.append("No major external events are currently intersecting this route.")

    try:
        explanations.extend(_nearest_dataset_labels(context))
    except Exception:
        logger.exception("Failed to load nearest dataset labels for route %s", context.route_name)
        explanations.append("Dataset context unavailable, continuing with safe defaults.")

    return {
        "nearby_events": nearby_events,
        "disruption_count": disruption_count,
        "weather_score": min(weather_score, 1.0),
        "explanations": explanations,
    }


def _build_formula_options(
    *,
    context: RouteContext,
    formula_metrics: dict[str, float | str],
    explanations: list[str],
    nearby_events: list[Disruption],
) -> list[dict[str, object]]:
    options: list[dict[str, object]] = []
    live_events_used = [_serialize_event(event) for event in nearby_events]
    base_delay_days = float(formula_metrics["base_delay_days"])
    base_cost = float(formula_metrics["base_cost"])
    disruption_type = str(formula_metrics["disruption_type"])
    multiplier = float(formula_metrics["multiplier"])

    for profile in OPTION_PROFILES:
        option_delay = round(base_delay_days * float(profile["delay_multiplier"]), 1)
        option_cost = round(base_cost * float(profile["cost_multiplier"]), 0)
        score = round((option_delay * 0.6) + ((option_cost / 10000) * 0.4), 3)
        option_explanations = [
            *explanations,
            (
                f"{profile['route_type']} option uses delay factor "
                f"{profile['delay_multiplier']} and cost factor {profile['cost_multiplier']}."
            ),
            (
                f"Disruption-adjusted baseline is {formula_metrics['delay_days']} days "
                f"and ${int(float(formula_metrics['cost_impact_usd'])):,} for {disruption_type} "
                f"at multiplier {multiplier}."
            ),
        ]

        options.append(
            {
                "label": profile["label"],
                "name": profile["name"],
                "route_type": profile["route_type"],
                "route": context.route_name,
                "delay": option_delay,
                "cost": option_cost,
                "total_time": option_delay,
                "total_cost": option_cost,
                "risk": profile["risk_level"],
                "score": score,
                "explanation": option_explanations,
                "event_types": sorted({event.source for event in nearby_events}),
                "live_events_used": live_events_used,
                "geometry": None,
                "delay_days": option_delay,
                "cost_impact_usd": option_cost,
                "risk_level": profile["risk_level"],
                "total_time_hours": round(option_delay * 24, 1),
                "total_cost_usd": option_cost,
                "explanations": option_explanations,
                "_raw_score": score,
            }
        )

    if options:
        best_name = min(options, key=lambda option: option["_raw_score"])["name"]
        for option in options:
            option["best"] = option["name"] == best_name

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
            raise ValueError("Invalid route data")

        try:
            external_events = db.query(Disruption).all()
        except Exception:
            logger.exception("Failed to load external events for simulation")
            external_events = []

        route_events = _analyze_route_events(context, external_events)
        formula_metrics = _calculate_formula_metrics(
            distance_km=context.distance_km,
            disruption_type=route.disruption_type,
        )

        options = _build_formula_options(
            context=context,
            formula_metrics=formula_metrics,
            explanations=route_events["explanations"],
            nearby_events=route_events["nearby_events"],
        )
        if not options:
            logger.warning("Simulation produced no options for route %s; returning fallback", route_name)
            return build_deterministic_simulation_response(
                route,
                detail="Deterministic route generated because live simulation data was unavailable.",
            )

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
            "risk": next(
                option["risk"]
                for option in serialized_options
                if option["name"] == best_option
            ),
            "explanation": route_events["explanations"],
            "delay_days": formula_metrics["delay_days"],
            "cost_impact_usd": formula_metrics["cost_impact_usd"],
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
            "total_time": next(
                option["total_time"]
                for option in serialized_options
                if option["name"] == best_option
            ),
            "total_cost": next(
                option["total_cost"]
                for option in serialized_options
                if option["name"] == best_option
            ),
            "explanation": route_events["explanations"],
            "options": serialized_options,
            "best_option": best_option,
            "delay_days": formula_metrics["delay_days"],
            "cost_impact_usd": formula_metrics["cost_impact_usd"],
        }
    except ValueError:
        raise
    except Exception:
        logger.exception("Route simulation failed")
        raise


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

    routes = db.query(Route).filter(Route.batch_id == latest.id).all()
    simulation = db.query(Simulation).filter(Simulation.batch_id == latest.id).first()
    high_risk_events = (
        db.query(Disruption).filter(Disruption.severity == "high").count()
    )

    return {
        "active_routes": len(routes),
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

    routes = db.query(Route).filter(Route.batch_id == batch_id).all()
    return [
        {
            "route_id": route.id,
            "route": route.route,
            "cost": route.cost,
            "distance": route.distance_km,
            "source": [route.source_lng, route.source_lat],
            "dest": [route.dest_lng, route.dest_lat],
        }
        for route in routes
    ]


def list_live_events(db: Session) -> list[Disruption]:
    """Expose active live events for route map overlays."""

    return list_live_event_records(db)
