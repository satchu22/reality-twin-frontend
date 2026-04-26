"""AI explanation helpers for route decision summaries.

This service is intentionally sidecar-only: it reads simulation output and
returns human-readable guidance without participating in scoring or routing.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are a logistics expert.

Given these route options:

{routes}

And these real-world conditions:

{events}

Explain:

1. Why each route is good or bad
2. Which route is best and why
3. Keep explanation simple and clear"""


def _format_routes(route_options: list[dict[str, Any]]) -> str:
    if not route_options:
        return "No route options were provided."

    lines: list[str] = []
    for index, option in enumerate(route_options[:3], start=1):
        lines.append(
            (
                f"{index}. {option.get('route_type', option.get('name', 'Unknown route'))}: "
                f"time={option.get('total_time', option.get('total_time_hours', 'n/a'))}, "
                f"cost={option.get('total_cost', option.get('total_cost_usd', 'n/a'))}, "
                f"risk={option.get('risk', option.get('risk_level', 'unknown'))}, "
                f"explanation={', '.join(option.get('explanation', option.get('explanations', []))[:2]) or 'None'}"
            )
        )
    return "\n".join(lines)


def _format_events(events: list[dict[str, Any]]) -> str:
    if not events:
        return "No major live events were detected."

    lines: list[str] = []
    for event in events[:6]:
        lines.append(
            (
                f"- {event.get('source', 'unknown')} / {event.get('severity', 'unknown')}: "
                f"{event.get('description', 'No description')}"
            )
        )
    return "\n".join(lines)


def _pick_best_option(route_options: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not route_options:
        return None

    def option_key(option: dict[str, Any]) -> tuple[float, float, float]:
        score = option.get("score")
        total_time = option.get("total_time", option.get("total_time_hours", 10**9))
        total_cost = option.get("total_cost", option.get("total_cost_usd", 10**9))
        normalized_score = float(score) if isinstance(score, (int, float)) else float(total_time)
        normalized_time = float(total_time) if isinstance(total_time, (int, float)) else 10**9
        normalized_cost = float(total_cost) if isinstance(total_cost, (int, float)) else 10**9
        return (normalized_score, normalized_time, normalized_cost)

    return min(route_options, key=option_key)


def _route_reason(option: dict[str, Any]) -> str:
    route_type = option.get("route_type", option.get("name", "This route"))
    risk = str(option.get("risk", option.get("risk_level", "unknown"))).lower()
    time = option.get("total_time", option.get("total_time_hours", "n/a"))
    cost = option.get("total_cost", option.get("total_cost_usd", "n/a"))
    explanation = option.get("explanation", option.get("explanations", []))
    lead = explanation[0] if isinstance(explanation, list) and explanation else "No extra constraints were detected."

    strengths: list[str] = []
    if risk == "low":
        strengths.append("keeps operational risk lower")
    elif risk == "medium":
        strengths.append("balances speed and exposure")
    else:
        strengths.append("moves quickly but carries more disruption exposure")

    strengths.append(f"takes about {time}")
    strengths.append(f"costs around {cost}")

    return f"{route_type} is useful when the team wants a route that {'; '.join(strengths)}. Main consideration: {lead}"


def build_explanation_prompt(
    route_options: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> str:
    """Build the explanation prompt for future provider upgrades."""

    return PROMPT_TEMPLATE.format(
        routes=_format_routes(route_options),
        events=_format_events(events),
    )


def generate_route_explanation(
    route_options: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> str:
    """Generate a simple human-readable summary for route decisions.

    This keeps the architecture provider-ready while staying dependency-light.
    If a real model is added later, it can use ``build_explanation_prompt`` and
    preserve the same contract.
    """

    prompt = build_explanation_prompt(route_options, events)
    logger.debug("AI explanation prompt prepared: %s", prompt)

    if not route_options:
        return ""

    best_option = _pick_best_option(route_options)
    route_lines = [_route_reason(option) for option in route_options[:3]]
    event_summary = (
        "Current conditions include "
        + ", ".join(
            f"{event.get('source', 'unknown')} ({event.get('severity', 'unknown')})"
            for event in events[:4]
        )
        + "."
        if events
        else "Current conditions are relatively stable with no major blocking live events."
    )

    best_line = ""
    if best_option:
        best_type = best_option.get("route_type", best_option.get("name", "Best route"))
        best_reason = best_option.get("explanation", best_option.get("explanations", []))
        best_line = (
            f"Best route: {best_type}. It stands out because "
            f"{best_reason[0] if isinstance(best_reason, list) and best_reason else 'it offers the strongest overall tradeoff across time, cost, and risk'}."
        )

    sections = [event_summary, *route_lines, best_line]
    return "\n\n".join(section for section in sections if section)
