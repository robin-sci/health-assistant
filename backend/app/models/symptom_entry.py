from uuid import UUID

from sqlalchemy import Index
from sqlalchemy.orm import Mapped

from app.database import BaseDbModel
from app.mappings import FKUser, PrimaryKey, datetime_tz, str_100


class SymptomEntry(BaseDbModel):
    """Daily symptom tracking entries."""

    __tablename__ = "symptom_entry"
    __table_args__ = (Index("idx_symptom_user_type_date", "user_id", "symptom_type", "recorded_at"),)

    id: Mapped[PrimaryKey[UUID]]
    user_id: Mapped[FKUser]
    symptom_type: Mapped[str_100]
    severity: Mapped[int]
    notes: Mapped[str | None]
    recorded_at: Mapped[datetime_tz]
    duration_minutes: Mapped[int | None]
    triggers: Mapped[list | None]
