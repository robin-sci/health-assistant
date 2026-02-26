"""OpenRouter LLM integration service — temporary testing backend.

Implements the same chat_with_tools() interface as OllamaService so ChatService
can switch providers via a single config flag. Uses the OpenAI-compatible
/chat/completions endpoint exposed by OpenRouter.

Production target remains Ollama (local, privacy-first).
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Type aliases (same as ollama_service for consistency)
ToolDefinition = dict[str, Any]
ChatMessage = dict[str, Any]


class OpenRouterService:
    """Client for OpenRouter /chat/completions with streaming and tool-calling support."""

    def __init__(self) -> None:
        self.base_url = settings.openrouter_base_url.rstrip("/")
        self.model = settings.openrouter_model
        self.timeout = settings.ollama_timeout  # Reuse same timeout setting

    def _headers(self) -> dict[str, str]:
        """Build request headers including OpenRouter etiquette headers."""
        return {
            "Authorization": f"Bearer {settings.openrouter_api_key.get_secret_value()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Health Assistant",
        }

    def _client(self) -> httpx.AsyncClient:
        """Create a new async httpx client per request."""
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._headers(),
            timeout=httpx.Timeout(self.timeout, connect=10.0),
        )

    async def health_check(self) -> dict[str, Any]:
        """Check OpenRouter connectivity and return status info."""
        try:
            async with self._client() as client:
                response = await client.get("/models")
                response.raise_for_status()
                return {
                    "status": "connected",
                    "provider": "openrouter",
                    "base_url": self.base_url,
                    "chat_model": self.model,
                }
        except httpx.ConnectError:
            return {
                "status": "unreachable",
                "provider": "openrouter",
                "base_url": self.base_url,
                "error": f"Cannot connect to OpenRouter at {self.base_url}",
            }
        except Exception as e:
            return {
                "status": "error",
                "provider": "openrouter",
                "error": str(e),
            }

    async def _chat(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition] | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        """Non-streaming chat request. Returns full response dict."""
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools

        async with self._client() as client:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            return response.json()

    async def _chat_stream(
        self,
        messages: list[ChatMessage],
        model: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat request. Yields content delta strings."""
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "stream": True,
        }

        async with self._client() as client, client.stream("POST", "/chat/completions", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue
                data = line[len("data: ") :]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse SSE chunk: {data!r}")

    async def chat_with_tools(
        self,
        messages: list[ChatMessage],
        tools: list[ToolDefinition],
        tool_executor: Any,
        model: str | None = None,
        max_tool_rounds: int = 5,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Chat with iterative tool-calling loop — same interface as OllamaService.

        Args:
            messages: Conversation history.
            tools: Tool definitions in OpenAI function-calling format.
            tool_executor: Callable(tool_name, arguments) -> str.
            model: Model override (defaults to configured model).
            max_tool_rounds: Max tool-calling iterations to prevent infinite loops.

        Yields:
            Event dicts with type field:
            - {"type": "tool_call", "name": ..., "arguments": ...}
            - {"type": "tool_result", "name": ..., "result": ...}
            - {"type": "content", "content": ...}  (streaming text chunks)
            - {"type": "done", "stats": ...}
        """
        conversation = list(messages)
        used_model = model or self.model

        for _round in range(max_tool_rounds):
            # Non-streaming call to check for tool calls
            response = await self._chat(conversation, tools=tools, model=used_model)
            choice = response.get("choices", [{}])[0]
            assistant_message = choice.get("message", {})
            finish_reason = choice.get("finish_reason", "stop")
            tool_calls = assistant_message.get("tool_calls")

            if finish_reason != "tool_calls" or not tool_calls:
                # No tool calls — stream the final response for a better UX
                content = assistant_message.get("content", "")
                if content:
                    # Already have content from non-streaming call; yield it directly
                    yield {"type": "content", "content": content}
                yield {"type": "done", "stats": {}}
                return

            # Append assistant message (with tool_calls) to conversation
            conversation.append(assistant_message)

            # Execute each tool call
            for tc in tool_calls:
                func = tc.get("function", {})
                tool_name = func.get("name", "")
                raw_args = func.get("arguments", "{}")
                try:
                    tool_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except json.JSONDecodeError:
                    logger.warning(f"Could not parse tool arguments for {tool_name}: {raw_args!r}")
                    tool_args = {}

                yield {"type": "tool_call", "name": tool_name, "arguments": tool_args}

                try:
                    result = await tool_executor(tool_name, tool_args)
                    result_str = json.dumps(result) if not isinstance(result, str) else result
                except Exception as e:
                    logger.error(f"Tool execution failed for {tool_name}: {e}")
                    result_str = json.dumps({"error": str(e)})

                yield {"type": "tool_result", "name": tool_name, "result": result_str}

                # Feed tool result back to conversation in OpenAI tool-message format
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": result_str,
                    }
                )

        # Max rounds reached — stream final response without tools
        logger.warning(f"Max tool rounds ({max_tool_rounds}) reached, generating final response")
        async for content_chunk in self._chat_stream(conversation, model=used_model):
            yield {"type": "content", "content": content_chunk}
        yield {"type": "done", "stats": {}}


# Singleton instance
openrouter_service = OpenRouterService()
