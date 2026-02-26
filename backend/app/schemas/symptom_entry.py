"""Pydantic schemas for symptom entries."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SymptomEntryCreate(BaseModel):
    """Schema for creating a new symptom entry."""

    user_id: UUID
    symptom_type: str = Field(..., max_length=100)
    severity: int = Field(..., ge=0, le=10)
    notes: str | None = None
    recorded_at: datetime
    duration_minutes: int | None = None
    triggers: list[str] | None = None


class SymptomEntryRead(BaseModel):
    """Schema for reading a symptom entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    symptom_type: str
    severity: int
    notes: str | None = None
    recorded_at: datetime
    duration_minutes: int | None = None
    triggers: list | None = None


class SymptomFrequency(BaseModel):
    """Frequency stats for a symptom type."""

    count: int
    avg_severity: float
    max_severity: int
