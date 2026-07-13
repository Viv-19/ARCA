"""
ARCA-002 — Document Registry & Incremental Synchronization Engine
==================================================================

Persistent memory layer of the ARCA ingestion pipeline.

The Document Registry is responsible for:
  ✓ Persisting every discovered RBI circular
  ✓ Detecting duplicate documents (circular_number → detail_url → metadata_hash)
  ✓ Detecting updated versions (pdf_hash comparison)
  ✓ Tracking processing state (NEW → CLASSIFIED → DOWNLOADED → ... → COMPLETED)
  ✓ Providing a single source of truth for downstream agents

Storage:
  PostgreSQL database using asyncpg.
"""

import hashlib
import logging
import os
import datetime
import asyncio
from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Callable, Dict, Tuple

import asyncpg
from app.core.config import settings

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

logger = logging.getLogger("arca.document_registry")

# Global connection pool
db_pool: Optional[asyncpg.Pool] = None

# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class DocumentStatus(str, Enum):
    """Processing state machine for a registered document."""
    NEW = "NEW"
    CLASSIFIED = "CLASSIFIED"
    DOWNLOADED = "DOWNLOADED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    MAP_GENERATED = "MAP_GENERATED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SyncVerdict(str, Enum):
    """Result of comparing a crawled circular against the registry."""
    NEW = "NEW"                # Never seen before → queue for processing
    EXISTING = "EXISTING"      # Already registered and unchanged → ignore
    UPDATED = "UPDATED"        # Same circular but PDF content changed → reprocess


# ─────────────────────────────────────────────
# Data Models
# ─────────────────────────────────────────────

@dataclass
class RegisteredDocument:
    """A document record as stored in the registry."""
    id: str
    circular_number: str
    title: str
    publication_date: str
    department: str
    meant_for: str
    detail_url: str
    metadata_hash: str
    pdf_hash: Optional[str]
    status: str
    version: int
    created_at: str
    updated_at: str
    last_seen_at: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SyncResult:
    """
    The outcome of synchronizing crawled metadata against the registry.
    """
    new_documents: List[dict] = field(default_factory=list)
    existing_documents: List[dict] = field(default_factory=list)
    updated_documents: List[dict] = field(default_factory=list)

    @property
    def total_processed(self) -> int:
        return len(self.new_documents) + len(self.existing_documents) + len(self.updated_documents)

    def to_dict(self) -> dict:
        return {
            "new": self.new_documents,
            "existing": self.existing_documents,
            "updated": self.updated_documents,
            "summary": {
                "total_processed": self.total_processed,
                "new_count": len(self.new_documents),
                "existing_count": len(self.existing_documents),
                "updated_count": len(self.updated_documents),
            }
        }


# ─────────────────────────────────────────────
# Hashing Utilities
# ─────────────────────────────────────────────

def compute_metadata_hash(title: str, publication_date: str, detail_url: str) -> str:
    """Generates a deterministic SHA-256 fingerprint from document metadata."""
    normalized = f"{title.strip().lower()}|{publication_date.strip()}|{detail_url.strip().lower()}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def compute_pdf_hash(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()

