"""Forecast and alert based weather risk evaluation for simulated routes."""

from __future__ import annotations

import logging
from typing import Any

from ..integrations.noaa_alerts_adapter import get_us_alerts_for_point
from ..integrations.open_meteo_adapter import get_forecast_for_point
from ..models.weather_risk import WeatherRisk

logger = logging.getLogger(__name__)

SEVERE_ALERT_TERMS = (
    "severe thunderstorm",
    "tornado",
    "blizzard",
    "flood",
    "winter storm",
    "hurricane",
    "tropical storm",
)


def _coerce_float_list(values: object) -> list[float]:
    if not isinstance(values, list):
        return []

    output: list[float] = []
    for value in values:
        if isinstance(value, (int, float)):
            output.append(float(value))
    return output


def _sample_route_geometry(route_option: dict[str, object]) -> list[list[float]]:
    coordinates: list[list[float]] = []
    for leg in route_option.get("legs", []):
        if not isinstance(leg, dict):
            continue
        geometry = leg.get("geometry")
        if not isinstance(geometry, list):
            continue
        for coordinate in geometry:
            if (
                isinstance(coordinate, list)
                and len(coordinate) >= 2
                and all(isinstance(value, (int, float)) for value in coordinate[:2])
            ):
                normalized = [float(coordinate[0]), float(coordinate[1])]
                if not coordinates or coordinates[-1] != normalized:
                    coordinates.append(normalized)

    if len(coordinates) <= 3:
        return coordinates

    sample_count = min(5, len(coordinates))
    sampled: list[list[float]] = []
    last_index = len(coordinates) - 1
    for index in range(sample_count):
        coordinate_index = round((last_index * index) / max(sample_count - 1, 1))
        coordinate = coordinates[coordinate_index]
        if not sampled or sampled[-1] != coordinate:
            sampled.append(coordinate)
    return sampled


def _max_value(values: list[float]) -> float:
    return max(values) if values else 0.0


def _summarize_forecast(payload: dict[str, object]) -> tuple[float, list[str]]:
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        return 0.0, []

    precipitation = _max_value(_coerce_float_list(hourly.get("precipitation")))
    snowfall = _max_value(_coerce_float_list(hourly.get("snowfall")))
    wind_speed = _max_value(_coerce_float_list(hourly.get("wind_speed_10m")))
    wind_gusts = _max_value(_coerce_float_list(hourly.get("wind_gusts_10m")))
    weather_codes = _coerce_float_list(hourly.get("weather_code"))

    risk_score = 0.0
    reasons: list[str] = []

    if precipitation > 5.0:
        risk_score += 28.0
        reasons.append(f"Heavy precipitation forecast ({precipitation:.1f} mm/h).")
    elif precipitation > 1.5:
        risk_score += 12.0
        reasons.append(f"Moderate precipitation forecast ({precipitation:.1f} mm/h).")

    if snowfall > 0.5:
        risk_score += 30.0
        reasons.append(f"Snowfall forecast ({snowfall:.1f} mm/h).")

    if wind_speed > 40.0:
        risk_score += 18.0
        reasons.append(f"Strong sustained wind ({wind_speed:.1f} km/h).")

    if wind_gusts > 60.0:
        risk_score += 30.0
        reasons.append(f"Severe wind gusts ({wind_gusts:.1f} km/h).")
    elif wind_gusts > 45.0:
        risk_score += 14.0
        reasons.append(f"Elevated wind gusts ({wind_gusts:.1f} km/h).")

    if any(code >= 95 for code in weather_codes):
        risk_score += 26.0
        reasons.append("Thunderstorm or convective weather code in forecast.")
    elif any(code in {71, 73, 75, 77, 85, 86} for code in weather_codes):
        risk_score += 18.0
        reasons.append("Winter weather code in forecast.")

    return min(risk_score, 100.0), reasons


def _alert_score(alerts: list[dict[str, object]]) -> tuple[float, list[str]]:
    risk_score = 0.0
    reasons: list[str] = []

    for alert in alerts:
        event = str(alert.get("event", "")).lower()
        severity = str(alert.get("severity", "")).lower()
        if any(term in event for term in SEVERE_ALERT_TERMS):
            risk_score = max(risk_score, 65.0)
            reasons.append(f"NWS severe alert: {alert.get('event', 'Severe alert')}.")
            continue
        if "warning" in event or severity == "severe":
            risk_score = max(risk_score, 55.0)
            reasons.append(f"NWS warning: {alert.get('event', 'Weather warning')}.")
            continue
        if "watch" in event or severity == "moderate":
            risk_score = max(risk_score, 35.0)
            reasons.append(f"NWS watch: {alert.get('event', 'Weather watch')}.")
            continue
        if "advisory" in event or severity == "minor":
            risk_score = max(risk_score, 22.0)
            reasons.append(f"NWS advisory: {alert.get('event', 'Weather advisory')}.")

    return risk_score, reasons


def _mode_delay_hours(route_option: dict[str, object], risk_score: float) -> float:
    modes = {
        str(leg.get("mode"))
        for leg in route_option.get("legs", [])
        if isinstance(leg, dict) and leg.get("mode")
    }

    if risk_score <= 25:
        return 0.5 if modes else 0.0

    if risk_score <= 60:
        if "air" in modes:
            return 4.0
        if "sea" in modes:
            return 5.0
        return 2.5

    if "air" in modes and "sea" in modes:
        return 18.0
    if "air" in modes:
        return 10.0
    if "sea" in modes:
        return 14.0
    return 8.0


