"""Freight weight calculations shared by simulation services."""

from __future__ import annotations

from ..models.shipment import ShipmentModel

def calculate_chargeable_weight(
    shipment: ShipmentModel | None = None,
    *,
    weight_kg: float | None = None,
    volume_cbm: float | None = None,
) -> dict[str, float | str]:
    source_weight = shipment.weight_kg if shipment is not None else weight_kg
    source_volume = shipment.volume_cbm if shipment is not None else volume_cbm

    actual_weight_kg = max(float(source_weight or 0.0), 0.0)
    normalized_volume_cbm = max(float(source_volume or 0.0), 0.0)
    dimensional_weight_kg = normalized_volume_cbm * 167.0
    chargeable_weight_kg = max(actual_weight_kg, dimensional_weight_kg)

    return {
        "actual_weight_kg": round(actual_weight_kg, 1),
        "volume_cbm": round(normalized_volume_cbm, 1),
        "dimensional_weight_kg": round(dimensional_weight_kg, 1),
        "chargeable_weight_kg": round(chargeable_weight_kg, 1),
        "calculation_note": "Chargeable weight is the greater of actual weight and dimensional weight.",
    }
