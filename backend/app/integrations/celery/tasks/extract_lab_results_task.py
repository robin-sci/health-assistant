"""Celery task: extract structured lab results from parsed document text via Ollama."""

import asyncio
import json
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models.lab_result import LabResult
from app.repositories.medical_document_repository import MedicalDocumentRepository
from app.schemas.medical_document import MedicalDocumentUpdate
from celery import shared_task

logger = logging.getLogger(__name__)

_doc_repo = MedicalDocumentRepository()

EXTRACTION_SYSTEM_PROMPT = "You are a medical data extractor. Return ONLY valid JSON."

EXTRACTION_USER_TEMPLATE = """Extract all lab results from the following medical document text.

Return a JSON object with this exact structure:
{{
  "lab_results": [
    {{
      "test_name": "Hemoglobin",
      "value": 14.2,
      "unit": "g/dL",
      "reference_min": 13.5,
      "reference_max": 17.5,
      "recorded_at": "2024-01-15",
      "status": "normal"
    }}
  ]
}}

Rules:
- "value" must be a number (not a string)
- "reference_min" and "reference_max" may be null if not stated
- "recorded_at" must be YYYY-MM-DD format; use today's date if not found
- "status" must be one of: "normal", "high", "low", or null
- Only include results with a numeric value

Document text:
{text}"""


@shared_task(queue="documents", bind=True, max_retries=2, default_retry_delay=30)
def extract_lab_results(self: Any, document_id: str) -> dict[str, str | int]:  # type: ignore[override]
    """Extract lab results from a parsed medical document via Ollama.

    Args:
        document_id: UUID string of the MedicalDocument (must be in 'parsed' status).

    Returns:
        Dict with status, document_id, and count of results extracted.
    """
    from app.services.ollama_service import ollama_service  # noqa: PLC0415

    doc_uuid = UUID(document_id)

    with SessionLocal() as db:
        doc = _doc_repo.get(db, doc_uuid)
        if not doc:
            logger.error("extract_lab_results: document %s not found", document_id)
            return {"status": "error", "reason": "not_found", "document_id": document_id}

        if not doc.raw_text:
            logger.error("extract_lab_results: document %s has no raw_text", document_id)
            _doc_repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="failed"))
            return {"status": "error", "reason": "no_raw_text", "document_id": document_id}

        raw_text = doc.raw_text
        user_id = doc.user_id
        _doc_repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="extracting"))

    # Call Ollama for structured extraction
    messages = [
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": EXTRACTION_USER_TEMPLATE.format(text=raw_text[:8000])},
    ]

    try:
        # Pass format="json" to ensure structured output from Ollama
        response = asyncio.run(ollama_service.chat(messages, format="json"))
        content = response.get("message", {}).get("content", "")
        extracted = json.loads(content)
    except Exception as exc:
        logger.exception("Ollama extraction failed for document %s: %s", document_id, exc)
        with SessionLocal() as db:
            _doc_repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="failed"))
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {"status": "failed", "document_id": document_id, "error": str(exc)}

    lab_results_data: list[dict] = extracted.get("lab_results", [])
    saved_count = 0
    skipped_count = 0

    today_str = date.today().isoformat()

    with SessionLocal() as db:
        for item in lab_results_data:
            # Parse value — skip if not numeric
            try:
                value = Decimal(str(item.get("value", "")))
            except (InvalidOperation, TypeError, ValueError):
                logger.debug("Skipping non-numeric result: %s", item)
                skipped_count += 1
                continue

            # Parse optional numeric fields
            def _to_decimal(v: object) -> Decimal | None:
                if v is None:
                    return None
                try:
                    return Decimal(str(v))
                except (InvalidOperation, TypeError, ValueError):
                    return None

            # Parse date
            recorded_at_str = item.get("recorded_at") or today_str
            try:
                recorded_at = date.fromisoformat(str(recorded_at_str))
            except ValueError:
                recorded_at = date.today()

            status_val = item.get("status")
            if status_val not in ("normal", "high", "low", None):
                status_val = None

            lab = LabResult(
                id=uuid4(),
                document_id=doc_uuid,
                user_id=user_id,
                test_name=str(item.get("test_name", "Unknown")).strip(),
                test_code=None,
                value=value,
                unit=str(item.get("unit", "")).strip() or "?",
                reference_min=_to_decimal(item.get("reference_min")),
                reference_max=_to_decimal(item.get("reference_max")),
                status=status_val,
                recorded_at=recorded_at,
            )

            try:
                db.add(lab)
                db.flush()  # detect IntegrityError early
                saved_count += 1
            except IntegrityError:
                db.rollback()
                logger.debug(
                    "Duplicate lab result skipped: user=%s test=%s date=%s",
                    user_id,
                    lab.test_name,
                    recorded_at,
                )
                skipped_count += 1
            else:
                db.commit()

        _doc_repo.update_status(db, doc_uuid, MedicalDocumentUpdate(status="completed"))

    logger.info(
        "extract_lab_results: document %s — saved %d, skipped %d",
        document_id,
        saved_count,
        skipped_count,
    )

    return {
        "status": "completed",
        "document_id": document_id,
        "saved": saved_count,
        "skipped": skipped_count,
    }
