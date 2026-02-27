"""Repository for medical document database operations."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.medical_document import MedicalDocument
from app.schemas.medical_document import MedicalDocumentCreate, MedicalDocumentUpdate


class MedicalDocumentRepository:
    """Repository for MedicalDocument queries."""

    def __init__(self) -> None:
        self.model = MedicalDocument

    def create(self, db_session: Session, data: MedicalDocumentCreate) -> MedicalDocument:
        """Create a new medical document record."""
        doc = MedicalDocument(**data.model_dump())
        db_session.add(doc)
        db_session.commit()
        db_session.refresh(doc)
        return doc

    def get(self, db_session: Session, document_id: UUID) -> MedicalDocument | None:
        """Get a medical document by ID."""
        return db_session.query(self.model).filter(self.model.id == document_id).one_or_none()

    def get_by_user(
        self,
        db_session: Session,
        user_id: UUID,
        limit: int = 50,
    ) -> list[MedicalDocument]:
        """Get all medical documents for a user, newest first."""
        return (
            db_session.query(self.model)
            .filter(self.model.user_id == user_id)
            .order_by(self.model.created_at.desc())
            .limit(limit)
            .all()
        )

    def update_status(
        self,
        db_session: Session,
        document_id: UUID,
        update: MedicalDocumentUpdate,
    ) -> MedicalDocument | None:
        """Update document status and optional fields (raw_text, parsed_data)."""
        doc = self.get(db_session, document_id)
        if not doc:
            return None
        update_data = update.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(doc, field, value)
        db_session.commit()
        db_session.refresh(doc)
        return doc

    def delete(self, db_session: Session, document_id: UUID) -> bool:
        """Delete a medical document. Returns True if deleted, False if not found."""
        doc = self.get(db_session, document_id)
        if not doc:
            return False
        db_session.delete(doc)
        db_session.commit()
        return True
