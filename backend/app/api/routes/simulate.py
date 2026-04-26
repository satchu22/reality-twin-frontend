"""Simulation endpoints with business logic delegated to services."""

import logging
import math
from typing import Any

from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ...db.session import get_db
from ...schemas.simulate import ApproveSimulationRequest, RouteSimulationRequest
from ...services.simulation_service import (
    approve_simulation_decision,
    run_route_simulation,
)

router = APIRouter(tags=["simulate"])
logger = logging.getLogger(__name__)


def _is_valid_coordinate(value: float | None) -> bool:
    return value is not None and math.isfinite(value)


def _fallback_options() -> list[dict[str, Any]]:
    return [
        {
            "name": "fallback_air",
            "route_type": "air",
            "route": "Fallback route",
            "delay": 8,
            "cost": 5000,
            "total_time": 8,
            "total_cost": 5000,
            "risk": "medium",
            "score": 2.4,
            "explanation": ["Fallback route"],
            "event_types": [],
            "live_events_used": [],
            "geometry": None,
            "total_time_hours": 8,
            "total_cost_usd": 5000,
            "risk_level": "medium",
            "explanations": ["Fallback route"],
        },
        {
            "name": "fallback_sea",
            "route_type": "sea",
            "route": "Fallback route",
            "delay": 120,
            "cost": 2000,
            "total_time": 120,
            "total_cost": 2000,
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
            "route": "Fallback route",
            "delay": 36,
            "cost": 3000,
            "total_time": 36,
            "total_cost": 3000,
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


def _fallback_payload(detail: str, *, error: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "route": "Fallback route",
        "risk": "medium",
        "total_time": 36,
        "total_cost": 3000,
        "explanation": [detail],
        "best_option": "fallback_hybrid",
        "detail": detail,
        "options": _fallback_options(),
    }
    if error:
        payload["error"] = error
    return payload


@router.post("/")
def simulate_route(
    data: RouteSimulationRequest,
    db: Session = Depends(get_db),
):
    """Run the route-level disruption simulation."""

    logger.info("Simulation input payload: %s", data.model_dump())

    try:
        if data.route_id is None:
            coordinates = (
                data.origin_latitude,
                data.origin_longitude,
                data.destination_latitude,
                data.destination_longitude,
            )
            has_all_manual_coordinates = all(
                _is_valid_coordinate(value)
                for value in coordinates
            )

            if not has_all_manual_coordinates:
                logger.warning("Simulation rejected because required coordinates were missing")
                return JSONResponse(
                    status_code=400,
                    content=_fallback_payload("Missing required coordinates"),
                )

        logger.info("Simulation start")
        result = run_route_simulation(db, data)
        logger.info("Simulation result: %s", result)

        if not isinstance(result, dict):
            logger.error("Simulation returned a non-dict result: %r", result)
            return JSONResponse(
                status_code=500,
                content=_fallback_payload(
                    "Simulation failed internally",
                    error="Simulation returned an invalid payload",
                ),
            )

        options = result.get("options")
        if not isinstance(options, list) or len(options) == 0:
            logger.warning("Simulation returned empty options; using fallback response")
            normalized_result = dict(result)
            normalized_result["options"] = _fallback_options()
            normalized_result.setdefault("detail", "Simulation returned no route options")
            normalized_result.setdefault("best_option", "fallback_hybrid")
            normalized_result.setdefault("route", "Fallback route")
            normalized_result.setdefault("risk", "medium")
            normalized_result.setdefault("total_time", 36)
            normalized_result.setdefault("total_cost", 3000)
            normalized_result.setdefault("explanation", ["Fallback route"])
            return normalized_result

        return result
    except Exception as exc:
        logger.exception("Simulation failed")
        return JSONResponse(
            status_code=500,
            content=_fallback_payload(
                "Simulation failed internally",
                error=str(exc),
            ),
        )


@router.post("/{id}/approve")
def approve_simulation(
    id: int | str,
    data: ApproveSimulationRequest,
    db: Session = Depends(get_db),
):
    """Store the selected simulation option."""

    return approve_simulation_decision(
        db,
        scenario_id=id,
        selected_option=data.selected_option,
    )
