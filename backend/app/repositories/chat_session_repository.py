"""Repository for chat session database operations."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession
from app.repositories.repositories import CrudRepository
from app.schemas.chat import ChatSessionCreateInternal, ChatSessionUpdate


class ChatSessionRepository(CrudRepository[ChatSession, ChatSessionCreateInternal, ChatSessionUpdate]):
    """Repository for ChatSession CRUD and custom queries."""

    def get_by_user(self, db_session: Session, user_id: UUID, limit: int = 50) -> list[ChatSession]:
        """Get all chat sessions for a user, ordered by most recent activity."""
        return (
            db_session.query(self.model)
            .filter(self.model.user_id == user_id)
            .order_by(self.model.last_activity_at.desc())
            .limit(limit)
            .all()
        )
