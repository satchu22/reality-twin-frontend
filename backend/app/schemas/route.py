"""Pydantic schemas for route, batch, and upload endpoints."""

from pydantic import BaseModel


class ManualRouteRequest(BaseModel):
    """Legacy request body for creating a route from two place names."""

    source: str
    dest: str


class RouteResponse(BaseModel):
    """Route coordinates returned to the frontend map."""

    route_id: int
    source: list[float]
    dest: list[float]
    route_name: str
    distance: float


class BatchResponse(BaseModel):
    """Metadata for a previously uploaded batch."""

    batch_id: int
    total_shipments: int
    created_at: str


class BatchDataResponse(BaseModel):
    """Shipment details returned for a selected batch."""

    route_id: int
    route: str
    cost: float
    distance: float
    source: list[float]
    dest: list[float]
