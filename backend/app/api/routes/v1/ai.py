from fastapi import APIRouter

from app.config import settings
from app.services import DeveloperDep
from app.services.ollama_service import ollama_service
from app.services.openrouter_service import openrouter_service

router = APIRouter()


@router.get("/ai/status")
async def ai_status(_developer: DeveloperDep):
    """Check LLM provider connection status and available models."""
    if settings.chat_provider == "openrouter":
        status = await openrouter_service.health_check()
    else:
        status = await ollama_service.health_check()
    return {"provider": settings.chat_provider, **status}
