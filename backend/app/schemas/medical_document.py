"""Pydantic schemas for medical documents."""

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class MedicalDocumentCreate(BaseModel):
    """Schema for creating a medical document (populated by upload route)."""

    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    title: str
    document_type: str  # "lab_report" | "prescription" | "imaging" | "other"
    file_path: str  # UUID-based path e.g. "/app/uploads/{uuid}.pdf"
    file_type: str  # MIME type e.g. "application/pdf"
    document_date: date | None = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalDocumentRead(BaseModel):
    """Schema for reading a medical document."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    document_type: str
    file_path: str
    file_type: str
    raw_text: str | None = None
    parsed_data: dict | None = None
    document_date: date | None = None
    status: str
    created_at: datetime


class MedicalDocumentUpdate(BaseModel):
    """Schema for updating a medical document (used internally by tasks)."""

    status: str | None = None
    raw_text: str | None = None
    parsed_data: dict | None = None
