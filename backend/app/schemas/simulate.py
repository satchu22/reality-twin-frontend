"""Pydantic schemas for simulation endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, model_validator

from ..services.simulation_service import DISRUPTION_MULTIPLIERS


class RouteSimulationRequest(BaseModel):
    """Request body for route disruption simulation."""

    route_id: int | None = Field(default=None, validation_alias=AliasChoices("route_id", "id"))
    distance_km: float | None = Field(default=None, gt=0)
    disruption_type: str = "weather"
    selected_mode: Literal["road", "air", "sea", "hybrid"] = "road"
    origin_name: str | None = None
    origin_latitude: float | None = Field(
        default=None,
        validation_alias=AliasChoices("origin_latitude", "origin_lat"),
    )
    origin_longitude: float | None = Field(
        default=None,
        validation_alias=AliasChoices("origin_longitude", "origin_lng"),
    )
    destination_name: str | None = None
    destination_latitude: float | None = Field(
        default=None,
        validation_alias=AliasChoices("destination_latitude", "destination_lat"),
    )
    destination_longitude: float | None = Field(
        default=None,
        validation_alias=AliasChoices("destination_longitude", "destination_lng"),
    )
    cargo_type: str | None = None
    commodity_type: Literal[
        "general",
        "electronics",
        "food",
        "pharma",
        "documents",
        "automotive",
        "machinery",
        "apparel",
        "perishable",
        "hazardous",
    ] | None = Field(
        default=None,
        validation_alias=AliasChoices("commodity_type", "cargo_type"),
    )
    goods_description: str | None = None
    shipment_weight_kg: float | None = Field(default=None, gt=0)
    shipment_volume_cbm: float | None = Field(default=None, gt=0)
    shipment_units: int | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("weight_kg", "shipment_weight_kg"),
    )
    volume_cbm: float | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("volume_cbm", "shipment_volume_cbm"),
    )
    pieces: int | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("pieces", "shipment_units"),
    )
    declared_value_usd: float = Field(default=1000, ge=0)
    pallet_count: int | None = Field(default=None, gt=0)
    temperature_controlled: bool = Field(
        default=False,
        validation_alias=AliasChoices("temperature_controlled", "cold_chain_required"),
    )
    fragile: bool = False
    hazardous: bool = Field(
        default=False,
        validation_alias=AliasChoices("hazardous", "hazardous_material"),
    )
    hazardous_material: bool = False
    cold_chain_required: bool = False
    pickup_ready_time: datetime | None = None
    delivery_deadline: datetime | None = None
    service_level: Literal["standard", "express", "economy"] = "standard"
    insurance_required: bool = False
    priority: Literal["cheapest", "fastest", "safest", "balanced"] = "balanced"

    @model_validator(mode="after")
    def validate_payload(self) -> "RouteSimulationRequest":
        if self.disruption_type not in DISRUPTION_MULTIPLIERS:
            allowed_types = ", ".join(DISRUPTION_MULTIPLIERS.keys())
            raise ValueError(f"disruption_type must be one of: {allowed_types}")

        return self


class ApproveSimulationRequest(BaseModel):
    """Request body for accepting one simulation option."""

    selected_option: str
