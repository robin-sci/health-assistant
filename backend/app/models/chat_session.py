from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.orm import Mapped

from app.database import BaseDbModel
from app.mappings import FKUser, OneToMany, PrimaryKey, datetime_tz, str_255

if TYPE_CHECKING:
    from app.models.chat_message import ChatMessage


class ChatSession(BaseDbModel):
    """AI chat sessions for the health assistant."""

    __tablename__ = "chat_session"

    id: Mapped[PrimaryKey[UUID]]
    user_id: Mapped[FKUser]
    title: Mapped[str_255 | None]
    created_at: Mapped[datetime_tz]
    last_activity_at: Mapped[datetime_tz]

    messages: Mapped[OneToMany["ChatMessage"]]
