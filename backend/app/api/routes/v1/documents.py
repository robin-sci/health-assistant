"""Medical document upload and management API routes."""

import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.params import File, Form

from app.config import settings
from app.database import DbSession
from app.repositories.medical_document_repository import MedicalDocumentRepository
from app.schemas.medical_document import MedicalDocumentCreate, MedicalDocumentRead
from app.services import ApiKeyDep

router = APIRouter()
_repo = MedicalDocumentRepository()

# Allowed MIME types for document uploads
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tiff",
    "image/webp",
}


@router.post(
    "/documents/upload",
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    db: DbSession,
    _api_key: ApiKeyDep,
    file: UploadFile = File(...),
    user_id: UUID = Form(...),
    title: str = Form(...),
    document_type: str = Form(...),
    document_date: str | None = Form(None),
) -> MedicalDocumentRead:
    """Upload a medical document (PDF or image) for async parsing.

    Returns 202 Accepted immediately — parsing happens asynchronously.
    Poll GET /documents/{id} to check status.

    Body (multipart/form-data):
    - file: The document file (PDF, JPEG, PNG, TIFF, WebP)
    - user_id: UUID of the document owner
    - title: Human-readable title
    - document_type: lab_report | prescription | imaging | other
    - document_date: Optional date of the document (YYYY-MM-DD)
    """
    # Validate file size
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.max_upload_size_mb} MB",
        )

    # Validate MIME type
    file_type = file.content_type or "application/octet-stream"
    if file_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file_type}. Allowed: PDF, JPEG, PNG, TIFF, WebP",
        )

    # Determine file extension from content type
    ext_map = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/tiff": ".tiff",
        "image/webp": ".webp",
    }
    ext = ext_map.get(file_type, "")

    # Save file with UUID-based name to prevent path traversal
    file_name = f"{uuid.uuid4()}{ext}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file_name
    file_path.write_bytes(content)

    # Parse optional document_date
    from datetime import date  # noqa: PLC0415

    parsed_date: date | None = None
    if document_date:
        try:
            parsed_date = date.fromisoformat(document_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="document_date must be in YYYY-MM-DD format",
            )

    # Create database record
    doc_create = MedicalDocumentCreate(
        user_id=user_id,
        title=title,
        document_type=document_type,
        file_path=str(file_path),
        file_type=file_type,
        document_date=parsed_date,
        status="pending",
    )
    doc = _repo.create(db, doc_create)

    # Dispatch Celery task (local import avoids circular import at module load)
    from app.integrations.celery.tasks.parse_document_task import parse_document

    parse_document.delay(str(doc.id))

    return MedicalDocumentRead.model_validate(doc)


@router.get("/documents")
async def list_documents(
    user_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
    limit: int = 50,
) -> list[MedicalDocumentRead]:
    """List all medical documents for a user, newest first."""
    docs = _repo.get_by_user(db, user_id=user_id, limit=limit)
    return [MedicalDocumentRead.model_validate(d) for d in docs]


@router.get("/documents/{document_id}")
async def get_document(
    document_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
) -> MedicalDocumentRead:
    """Get a single medical document by ID (use for status polling)."""
    doc = _repo.get(db, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return MedicalDocumentRead.model_validate(doc)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
) -> None:
    """Delete a medical document and its file from disk."""
    doc = _repo.get(db, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Delete file from disk
    file_path = Path(doc.file_path)
    if file_path.exists():
        file_path.unlink()

    _repo.delete(db, document_id)
