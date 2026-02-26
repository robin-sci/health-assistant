"""Repository for chat message database operations."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.chat_message import ChatMessage
from app.repositories.repositories import CrudRepository
from app.schemas.chat import ChatMessageCreateInternal, ChatSessionUpdate


class ChatMessageRepository(CrudRepository[ChatMessage, ChatMessageCreateInternal, ChatSessionUpdate]):
    """Repository for ChatMessage CRUD and custom queries."""

    def get_by_session(
        self,
        db_session: Session,
        session_id: UUID,
        limit: int = 200,
    ) -> list[ChatMessage]:
        """Get all messages for a session, ordered chronologically."""
        return (
            db_session.query(self.model)
            .filter(self.model.session_id == session_id)
            .order_by(self.model.created_at.asc())
            .limit(limit)
            .all()
        )

    def count_by_session(self, db_session: Session, session_id: UUID) -> int:
        """Count messages in a session."""
        return db_session.query(self.model).filter(self.model.session_id == session_id).count()
