"""Pydantic schemas for AI chat sessions and messages."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

# --- Chat Session Schemas ---


class ChatSessionCreate(BaseModel):
    """Schema for creating a new chat session."""

    user_id: UUID
    title: str | None = Field(None, max_length=255)


class ChatSessionCreateInternal(ChatSessionCreate):
    """Internal schema with auto-generated fields."""

    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatSessionRead(BaseModel):
    """Schema for reading a chat session (list view)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str | None = None
    created_at: datetime
    last_activity_at: datetime


class ChatSessionDetail(ChatSessionRead):
    """Schema for reading a chat session with messages."""

    messages: list["ChatMessageRead"] = []


class ChatSessionUpdate(BaseModel):
    """Schema for updating a chat session."""

    title: str | None = Field(None, max_length=255)


# --- Chat Message Schemas ---


class ChatMessageCreate(BaseModel):
    """Schema for sending a new user message."""

    content: str = Field(..., min_length=1, max_length=10000)


class ChatMessageCreateInternal(BaseModel):
    """Internal schema for creating a message in the DB."""

    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    role: str
    content: str
    message_metadata: dict | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatMessageRead(BaseModel):
    """Schema for reading a chat message."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    role: str
    content: str
    message_metadata: dict | None = None
    created_at: datetime


# --- SSE Event Schemas ---


class ChatStreamEvent(BaseModel):
    """Schema for SSE stream events."""

    type: str  # "content", "tool_call", "tool_result", "done", "error"
    content: str | None = None
    tool_name: str | None = None
    tool_args: dict | None = None
    tool_result: str | None = None
    error: str | None = None


# Rebuild forward refs
ChatSessionDetail.model_rebuild()
