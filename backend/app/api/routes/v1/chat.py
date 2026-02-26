"""Chat API routes for AI health assistant."""

import json
from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.database import DbSession
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageRead,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionRead,
)
from app.services import DeveloperDep
from app.services.chat_service import chat_service

router = APIRouter()


@router.post("/chat/sessions", status_code=status.HTTP_201_CREATED, response_model=ChatSessionRead)
async def create_session(payload: ChatSessionCreate, db: DbSession, _developer: DeveloperDep):
    """Create a new chat session for a user."""
    return chat_service.create_session(db, user_id=payload.user_id, title=payload.title)


@router.get("/chat/sessions", response_model=list[ChatSessionRead])
async def list_sessions(user_id: UUID, db: DbSession, _developer: DeveloperDep):
    """List all chat sessions for a user."""
    return chat_service.get_sessions_for_user(db, user_id=user_id)


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(session_id: UUID, db: DbSession, _developer: DeveloperDep):
    """Get a chat session with all messages."""
    session = chat_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


@router.delete("/chat/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: UUID, db: DbSession, _developer: DeveloperDep):
    """Delete a chat session and all its messages."""
    session = chat_service.delete_session(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")


@router.get("/chat/sessions/{session_id}/messages", response_model=list[ChatMessageRead])
async def list_messages(session_id: UUID, db: DbSession, _developer: DeveloperDep):
    """Get all messages in a chat session."""
    session = chat_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return chat_service.get_messages(db, session_id)


@router.post("/chat/sessions/{session_id}/messages")
async def send_message(
    session_id: UUID,
    payload: ChatMessageCreate,
    db: DbSession,
    _developer: DeveloperDep,
):
    """Send a message and receive a streaming AI response via SSE.

    Returns a Server-Sent Events stream with the following event types:
    - content: Text chunk from the AI assistant
    - tool_call: The AI is calling a health data tool
    - tool_result: Result from a tool execution
    - done: Stream complete
    - error: An error occurred
    """
    session = chat_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    async def event_stream() -> AsyncGenerator[str, None]:
        async for event in chat_service.send_message_stream(
            db=db,
            session_id=session_id,
            user_id=session.user_id,
            content=payload.content,
        ):
            data = json.dumps(event, default=str)
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
