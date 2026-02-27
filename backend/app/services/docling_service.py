"""Docling document parsing service for OCR and text extraction."""

import base64
import logging
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class DoclingService:
    """Client for the Docling sidecar service (OCR/PDF parsing)."""

    def __init__(self) -> None:
        self.base_url = settings.docling_url.rstrip("/")
        self.timeout = 300.0  # 5 minutes — heavy OCR can be slow

    def _client(self) -> httpx.AsyncClient:
        """Create a new async httpx client per request."""
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=10.0),
        )

    async def parse_document(self, file_path: str) -> str:
        """Parse a document file via Docling and return extracted markdown text.

        Args:
            file_path: Absolute path to the file on disk.

        Returns:
            Extracted text content as markdown string.

        Raises:
            httpx.HTTPError: If the Docling service returns an error.
            FileNotFoundError: If the file does not exist.
            ValueError: If the response contains no extractable text.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document file not found: {file_path}")

        raw_bytes = path.read_bytes()
        encoded = base64.b64encode(raw_bytes).decode("utf-8")

        payload = {
            "sources": [
                {
                    "kind": "base64",
                    "data": encoded,
                    "filename": path.name,
                }
            ]
        }

        logger.info("Sending document to Docling: %s (%d bytes)", path.name, len(raw_bytes))

        async with self._client() as client:
            response = await client.post("/v1/convert/source", json=payload)
            response.raise_for_status()
            data = response.json()

        # Extract markdown text from Docling response
        # Response structure: {"documents": [{"md_content": "..."}]}
        documents = data.get("documents") or []
        if documents:
            doc = documents[0]
            text = doc.get("md_content") or doc.get("markdown") or doc.get("output") or ""
            if text:
                logger.info("Docling extracted %d chars from %s", len(text), path.name)
                return text

        # Fallback: check top-level keys
        text = data.get("md_content") or data.get("markdown") or data.get("output") or ""
        if text:
            logger.info("Docling extracted %d chars (top-level) from %s", len(text), path.name)
            return text

        raise ValueError(f"Docling returned no extractable text for {path.name}")

    async def health_check(self) -> dict[str, str]:
        """Check if Docling sidecar is reachable."""
        try:
            async with self._client() as client:
                response = await client.get("/health")
                response.raise_for_status()
                return {"status": "connected", "host": self.base_url}
        except httpx.ConnectError:
            return {"status": "unreachable", "host": self.base_url}
        except Exception as e:
            return {"status": "error", "host": self.base_url, "error": str(e)}


# Singleton instance
docling_service = DoclingService()
