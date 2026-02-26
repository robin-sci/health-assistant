"""Repository for symptom entry database operations."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.symptom_entry import SymptomEntry


class SymptomEntryRepository:
    """Repository for SymptomEntry queries and creation."""

    def __init__(self) -> None:
        self.model = SymptomEntry

    def create(self, db_session: Session, data: dict) -> SymptomEntry:
        """Create a new symptom entry."""
        entry = SymptomEntry(**data)
        db_session.add(entry)
        db_session.commit()
        db_session.refresh(entry)
        return entry

    def get_by_user(
        self,
        db_session: Session,
        user_id: UUID,
        days: int = 30,
        symptom_type: str | None = None,
        limit: int = 100,
    ) -> list[SymptomEntry]:
        """Get symptom entries for a user."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = (
            db_session.query(self.model)
            .filter(
                self.model.user_id == user_id,
                self.model.recorded_at >= cutoff,
            )
            .order_by(self.model.recorded_at.desc())
        )
        if symptom_type:
            query = query.filter(self.model.symptom_type == symptom_type)
        return query.limit(limit).all()

    def get_distinct_types(self, db_session: Session, user_id: UUID) -> list[str]:
        """Get all distinct symptom types for a user."""
        rows = (
            db_session.query(self.model.symptom_type)
            .filter(self.model.user_id == user_id)
            .distinct()
            .order_by(self.model.symptom_type)
            .all()
        )
        return [row[0] for row in rows]
