"""Repository for lab result database operations."""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.lab_result import LabResult


class LabResultRepository:
    """Repository for LabResult queries."""

    def __init__(self) -> None:
        self.model = LabResult

    def get_by_user(
        self,
        db_session: Session,
        user_id: UUID,
        days: int = 90,
        test_name: str | None = None,
        limit: int = 50,
    ) -> list[LabResult]:
        """Get recent lab results for a user."""
        cutoff = date.today() - timedelta(days=days)
        query = (
            db_session.query(self.model)
            .filter(
                self.model.user_id == user_id,
                self.model.recorded_at >= cutoff,
            )
            .order_by(self.model.recorded_at.desc(), self.model.test_name)
        )
        if test_name:
            query = query.filter(self.model.test_name.ilike(f"%{test_name}%"))
        return query.limit(limit).all()

    def get_trend(
        self,
        db_session: Session,
        user_id: UUID,
        test_name: str,
        months: int = 12,
    ) -> list[LabResult]:
        """Get trend data for a specific lab test."""
        cutoff = date.today() - timedelta(days=months * 30)
        return (
            db_session.query(self.model)
            .filter(
                self.model.user_id == user_id,
                self.model.test_name.ilike(f"%{test_name}%"),
                self.model.recorded_at >= cutoff,
            )
            .order_by(self.model.recorded_at.asc())
            .all()
        )

    def get_distinct_test_names(self, db_session: Session, user_id: UUID) -> list[str]:
        """Get all distinct test names for a user."""
        rows = (
            db_session.query(self.model.test_name)
            .filter(self.model.user_id == user_id)
            .distinct()
            .order_by(self.model.test_name)
            .all()
        )
        return [row[0] for row in rows]
