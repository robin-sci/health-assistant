from fastapi import APIRouter

from app.services import DeveloperDep
from app.services.ollama_service import ollama_service

router = APIRouter()


@router.get("/ai/status")
async def ai_status(_developer: DeveloperDep):
    """Check Ollama connection status and available models."""
    return await ollama_service.health_check()