def compute_pdf_hash_from_file(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for block in iter(lambda: f.read(4096), b""):
            sha256.update(block)
    return sha256.hexdigest()


# ─────────────────────────────────────────────
# Database Schema & Initialization
# ─────────────────────────────────────────────

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS documents (
    id                TEXT PRIMARY KEY,
    circular_number   TEXT NOT NULL,
    title             TEXT NOT NULL,
    publication_date  TEXT NOT NULL,
    department        TEXT NOT NULL DEFAULT '',
    meant_for         TEXT NOT NULL DEFAULT '',
    detail_url        TEXT NOT NULL,
    metadata_hash     TEXT NOT NULL,
    pdf_hash          TEXT,
    status            TEXT NOT NULL DEFAULT 'NEW',
    version           INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    last_seen_at      TEXT NOT NULL,
    pdf_path          TEXT,
    file_size         INTEGER,
    mime_type         TEXT,
    downloaded_at     TEXT,
    processed_path    TEXT,
    markdown_path     TEXT,
    metadata_path     TEXT,
    tables_path       TEXT,
    images_path       TEXT,
    processing_completed_at TEXT,
    parser_version    TEXT
);

CREATE INDEX IF NOT EXISTS idx_circular_number ON documents(circular_number);
CREATE INDEX IF NOT EXISTS idx_detail_url ON documents(detail_url);
CREATE INDEX IF NOT EXISTS idx_metadata_hash ON documents(metadata_hash);
CREATE INDEX IF NOT EXISTS idx_status ON documents(status);

CREATE TABLE IF NOT EXISTS raw_circulars (
    id                TEXT PRIMARY KEY,
    circular_number   TEXT NOT NULL,
    title             TEXT NOT NULL,
    publication_date  TEXT NOT NULL,
    department        TEXT NOT NULL DEFAULT '',
    meant_for         TEXT NOT NULL DEFAULT '',
    detail_url        TEXT NOT NULL,
    metadata_hash     TEXT NOT NULL,
    pdf_hash          TEXT,
    status            TEXT NOT NULL DEFAULT 'PENDING',
    version           INTEGER NOT NULL DEFAULT 1,
    relevance_reason  TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    last_seen_at      TEXT NOT NULL,
    pdf_path          TEXT,
    file_size         INTEGER,
    mime_type         TEXT,
    downloaded_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_circular_number ON raw_circulars(circular_number);
CREATE INDEX IF NOT EXISTS idx_raw_detail_url ON raw_circulars(detail_url);
CREATE INDEX IF NOT EXISTS idx_raw_metadata_hash ON raw_circulars(metadata_hash);
CREATE INDEX IF NOT EXISTS idx_raw_status ON raw_circulars(status);
"""


def _generate_id() -> str:
    import uuid
    return str(uuid.uuid4())


async def _ensure_db() -> asyncpg.Pool:
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=10)
        async with db_pool.acquire() as conn:
            await conn.execute(SCHEMA_SQL)
    return db_pool


# ─────────────────────────────────────────────
# Registry Core Operations
# ─────────────────────────────────────────────

async def _find_raw_by_circular_number(pool: asyncpg.Pool, circular_number: str) -> Optional[dict]:
    row = await pool.fetchrow("SELECT * FROM raw_circulars WHERE circular_number = $1", circular_number)
    return dict(row) if row else None


async def _find_raw_by_detail_url(pool: asyncpg.Pool, detail_url: str) -> Optional[dict]:
    row = await pool.fetchrow("SELECT * FROM raw_circulars WHERE detail_url = $1", detail_url)
    return dict(row) if row else None


async def _find_raw_by_metadata_hash(pool: asyncpg.Pool, metadata_hash: str) -> Optional[dict]:
    row = await pool.fetchrow("SELECT * FROM raw_circulars WHERE metadata_hash = $1", metadata_hash)
    return dict(row) if row else None


async def _insert_raw_document(pool: asyncpg.Pool, doc: dict) -> None:
    await pool.execute(
        """INSERT INTO raw_circulars 
           (id, circular_number, title, publication_date, department, meant_for,
            detail_url, metadata_hash, pdf_hash, status, version, created_at, updated_at, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)""",
        doc["id"],
        doc["circular_number"],
        doc["title"],
        doc["publication_date"],
        doc["department"],
        doc["meant_for"],
        doc["detail_url"],
        doc["metadata_hash"],
        doc.get("pdf_hash"),
        doc["status"],
        doc["version"],
        doc["created_at"],
        doc["updated_at"],
        doc["last_seen_at"]
    )


async def _update_raw_last_seen(pool: asyncpg.Pool, doc_id: str, now: str) -> None:
    await pool.execute(
        "UPDATE raw_circulars SET last_seen_at = $1, updated_at = $2 WHERE id = $3",
        now, now, doc_id
    )


async def _mark_raw_updated(pool: asyncpg.Pool, doc_id: str, new_version: int, now: str) -> None:
    await pool.execute(
        """UPDATE raw_circulars 
           SET version = $1, status = 'PENDING', updated_at = $2, last_seen_at = $3
           WHERE id = $4""",
        new_version, now, now, doc_id
    )

async def get_pending_raw_circulars() -> List[dict]:
    pool = await _ensure_db()
    rows = await pool.fetch("SELECT * FROM raw_circulars WHERE status = 'PENDING' ORDER BY publication_date ASC")
    return [dict(r) for r in rows]

async def get_all_raw_circular_numbers() -> List[str]:
    pool = await _ensure_db()
    rows = await pool.fetch("SELECT circular_number FROM raw_circulars")
    return [r["circular_number"] for r in rows if r["circular_number"]]

async def update_raw_circular_status(doc_id: str, status: str, reason: str = "") -> bool:
    now = datetime.datetime.utcnow().isoformat() + "Z"
    pool = await _ensure_db()
    res = await pool.execute(
        "UPDATE raw_circulars SET status = $1, relevance_reason = $2, updated_at = $3 WHERE id = $4",
        status, reason, now, doc_id
    )
    return res != "UPDATE 0"

async def promote_raw_to_document(raw_doc: dict) -> bool:
    """Copies a confirmed relevant raw circular into the main documents table."""
    pool = await _ensure_db()
    now = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Check if already in documents table
    existing = await pool.fetchrow("SELECT id FROM documents WHERE circular_number = $1", raw_doc["circular_number"])
    if existing:
        return True # Already promoted
        
    await pool.execute(
        """INSERT INTO documents 
           (id, circular_number, title, publication_date, department, meant_for,
            detail_url, metadata_hash, pdf_hash, status, version, created_at, updated_at, last_seen_at,
            pdf_path, file_size, mime_type, downloaded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)""",
        raw_doc["id"],
        raw_doc["circular_number"],
        raw_doc["title"],
        raw_doc["publication_date"],
        raw_doc["department"],
        raw_doc["meant_for"],
        raw_doc["detail_url"],
        raw_doc["metadata_hash"],
        raw_doc.get("pdf_hash"),
        "NEW", # Reset status in main table to NEW (ready for Docling)
        raw_doc["version"],
        raw_doc["created_at"],
        now,
        now,
        raw_doc.get("pdf_path"),
        raw_doc.get("file_size"),
        raw_doc.get("mime_type"),
        raw_doc.get("downloaded_at")
    )
    return True


async def delete_document(doc_id: str) -> bool:
    """Hard deletes a document from the PostgreSQL registry and its raw staging entry."""
    pool = await _ensure_db()
    # Delete from main registry first
    res = await pool.execute("DELETE FROM documents WHERE id = $1", doc_id)
    # Also delete from raw_circulars so it can be scraped again if needed
    await pool.execute("DELETE FROM raw_circulars WHERE id = $1", doc_id)
    return res != "DELETE 0"

# ─────────────────────────────────────────────
# Public API — Status Management
# ─────────────────────────────────────────────

async def update_document_status(doc_id: str, new_status: str) -> bool:
    now = datetime.datetime.utcnow().isoformat() + "Z"
    pool = await _ensure_db()
    status = await pool.execute(
        "UPDATE documents SET status = $1, updated_at = $2 WHERE id = $3",
        new_status, now, doc_id
    )
    # asyncpg execute returns a string like 'UPDATE 1'
    return status != "UPDATE 0"


async def update_pdf_hash(doc_id: str, pdf_hash: str) -> bool:
    now = datetime.datetime.utcnow().isoformat() + "Z"
    pool = await _ensure_db()
    status = await pool.execute(
        "UPDATE documents SET pdf_hash = $1, updated_at = $2 WHERE id = $3",
        pdf_hash, now, doc_id
    )
    return status != "UPDATE 0"


async def update_raw_document_download_info(
    doc_id: str, 
    pdf_path: str, 
    pdf_hash: str, 
    file_size: int, 
    mime_type: str, 
    status: str = "PENDING"
) -> bool:
    now = datetime.datetime.utcnow().isoformat() + "Z"
    pool = await _ensure_db()
    res = await pool.execute(
        """UPDATE raw_circulars 
           SET pdf_path = $1, pdf_hash = $2, file_size = $3, mime_type = $4, downloaded_at = $5, status = $6, updated_at = $7 
           WHERE id = $8""",
        pdf_path, pdf_hash, file_size, mime_type, now, status, now, doc_id
    )
    return res != "UPDATE 0"


async def update_document_processing_info(
    doc_id: str,
    processed_path: str,
    markdown_path: str,
    metadata_path: str,
    tables_path: str,
    images_path: str,
    parser_version: str,
    status: str = DocumentStatus.PROCESSED.value
) -> bool:
    now = datetime.datetime.utcnow().isoformat() + "Z"
    pool = await _ensure_db()
    res = await pool.execute(
        """UPDATE documents 
           SET processed_path = $1, markdown_path = $2, metadata_path = $3, 
               tables_path = $4, images_path = $5, processing_completed_at = $6, 
               parser_version = $7, status = $8, updated_at = $9 
           WHERE id = $10""",
        processed_path, markdown_path, metadata_path, tables_path, images_path, now, parser_version, status, now, doc_id
    )
    return res != "UPDATE 0"


async def get_documents_by_status(status: str) -> List[dict]:
    pool = await _ensure_db()
    rows = await pool.fetch("SELECT * FROM documents WHERE status = $1 ORDER BY publication_date DESC", status)
    return [dict(r) for r in rows]


async def get_all_documents() -> List[dict]:
    pool = await _ensure_db()
    rows = await pool.fetch("SELECT * FROM documents ORDER BY publication_date DESC")
    return [dict(r) for r in rows]


async def get_document_by_id(doc_id: str) -> Optional[dict]:
    pool = await _ensure_db()
    row = await pool.fetchrow("SELECT * FROM documents WHERE id = $1", doc_id)
    if row:
        return dict(row)
        
    # If not found in documents, check raw_circulars
    raw_row = await pool.fetchrow("SELECT * FROM raw_circulars WHERE id = $1", doc_id)
    if raw_row:
        raw_dict = dict(raw_row)
        # Promote it automatically so that downstream tasks (like Docling) can process it
        await promote_raw_to_document(raw_dict)
        new_row = await pool.fetchrow("SELECT * FROM documents WHERE id = $1", doc_id)
        return dict(new_row) if new_row else None
        
    return None


async def get_document_by_pdf_hash(pdf_hash: str) -> Optional[dict]:
    pool = await _ensure_db()
    row = await pool.fetchrow("SELECT * FROM documents WHERE pdf_hash = $1 AND pdf_path IS NOT NULL LIMIT 1", pdf_hash)
    return dict(row) if row else None


async def get_registry_stats() -> dict:
    pool = await _ensure_db()
    total = await pool.fetchval("SELECT COUNT(*) FROM documents")
    stats = {"total": total, "by_status": {}}
    rows = await pool.fetch("SELECT status, COUNT(*) as cnt FROM documents GROUP BY status")
    for row in rows:
        stats["by_status"][row["status"]] = row["cnt"]
    return stats


# ─────────────────────────────────────────────
# Public API — The Synchronization Engine
# ─────────────────────────────────────────────

async def synchronize(
    crawled_metadata: List[dict],
    log_callback: Optional[Callable[[str], None]] = None
) -> SyncResult:
    def log(msg: str):
        logger.info(msg)
        if log_callback:
            log_callback(msg)
    
    log("[Document Registry] ═══ Starting Incremental Synchronization ═══")
    log(f"[Document Registry] Processing {len(crawled_metadata)} crawled circulars...")
    
    now = datetime.datetime.utcnow().isoformat() + "Z"
    result = SyncResult()
    pool = await _ensure_db()
    
    for idx, meta in enumerate(crawled_metadata):
        circular_number = meta["circular_number"]
        title = meta["title"]
        publication_date = meta["publication_date"]
        department = meta.get("department", "")
        meant_for = meta.get("meant_for", "")
        detail_url = meta["detail_url"]
        
        meta_hash = compute_metadata_hash(title, publication_date, detail_url)
        
        existing = await _find_raw_by_circular_number(pool, circular_number)
        match_tier = "circular_number"
        
        if not existing:
            existing = await _find_raw_by_detail_url(pool, detail_url)
            match_tier = "detail_url"
        
        if not existing:
            existing = await _find_raw_by_metadata_hash(pool, meta_hash)
            match_tier = "metadata_hash"
        
        if existing:
            doc_id = existing["id"]
            old_hash = existing["metadata_hash"]
            if old_hash != meta_hash:
                new_version = existing["version"] + 1
                await _mark_raw_updated(pool, doc_id, new_version, now)
                
                entry = {
                    "id": doc_id,
                    "circular_number": circular_number,
                    "title": title,
                    "verdict": SyncVerdict.UPDATED.value,
                    "match_tier": match_tier,
                    "old_version": existing["version"],
                    "new_version": new_version,
                    "reason": "Metadata fingerprint changed",
                }
                result.updated_documents.append(entry)
                log(f"  [{idx+1}] UPDATED (v{new_version}) | {circular_number} | matched by {match_tier}")
            else:
                await _update_raw_last_seen(pool, doc_id, now)
                entry = {
                    "id": doc_id,
                    "circular_number": circular_number,
                    "title": title,
                    "verdict": SyncVerdict.EXISTING.value,
                    "match_tier": match_tier,
                }
                result.existing_documents.append(entry)
        
        else:
            doc_id = _generate_id()
            new_doc = {
                "id": doc_id,
                "circular_number": circular_number,
                "title": title,
                "publication_date": publication_date,
                "department": department,
                "meant_for": meant_for,
                "detail_url": detail_url,
                "metadata_hash": meta_hash,
                "pdf_hash": None,
                "status": "PENDING",
                "version": 1,
                "created_at": now,
                "updated_at": now,
                "last_seen_at": now,
            }
            await _insert_raw_document(pool, new_doc)
            
            entry = {
                "id": doc_id,
                "circular_number": circular_number,
                "title": title,
                "publication_date": publication_date,
                "department": department,
                "detail_url": detail_url,
                "verdict": SyncVerdict.NEW.value,
                "status": DocumentStatus.NEW.value,
            }
            result.new_documents.append(entry)
            log(f"  [{idx+1}] NEW | {circular_number} | {title[:60]}...")
            
    log(f"[Document Registry] ═══ Synchronization Complete ═══")
    log(f"  NEW:      {len(result.new_documents)}")
    log(f"  EXISTING: {len(result.existing_documents)}")
    log(f"  UPDATED:  {len(result.updated_documents)}")
    log(f"  TOTAL:    {result.total_processed}")
    
    return result
