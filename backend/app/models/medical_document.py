from uuid import UUID

from sqlalchemy import Index
from sqlalchemy.orm import Mapped

from app.database import BaseDbModel
from app.mappings import FKUser, PrimaryKey, date_col, datetime_tz, str_50, str_100, str_255


class MedicalDocument(BaseDbModel):
    """Uploaded medical documents (PDFs, images) for health data extraction."""

    __tablename__ = "medical_document"
    __table_args__ = (Index("idx_medical_document_user_date", "user_id", "document_date"),)

    id: Mapped[PrimaryKey[UUID]]
    user_id: Mapped[FKUser]
    title: Mapped[str_255]
    document_type: Mapped[str_50]
    file_path: Mapped[str]
    file_type: Mapped[str_100]
    raw_text: Mapped[str | None]
    parsed_data: Mapped[dict | None]
    document_date: Mapped[date_col | None]
    status: Mapped[str_50]
    created_at: Mapped[datetime_tz]
