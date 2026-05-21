"""Shared shipment model for simulation inputs."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Literal


CommodityType = Literal[
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
]
ShipmentPriority = Literal["cheapest", "fastest", "safest", "balanced"]
ServiceLevel = Literal["standard", "express", "economy"]


@dataclass(frozen=True)
class ShipmentModel:
    commodity_type: CommodityType = "general"
    weight_kg: float = 100.0
    volume_cbm: float = 1.0
    pieces: int = 1
    declared_value_usd: float = 1000.0
    priority: ShipmentPriority = "balanced"
    temperature_controlled: bool = False
    fragile: bool = False
    hazardous: bool = False
    pickup_ready_time: datetime | None = None
    delivery_deadline: datetime | None = None
    service_level: ServiceLevel = "standard"
    insurance_required: bool = False
    goods_description: str = "General freight"
    pallet_count: int = 1

    def __post_init__(self) -> None:
        normalized_commodity_type = str(self.commodity_type).strip().lower()
        normalized_priority = str(self.priority).strip().lower()
        normalized_service_level = str(self.service_level).strip().lower()
        normalized_goods_description = str(self.goods_description).strip() or "General freight"

        if normalized_commodity_type not in {
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
        }:
            raise ValueError(f"Unsupported commodity_type: {self.commodity_type}")

        if normalized_priority not in {"cheapest", "fastest", "safest", "balanced"}:
            raise ValueError(f"Unsupported priority: {self.priority}")

        if normalized_service_level not in {"standard", "express", "economy"}:
            raise ValueError(f"Unsupported service_level: {self.service_level}")

        if float(self.weight_kg) <= 0:
            raise ValueError("weight_kg must be greater than 0")

        if float(self.volume_cbm) <= 0:
            raise ValueError("volume_cbm must be greater than 0")

        if int(self.pieces) < 1:
            raise ValueError("pieces must be at least 1")

        if float(self.declared_value_usd) < 0:
            raise ValueError("declared_value_usd cannot be negative")

        if int(self.pallet_count) < 1:
            raise ValueError("pallet_count must be at least 1")

        object.__setattr__(self, "commodity_type", normalized_commodity_type)
        object.__setattr__(self, "priority", normalized_priority)
        object.__setattr__(self, "service_level", normalized_service_level)
        object.__setattr__(self, "goods_description", normalized_goods_description)
        object.__setattr__(self, "weight_kg", float(self.weight_kg))
        object.__setattr__(self, "volume_cbm", float(self.volume_cbm))
        object.__setattr__(self, "pieces", int(self.pieces))
        object.__setattr__(self, "declared_value_usd", float(self.declared_value_usd))
        object.__setattr__(self, "pallet_count", int(self.pallet_count))

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
