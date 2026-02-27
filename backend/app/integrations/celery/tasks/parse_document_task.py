"""Celery task: parse a medical document via Docling OCR."""

import asyncio
import logging
from typing import Any
from uuid import UUID

from app.database import SessionLocal
from app.models.medical_document import MedicalDocument
from app.repositories.medical_document_repository import MedicalDocumentRepository
from app.schemas.medical_document import MedicalDocumentUpdate
from celery import shared_task

logger = logging.getLogger(__name__)

_repo = MedicalDocumentRepository()


@shared_task(queue="documents", bind=True, max_retries=2, default_retry_delay=30)
def parse_document(self: Any, document_id: str) -> dict[str, str]:  # type: ignore[override]
    """Parse a medical document via Docling and store extracted text.

    Args:
        document_id: UUID string of the MedicalDocument to parse.

    Returns:
        Dict with status and document_id.
    """
    from app.services.docling_service import docling_service  # noqa: PLC0415

    doc_uuid = UUID(document_id)

    with SessionLocal() as db:
        doc: MedicalDocument | None = _repo.get(db, doc_uuid)
        if not doc:
            logger.error("parse_document: document %s not found", document_id)
            return {"status": "error", "reason": "not_found", "document_id": document_id}

        # Move to parsing state
        file_path = doc.file_path
        _repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="parsing"))

    try:
        raw_text = asyncio.run(docling_service.parse_document(file_path))
    except Exception as exc:
        logger.exception("Docling parse failed for document %s: %s", document_id, exc)
        with SessionLocal() as db:
            _repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="failed"))
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {"status": "failed", "document_id": document_id, "error": str(exc)}

    # Store raw text and advance status to parsed
    with SessionLocal() as db:
        _repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="parsed", raw_text=raw_text))

    logger.info("parse_document: completed for %s, %d chars", document_id, len(raw_text))

    # Chain to extraction task
    from app.integrations.celery.tasks.extract_lab_results_task import extract_lab_results  # noqa: PLC0415

    extract_lab_results.delay(document_id)

    return {"status": "parsed", "document_id": document_id}
