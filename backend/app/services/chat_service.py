"""Chat service for AI health assistant conversations.

Handles chat session management and message processing with Ollama tool-calling.
"""

import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.repositories.chat_message_repository import ChatMessageRepository
from app.repositories.chat_session_repository import ChatSessionRepository
from app.schemas.chat import (
    ChatMessageCreateInternal,
    ChatSessionCreateInternal,
    ChatSessionUpdate,
)
from app.services.health_tools import HEALTH_TOOL_DEFINITIONS, execute_health_tool
from app.services.ollama_service import ollama_service
from app.services.openrouter_service import openrouter_service

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a knowledgeable and empathetic health assistant. "
    "You help users understand their health data from wearable devices, "
    "lab results, and symptom tracking.\n\n"
    "## Your Capabilities\n"
    "You have access to tools that can query:\n"
    "- **Lab Results**: Blood tests, hormone levels, medical markers with reference ranges\n"
    "- **Symptom History**: User-logged symptoms with severity, triggers, and duration\n"
    "- **Wearable Data**: Heart rate, steps, sleep, workouts, HRV, weight, and more\n"
    "- **Daily Summaries**: Combined view of all health data for a specific date\n"
    "- **Correlations**: Statistical relationships between any two health metrics\n\n"
    "## Guidelines\n"
    "1. **Always use tools** to look up real data before answering. Never guess or make up data.\n"
    "2. **Be specific**: Include actual numbers, dates, and trends.\n"
    "3. **Highlight important findings**: Flag values outside reference ranges.\n"
    "4. **Be honest about limitations**: You are not a doctor. "
    "Always recommend consulting a healthcare professional for medical decisions.\n"
    "5. **Privacy-first**: All data is stored locally. No data leaves the user's infrastructure.\n"
    "6. **Be concise but thorough**: Provide clear answers without unnecessary verbosity.\n\n"
    "## Safety Disclaimer\n"
    "You provide health data analysis and insights, NOT medical advice. "
    "Always recommend consulting a healthcare professional for:\n"
    "- Diagnosis or treatment decisions\n"
    "- Medication changes\n"
    "- Concerning symptoms or trends\n"
    "- Values significantly outside reference ranges\n\n"
    "## Date Awareness\n"
    "Today's date is {today}. Use this to calculate relative time periods "
    "(e.g., 'last week', 'past month')."
)


