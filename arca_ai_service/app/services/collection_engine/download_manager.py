import os
import hashlib
import logging
import asyncio
from datetime import datetime
from urllib.parse import urljoin
from typing import Dict, Any, Optional

import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.services.collection_engine.document_registry import (
    get_document_by_id,
    get_document_by_pdf_hash,
    update_document_download_info,
    DocumentStatus
)

# ─────────────────────────────────────────────
# Constants & Configuration
# ─────────────────────────────────────────────

logger = logging.getLogger("arca.download_manager")

STORAGE_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "storage", "pdf")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Timeout settings
TIMEOUT_FETCH_HTML = httpx.Timeout(15.0)
TIMEOUT_DOWNLOAD_PDF = httpx.Timeout(60.0)

# Retry settings
RETRY_EXCEPTIONS = (httpx.RequestError, httpx.TimeoutException)


# ─────────────────────────────────────────────
# Core Functions
# ─────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(RETRY_EXCEPTIONS),
    reraise=True
)
async def _fetch_detail_page(url: str, client: httpx.AsyncClient) -> str:
    """Fetches the HTML of the detail page to extract the PDF link."""
    response = await client.get(url, timeout=TIMEOUT_FETCH_HTML)
    response.raise_for_status()
    return response.text


def _extract_pdf_url(html_content: str, base_url: str) -> Optional[str]:
    """
    Robustly extracts the official PDF link from the RBI detail page HTML.
    
    Strategies:
      1. Find any anchor tag with href ending in .PDF (case-insensitive)
      2. Check common table cells or specific buttons
    """
    soup = BeautifulSoup(html_content, "html.parser")
    
    # RBI typically uses links like <a href="...Notification/PDFs/...">PDF</a>
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if href.lower().endswith(".pdf"):
            return urljoin(base_url, href)
            
    return None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=4, max=20),
    retry=retry_if_exception_type(RETRY_EXCEPTIONS),
    reraise=True
)
async def _download_pdf_bytes(pdf_url: str, client: httpx.AsyncClient) -> bytes:
    """Streams the PDF download into memory for validation and hashing."""
    logger.debug(f"[Downloader] Streaming PDF from {pdf_url}")
    
    # We buffer into memory since circulars are usually small (1-10MB).
    # If they were massive, we'd stream directly to disk, but we need the hash first
    # to avoid disk I/O on duplicates.
    buffer = bytearray()
    
    async with client.stream("GET", pdf_url, timeout=TIMEOUT_DOWNLOAD_PDF) as response:
        response.raise_for_status()
        
        content_type = response.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and "octet-stream" not in content_type.lower():
            logger.warning(f"[Downloader] Unexpected Content-Type: {content_type}")
            
        async for chunk in response.aiter_bytes():
            buffer.extend(chunk)
            
    if len(buffer) == 0:
        raise ValueError("Downloaded PDF is empty (0 bytes).")
        
    return bytes(buffer)


def _compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _save_pdf_to_disk(circular_number: str, pdf_bytes: bytes) -> str:
    """
    Saves the PDF to an atomic, structured directory path:
    data/storage/pdf/YYYY/MM/RBI_{sanitized_circular_number}.pdf
    """
    now = datetime.utcnow()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    
    # Sanitize circular number for filesystem
    safe_name = circular_number.replace("/", "_").replace("\\", "_").replace(" ", "_")
    file_name = f"RBI_{safe_name}.pdf"
    
    dir_path = os.path.join(STORAGE_BASE_DIR, year, month)
    os.makedirs(dir_path, exist_ok=True)
    
    file_path = os.path.join(dir_path, file_name)
    
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)
        
    return os.path.abspath(file_path)


# ─────────────────────────────────────────────
# Public Service API
# ─────────────────────────────────────────────

async def download_document(document_id: str, detail_url: str) -> Dict[str, Any]:
    """
    Orchestrates the entire document acquisition process.
    
    1. Fetches detail page
    2. Extracts PDF URL
    3. Downloads bytes
    4. Computes SHA256
    5. Prevents duplicates
    6. Saves to disk
    7. Updates registry
    
    Returns structured output mapping to the requirements.
    """
    logger.info(f"[Downloader] Starting download for document_id: {document_id}")
    
    try:
        # Verify document exists
        doc = await get_document_by_id(document_id)
        if not doc:
            raise ValueError(f"Document ID {document_id} not found in registry.")
            
        circular_number = doc["circular_number"]
        
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, verify=False) as client:
            # 1. Fetch HTML
            logger.info(f"[Downloader] Locating official PDF link for {circular_number}...")
            html_content = await _fetch_detail_page(detail_url, client)
            
            # 2. Extract PDF Link
            pdf_url = _extract_pdf_url(html_content, detail_url)
            if not pdf_url:
                raise ValueError(f"Could not locate PDF anchor link on page: {detail_url}")
                
            logger.info(f"[Downloader] PDF located at: {pdf_url}")
            
            # 3. Download Bytes
            logger.info("[Downloader] Streaming download...")
            pdf_bytes = await _download_pdf_bytes(pdf_url, client)
            file_size = len(pdf_bytes)
            
            # 4. Hash
            pdf_hash = _compute_sha256(pdf_bytes)
            logger.info(f"[Downloader] SHA256 calculated: {pdf_hash[:16]}... Size: {file_size} bytes")
            
            # 5. Duplicate Detection
            existing_doc = await get_document_by_pdf_hash(pdf_hash)
            if existing_doc and existing_doc["id"] != document_id and existing_doc.get("pdf_path"):
                logger.info("[Downloader] Duplicate = True. PDF with identical hash already exists.")
                pdf_path = existing_doc["pdf_path"]
            else:
                logger.info("[Downloader] Duplicate = False. Proceeding to save.")
                # 6. Save to disk
                pdf_path = _save_pdf_to_disk(circular_number, pdf_bytes)
                logger.info(f"[Downloader] Stored successfully at: {pdf_path}")
            
            # 7. Update Registry
            success = await update_document_download_info(
                doc_id=document_id,
                pdf_path=pdf_path,
                pdf_hash=pdf_hash,
                file_size=file_size,
                mime_type="application/pdf"
            )
            
            if success:
                logger.info("[Downloader] Registry updated successfully. Status: DOWNLOADED")
            else:
                logger.warning("[Downloader] Failed to update registry (DB write issue).")

            return {
                "document_id": document_id,
                "pdf_path": pdf_path,
                "checksum": pdf_hash,
                "file_size": file_size,
                "download_status": DocumentStatus.DOWNLOADED.value,
            }
            
    except Exception as e:
        logger.error(f"[Downloader] Download failed for {document_id}: {str(e)}")
        
        # Best effort update on failure
        try:
            from app.services.collection_engine.document_registry import update_document_status
            await update_document_status(document_id, DocumentStatus.FAILED.value)
        except Exception as db_err:
            logger.error(f"[Downloader] Could not update status to FAILED: {db_err}")
            
        return {
            "document_id": document_id,
            "download_status": DocumentStatus.FAILED.value,
            "reason": str(e)
        }
