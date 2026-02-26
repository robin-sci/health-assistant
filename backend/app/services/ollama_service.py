"""Ollama LLM integration service for chat and tool-calling."""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Type aliases for clarity
ToolDefinition = dict[str, Any]
ChatMessage = dict[str, Any]
ToolCall = dict[str, Any]


class OllamaService:
    """Client for Ollama REST API with streaming and tool-calling support."""

    def __init__(self) -> None:
        self.base_url = settings.ollama_host.rstrip("/")
        self.chat_model = settings.ollama_chat_model
        self.extraction_model = settings.ollama_extraction_model
        self.timeout = settings.ollama_timeout

    def _client(self) -> httpx.AsyncClient:
        """Create a new async httpx client per request."""
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=10.0),
        )

    async def health_check(self) -> dict[str, Any]:
        """Check if Ollama is reachable and return status info."""
        try:
            async with self._client() as client:
                response = await client.get("/api/tags")
                response.raise_for_status()
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return {
                    "status": "connected",
                    "host": self.base_url,
                    "chat_model": self.chat_model,
                    "extraction_model": self.extraction_model,
                    "available_models": models,
                    "chat_model_available": self.chat_model in models,
                    "extraction_model_available": self.extraction_model in models,
                }
        except httpx.ConnectError:
            return {
                "status": "unreachable",
                "host": self.base_url,
                "chat_model": self.chat_model,
                "extraction_model": self.extraction_model,
                "error": f"Cannot connect to Ollama at {self.base_url}",
            }
        except Exception as e:
            return {
                "status": "error",
                "host": self.base_url,
                "error": str(e),
            }

    async def chat(
        self,
        messages: list[ChatMessage],
        model: str | None = None,
        tools: list[ToolDefinition] | None = None,
    ) -> dict[str, Any]:
        """Send a non-streaming chat request to Ollama.

        Returns the full response including message and tool_calls if any.
        """
        payload: dict[str, Any] = {
            "model": model or self.chat_model,
            "messages": messages,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools

        async with self._client() as client:
            response = await client.post("/api/chat", json=payload)
            response.raise_for_status()
            return response.json()

    async def chat_stream(
        self,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Send a streaming chat request to Ollama.

        Yields individual response chunks as parsed JSON dicts.
        Each chunk has: {"message": {"role": "assistant", "content": "..."}, "done": false}
        Final chunk has: {"done": true, "total_duration": ..., ...}
        """
        payload: dict[str, Any] = {
            "model": model or self.chat_model,
            "messages": messages,
            "stream": True,
        }

        async with self._client() as client, client.stream("POST", "/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                chunk = json.loads(line)
                yield chunk
                if chunk.get("done"):
                    break

    async def chat_with_tools(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition],
        tool_executor: Any,
        model: str | None = None,
        max_tool_rounds: int = 5,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Chat with iterative tool-calling loop.

        When the LLM returns tool_calls, executes them via tool_executor,
        feeds results back, and continues until a text response or max rounds.

        Args:
            messages: Conversation history.
            tools: Tool definitions in Ollama format.
            tool_executor: Callable(tool_name, arguments) -> str that executes tools.
            model: Model override (defaults to chat_model).
            max_tool_rounds: Max tool-calling iterations to prevent infinite loops.

        Yields:
            Event dicts with type field:
            - {"type": "tool_call", "name": ..., "arguments": ...}
            - {"type": "tool_result", "name": ..., "result": ...}
            - {"type": "content", "content": ...}  (streaming text chunks)
            - {"type": "done", "stats": ...}
        """
        conversation = list(messages)
        used_model = model or self.chat_model

        for _round in range(max_tool_rounds):
            # Non-streaming call to check for tool calls
            response = await self.chat(conversation, model=used_model, tools=tools)
            assistant_message = response.get("message", {})
            tool_calls = assistant_message.get("tool_calls")

            if not tool_calls:
                # No tool calls — use this response directly
                content = assistant_message.get("content", "")
                if content:
                    yield {"type": "content", "content": content}
                yield {"type": "done", "stats": {k: v for k, v in response.items() if k != "message"}}
                return

            # Append the assistant's tool-call message to conversation
            conversation.append(assistant_message)

            # Execute each tool call
            for tc in tool_calls:
                func = tc.get("function", {})
                tool_name = func.get("name", "")
                tool_args = func.get("arguments", {})

                yield {"type": "tool_call", "name": tool_name, "arguments": tool_args}

                try:
                    result = await tool_executor(tool_name, tool_args)
                    result_str = json.dumps(result) if not isinstance(result, str) else result
                except Exception as e:
                    logger.error(f"Tool execution failed for {tool_name}: {e}")
                    result_str = json.dumps({"error": str(e)})

                yield {"type": "tool_result", "name": tool_name, "result": result_str}

                # Feed tool result back into conversation
                conversation.append({"role": "tool", "content": result_str})

        # Max rounds reached — get final response without tools
        logger.warning(f"Max tool rounds ({max_tool_rounds}) reached, generating final response")
        async for chunk in self.chat_stream(conversation, model=used_model):
            content = chunk.get("message", {}).get("content", "")
            if content:
                yield {"type": "content", "content": content}
            if chunk.get("done"):
                yield {"type": "done", "stats": {k: v for k, v in chunk.items() if k != "message"}}


# Singleton instance
ollama_service = OllamaService()
