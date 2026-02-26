"""Symptom tracking API routes."""

from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.database import DbSession
from app.repositories.symptom_entry_repository import SymptomEntryRepository
from app.schemas.symptom_entry import SymptomEntryCreate, SymptomEntryRead
from app.services import ApiKeyDep

router = APIRouter()
symptom_repo = SymptomEntryRepository()


@router.post("/symptoms", status_code=status.HTTP_201_CREATED, response_model=SymptomEntryRead)
async def create_symptom(
    payload: SymptomEntryCreate,
    db: DbSession,
    _api_key: ApiKeyDep,
):
    """Create a new symptom entry."""
    data = payload.model_dump()
    data["id"] = uuid4()
    return symptom_repo.create(db, data)


@router.get("/symptoms", response_model=list[SymptomEntryRead])
async def list_symptoms(
    user_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
    days: int = 30,
    symptom_type: str | None = None,
):
    """Get symptom entries for a user.

    Query params:
    - user_id: UUID of the user (required)
    - days: Number of days to look back (default 30)
    - symptom_type: Optional filter by symptom type (exact match)
    """
    return symptom_repo.get_by_user(db, user_id=user_id, days=days, symptom_type=symptom_type)


@router.get("/symptoms/types", response_model=list[str])
async def list_symptom_types(
    user_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
):
    """Get all distinct symptom types for a user."""
    return symptom_repo.get_distinct_types(db, user_id=user_id)