def _weather_risk_level(score: float) -> str:
    if score <= 0:
        return "unknown"
    if score <= 25:
        return "low"
    if score <= 60:
        return "medium"
    return "high"


def evaluate_weather_for_route(route_option: dict[str, object]) -> dict[str, object]:
    sampled_points = _sample_route_geometry(route_option)
    if not sampled_points:
        return WeatherRisk(
            source="combined",
            risk_level="unknown",
            risk_score=0.0,
            delay_hours=0.0,
            summary="Forecast-based estimate unavailable for this route.",
            affected_modes=list(route_option.get("mode_sequence", [])),
        ).to_dict()

    sampled_locations: list[dict[str, object]] = []
    all_alerts: list[dict[str, object]] = []
    explanation: list[str] = []
    aggregate_score = 0.0
    successful_samples = 0

    for coordinate in sampled_points:
        lng, lat = coordinate[0], coordinate[1]
        try:
            forecast = get_forecast_for_point(lat, lng)
            alerts = get_us_alerts_for_point(lat, lng)
            forecast_score, forecast_reasons = _summarize_forecast(forecast)
            alert_score, alert_reasons = _alert_score(alerts)
            sample_score = min(100.0, max(forecast_score, alert_score) + min(forecast_score, alert_score) * 0.25)
            if forecast or alerts:
                successful_samples += 1
            aggregate_score = max(aggregate_score, sample_score)
            summary = (
                forecast_reasons[0]
                if forecast_reasons
                else alert_reasons[0]
                if alert_reasons
                else "No major weather impacts detected in the next 48 hours."
            )
            sampled_locations.append(
                {
                    "lat": round(lat, 4),
                    "lng": round(lng, 4),
                    "summary": summary,
                    "risk_score": round(sample_score, 1),
                    "source": "combined" if alerts else "open_meteo",
                }
            )
            explanation.extend(forecast_reasons[:2])
            explanation.extend(alert_reasons[:2])
            all_alerts.extend(alerts)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Weather risk evaluation failed at (%s, %s): %s", lat, lng, exc)
            sampled_locations.append(
                {
                    "lat": round(lat, 4),
                    "lng": round(lng, 4),
                    "summary": "Weather lookup failed; using fallback estimate.",
                    "risk_score": 0.0,
                    "source": "combined",
                }
            )

    unique_alerts: list[dict[str, object]] = []
    seen_alerts: set[str] = set()
    for alert in all_alerts:
        alert_key = str(alert.get("id") or alert.get("event") or "")
        if alert_key and alert_key in seen_alerts:
            continue
        if alert_key:
            seen_alerts.add(alert_key)
        unique_alerts.append(alert)

    risk_level = _weather_risk_level(aggregate_score)
    summary = (
        explanation[0]
        if explanation
        else "Forecast-based estimate found limited weather impact."
        if successful_samples
        else "Forecast-based estimate unavailable; simulation used fallback weather risk."
    )

    return WeatherRisk(
        source="combined" if unique_alerts else "open_meteo",
        risk_level=risk_level,
        risk_score=round(aggregate_score, 1),
        delay_hours=_mode_delay_hours(route_option, aggregate_score),
        summary=summary,
        alerts=unique_alerts[:8],
        affected_modes=[str(mode) for mode in route_option.get("mode_sequence", [])],
        lat=float(sampled_points[0][1]),
        lng=float(sampled_points[0][0]),
        sampled_locations=sampled_locations,
        risk_explanation=explanation[:8],
    ).to_dict()


def apply_weather_risk_to_option(route_option: dict[str, object]) -> dict[str, object]:
    weather_risk = evaluate_weather_for_route(route_option)
    route_option["weather_risk"] = weather_risk

    base_time_hours = float(route_option.get("total_time_hours", 0.0))
    weather_delay = float(weather_risk.get("delay_hours", 0.0))
    route_option["base_time_hours"] = round(base_time_hours, 1)
    route_option["total_time_hours"] = round(base_time_hours + weather_delay, 1)
    route_option["total_time"] = round(float(route_option["total_time_hours"]) / 24.0, 1)

    base_risk = float(route_option.get("overall_risk_score") or route_option.get("risk_score") or 0.0)
    weather_score = float(weather_risk.get("risk_score", 0.0))
    combined_risk = min(100.0, round((base_risk * 0.7) + (weather_score * 0.3), 1))
    route_option["base_risk_score"] = round(base_risk, 1)
    route_option["risk_score"] = combined_risk
    route_option["overall_risk_score"] = combined_risk
    route_option["risk_level"] = _weather_risk_level(combined_risk if combined_risk > 0 else base_risk)
    route_option["risk"] = route_option["risk_level"]

    explanation = list(route_option.get("explanation", []))
    explanation.append(
        f"Forecast-based estimate: {weather_risk.get('summary', 'Weather signal unavailable.')}"
    )
    route_option["explanation"] = explanation[:6]
    route_option["explanations"] = route_option["explanation"]
    return route_option
