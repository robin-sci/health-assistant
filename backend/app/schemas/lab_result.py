"""Pydantic schemas for lab results."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LabResultRead(BaseModel):
    """Schema for reading a lab result."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    document_id: UUID | None = None
    test_name: str
    test_code: str | None = None
    value: float
    unit: str
    reference_min: float | None = None
    reference_max: float | None = None
    status: str | None = None
    recorded_at: date


class LabTrendPoint(BaseModel):
    """Single data point in a lab trend."""

    date: date
    value: float
    status: str | None = None


class LabTrendResponse(BaseModel):
    """Response for lab trend query."""

    test_name: str
    unit: str
    reference_min: float | None = None
    reference_max: float | None = None
    period_months: int
    count: int
    data_points: list[LabTrendPoint]
    statistics: dict | None = None