class ChatService:
    """Service for managing chat sessions and processing messages."""

    def __init__(self) -> None:
        self.session_repo = ChatSessionRepository(ChatSession)
        self.message_repo = ChatMessageRepository(ChatMessage)

    def create_session(
        self,
        db: Session,
        user_id: UUID,
        title: str | None = None,
    ) -> ChatSession:
        """Create a new chat session."""
        creator = ChatSessionCreateInternal(user_id=user_id, title=title)
        session = self.session_repo.create(db, creator)
        logger.info(f"Created chat session {session.id} for user {user_id}")
        return session

    def get_session(self, db: Session, session_id: UUID) -> ChatSession | None:
        """Get a chat session by ID."""
        return self.session_repo.get(db, session_id)

    def get_sessions_for_user(self, db: Session, user_id: UUID, limit: int = 50) -> list[ChatSession]:
        """Get all chat sessions for a user."""
        return self.session_repo.get_by_user(db, user_id, limit=limit)

    def delete_session(self, db: Session, session_id: UUID) -> ChatSession | None:
        """Delete a chat session and its messages (cascade)."""
        session = self.session_repo.get(db, session_id)
        if session:
            return self.session_repo.delete(db, session)
        return None

    def get_messages(self, db: Session, session_id: UUID, limit: int = 200) -> list[ChatMessage]:
        """Get all messages in a session."""
        return self.message_repo.get_by_session(db, session_id, limit=limit)

    def _save_message(
        self,
        db: Session,
        session_id: UUID,
        role: str,
        content: str,
        metadata: dict | None = None,
    ) -> ChatMessage:
        """Save a message to the database."""
        creator = ChatMessageCreateInternal(
            session_id=session_id,
            role=role,
            content=content,
            message_metadata=metadata,
        )
        message = self.message_repo.create(db, creator)

        # Update session's last_activity_at
        session = self.session_repo.get(db, session_id)
        if session:
            self.session_repo.update(
                db,
                session,
                ChatSessionUpdate(title=session.title),  # Trigger update timestamp
            )
            session.last_activity_at = datetime.now(timezone.utc)
            db.commit()

        return message

    def _build_conversation_messages(
        self,
        db: Session,
        session_id: UUID,
    ) -> list[dict[str, Any]]:
        """Build the full conversation message list for Ollama.

        Includes system prompt and conversation history.
        """
        messages: list[dict[str, Any]] = []

        # System prompt with today's date
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        messages.append(
            {
                "role": "system",
                "content": SYSTEM_PROMPT.format(today=today),
            }
        )

        # Load conversation history
        history = self.message_repo.get_by_session(db, session_id, limit=50)
        for msg in history:
            messages.append(
                {
                    "role": msg.role,
                    "content": msg.content,
                }
            )

        return messages

    async def send_message_stream(
        self,
        db: Session,
        session_id: UUID,
        user_id: UUID,
        content: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Send a user message and stream the AI response.

        Yields SSE-compatible event dicts:
        - {"type": "content", "content": "..."}
        - {"type": "tool_call", "name": "...", "arguments": {...}}
        - {"type": "tool_result", "name": "...", "result": "..."}
        - {"type": "done"}
        - {"type": "error", "error": "..."}
        """
        # Save user message
        self._save_message(db, session_id, "user", content)

        # Build conversation
        messages = self._build_conversation_messages(db, session_id)

        # Create tool executor bound to this user's data
        async def tool_executor(tool_name: str, arguments: dict) -> str:
            return await execute_health_tool(
                tool_name=tool_name,
                arguments=arguments,
                db=db,
                user_id=user_id,
            )

        # Stream response from LLM provider (Ollama or OpenRouter) with tool-calling
        assistant_content_parts: list[str] = []
        tool_calls_metadata: list[dict] = []

        try:
            llm = openrouter_service if settings.chat_provider == "openrouter" else ollama_service
            async for event in llm.chat_with_tools(
                messages=messages,
                tools=HEALTH_TOOL_DEFINITIONS,
                tool_executor=tool_executor,
            ):
                event_type = event.get("type")

                if event_type == "content":
                    chunk = event.get("content", "")
                    assistant_content_parts.append(chunk)
                    yield {"type": "content", "content": chunk}

                elif event_type == "tool_call":
                    tool_calls_metadata.append(
                        {
                            "tool": event.get("name"),
                            "arguments": event.get("arguments"),
                        }
                    )
                    yield {
                        "type": "tool_call",
                        "name": event.get("name"),
                        "arguments": event.get("arguments"),
                    }

                elif event_type == "tool_result":
                    yield {
                        "type": "tool_result",
                        "name": event.get("name"),
                        "result": event.get("result"),
                    }

                elif event_type == "done":
                    yield {"type": "done"}

            # Save assistant response
            full_content = "".join(assistant_content_parts)
            if full_content.strip():
                metadata = {"tool_calls": tool_calls_metadata} if tool_calls_metadata else None
                self._save_message(db, session_id, "assistant", full_content, metadata=metadata)

            # Auto-generate title if this is the first exchange
            session = self.session_repo.get(db, session_id)
            if session and not session.title:
                # Use first ~50 chars of user message as title
                title = content[:50].strip()
                if len(content) > 50:
                    title += "..."
                session.title = title
                db.commit()

        except Exception as e:
            logger.exception(f"Error streaming chat response: {e}")
            yield {"type": "error", "error": str(e)}


chat_service = ChatService()
