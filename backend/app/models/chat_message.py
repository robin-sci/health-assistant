from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Index
from sqlalchemy.orm import Mapped, relationship

from app.database import BaseDbModel
from app.mappings import FKChatSession, PrimaryKey, datetime_tz, str_50

if TYPE_CHECKING:
    from app.models.chat_session import ChatSession


class ChatMessage(BaseDbModel):
    """Individual messages in a chat session."""

    __tablename__ = "chat_message"
    __table_args__ = (Index("idx_chat_message_session_created", "session_id", "created_at"),)

    id: Mapped[PrimaryKey[UUID]]
    session_id: Mapped[FKChatSession]
    role: Mapped[str_50]
    content: Mapped[str]
    message_metadata: Mapped[dict | None]
    created_at: Mapped[datetime_tz]

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")
