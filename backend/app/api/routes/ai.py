"""AI explanation endpoints that enrich simulation output without affecting routing."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from ...schemas.ai import AIExplainRequest, AIExplainResponse
from ...services.ai_service import generate_route_explanation

router = APIRouter(tags=["ai"])
logger = logging.getLogger(__name__)


@router.post("/explain", response_model=AIExplainResponse)
def explain_routes(data: AIExplainRequest) -> AIExplainResponse:
    """Return a human-readable explanation for route options and live events."""

    try:
        explanation = generate_route_explanation(data.route_options, data.events)
        return AIExplainResponse(explanation=explanation)
    except Exception:
        logger.exception("AI explanation generation failed")
        return AIExplainResponse(explanation="")
