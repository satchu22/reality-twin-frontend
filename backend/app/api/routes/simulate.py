"""Simulation endpoints with business logic delegated to services."""

import logging
import math

from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ...db.session import get_db
from ...schemas.simulate import ApproveSimulationRequest, RouteSimulationRequest
from ...services.simulation_service import (
    build_deterministic_simulation_response,
    approve_simulation_decision,
    run_route_simulation,
)

router = APIRouter(tags=["simulate"])
logger = logging.getLogger(__name__)


def _is_valid_coordinate(value: float | None) -> bool:
    return value is not None and math.isfinite(value)


@router.post("/")
def simulate_route(
    data: RouteSimulationRequest,
    db: Session = Depends(get_db),
):
    """Run the route-level disruption simulation."""

    request_data = data.model_dump()
    print("INPUT:", request_data)
    logger.info("Simulation input payload: %s", request_data)

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
                logger.warning("Simulation rejected because route data was incomplete")
                return JSONResponse(
                    status_code=400,
                    content={
                        "detail": "Invalid route data",
                        "error": "Missing origin or destination coordinates",
                    },
                )

        print("SIMULATION START")
        logger.info("Simulation start")
        result = run_route_simulation(db, data)
        print("ROUTES:", result.get("options") if isinstance(result, dict) else result)
        logger.info("Simulation result: %s", result)

        if not isinstance(result, dict):
            logger.error("Simulation returned a non-dict result: %r", result)
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Simulation returned an invalid payload",
                    "error": "Simulation service did not return a JSON object",
                },
            )

        options = result.get("options")
        if not isinstance(options, list) or len(options) == 0:
            logger.warning("Simulation returned empty options; using deterministic fallback")
            fallback_result = build_deterministic_simulation_response(
                data,
                detail="Deterministic route generated because live simulation data was unavailable.",
            )
            print("ROUTES:", fallback_result.get("options"))
            return fallback_result

        return result
    except ValueError as exc:
        print("SIMULATION ERROR:", exc)
        logger.exception("Simulation failed because route data was invalid")
        return JSONResponse(
            status_code=404 if str(exc) == "No routes available" else 400,
            content={
                "detail": str(exc),
                "error": str(exc),
            },
        )
    except Exception as exc:
        print("SIMULATION ERROR:", exc)
        logger.exception("Simulation failed")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Simulation failed",
                "error": str(exc),
            },
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
