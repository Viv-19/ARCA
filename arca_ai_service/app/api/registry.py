"""
API Router for the ARCA Document Registry.

Exposes endpoints for:
  - Triggering a full collection + sync cycle
  - Querying registry state (all docs, by status, stats)
  - Updating document status and pdf_hash (for downstream stages)
"""

import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.collection_engine.rbi_collector import collect_rbi_metadata
from app.services.collection_engine.document_registry import (
    synchronize,
    get_all_documents,
    get_documents_by_status,
    get_document_by_id,
    get_registry_stats,
    update_document_status,
    update_pdf_hash,
)

router = APIRouter()


# ─────────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────────

class StatusUpdateRequest(BaseModel):
    status: str  # NEW | CLASSIFIED | DOWNLOADED | PARSED | MAP_GENERATED | COMPLETED | FAILED


class PdfHashUpdateRequest(BaseModel):
    pdf_hash: str


# ─────────────────────────────────────────────
# Global status tracker for the sync cycle
# ─────────────────────────────────────────────

sync_status = {
    "status": "IDLE",        # IDLE | RUNNING | COMPLETED | FAILED
    "last_run": None,
    "logs": [],
    "errors": [],
    "result": None,          # Last SyncResult
}


# ─────────────────────────────────────────────
# Background Task: Collect + Synchronize
# ─────────────────────────────────────────────

async def _run_sync_task():
    """
    Full pipeline: Collection Engine → Document Registry.
    
    1. Crawls the RBI index page (ARCA-001)
    2. Synchronizes crawled metadata against the registry (ARCA-002)
    3. Returns classified results (NEW / EXISTING / UPDATED)
    """
    global sync_status

    sync_status["status"] = "RUNNING"
    sync_status["errors"] = []
    sync_status["logs"] = []
    sync_status["result"] = None

    def append_log(msg: str):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sync_status["logs"].append(f"[{timestamp}] {msg}")

    try:
        # Phase 1: Collect metadata from RBI website
        append_log("[Sync] Phase 1: Running Collection Engine...")
        crawled = await collect_rbi_metadata(log_callback=append_log)
        append_log(f"[Sync] Phase 1 complete: {len(crawled)} circulars collected.")

        # Phase 2: Synchronize against the Document Registry
        append_log("[Sync] Phase 2: Running Document Registry synchronization...")
        sync_result = await synchronize(crawled, log_callback=append_log)
        
        sync_status["result"] = sync_result.to_dict()
        sync_status["status"] = "COMPLETED"
        sync_status["last_run"] = datetime.datetime.now().isoformat()
        append_log(f"[Sync] Pipeline complete.")

    except Exception as e:
        append_log(f"[Sync] FAILED: {e}")
        sync_status["status"] = "FAILED"
        sync_status["errors"].append(str(e))


# ─────────────────────────────────────────────
# Endpoints: Sync Cycle
# ─────────────────────────────────────────────

@router.post("/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    """
    POST /api/registry/sync
    
    Triggers a full Collection + Synchronization cycle.
    Returns immediately; poll /status for progress.
    """
    if sync_status["status"] == "RUNNING":
        return {
            "status": "ALREADY_RUNNING",
            "message": "A sync cycle is already in progress."
        }

    background_tasks.add_task(_run_sync_task)
    return {
        "status": "TRIGGERED",
        "message": "Collection + Registry sync started."
    }


@router.get("/sync/status")
def get_sync_status():
    """
    GET /api/registry/sync/status
    
    Returns the current sync cycle status, logs, and last result.
    """
    return sync_status


# ─────────────────────────────────────────────
# Endpoints: Registry Queries
# ─────────────────────────────────────────────

@router.get("/documents")
async def list_documents():
    """
    GET /api/registry/documents
    
    Returns all documents in the registry.
    """
    docs = await get_all_documents()
    return {"count": len(docs), "documents": docs}


@router.get("/documents/status/{status}")
async def list_documents_by_status(status: str):
    """
    GET /api/registry/documents/status/{status}
    
    Returns documents filtered by processing status.
    Valid statuses: NEW, CLASSIFIED, DOWNLOADED, PARSED, MAP_GENERATED, COMPLETED, FAILED
    """
    valid_statuses = {"NEW", "CLASSIFIED", "DOWNLOADED", "PARSED", "MAP_GENERATED", "COMPLETED", "FAILED"}
    if status.upper() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    docs = await get_documents_by_status(status.upper())
    return {"status": status.upper(), "count": len(docs), "documents": docs}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """
    GET /api/registry/documents/{doc_id}
    
    Returns a single document by its registry ID.
    """
    doc = await get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found in registry.")
    return doc


import os
from app.services.collection_engine.document_registry import delete_document

@router.delete("/documents/{doc_id}")
async def delete_document_endpoint(doc_id: str):
    """
    DELETE /api/registry/documents/{doc_id}
    
    Permanently deletes a document from the database and removes 
    all physical files (raw PDF, processed artifacts) from the filesystem.
    """
    doc = await get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found in registry.")
    
    # 1. Delete physical files safely
    files_to_delete = [
        doc.get("pdf_path"),
        doc.get("processed_path"),
        doc.get("markdown_path"),
        doc.get("metadata_path"),
        doc.get("tables_path"),
        doc.get("images_path")
    ]
    
    for file_path in files_to_delete:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                # Log but do not block deletion
                print(f"[Registry] Warning: Could not delete physical file {file_path}: {e}")
                
    # 2. Delete from PostgreSQL
    success = await delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete document from database.")
        
    return {"status": "DELETED", "id": doc_id}


@router.get("/stats")
async def registry_stats():
    """
    GET /api/registry/stats
    
    Returns aggregate statistics (total docs, count by status).
    """
    return await get_registry_stats()


# ─────────────────────────────────────────────
# Endpoints: Status & Hash Updates (for downstream stages)
# ─────────────────────────────────────────────

@router.patch("/documents/{doc_id}/status")
async def patch_document_status(doc_id: str, body: StatusUpdateRequest):
    """
    PATCH /api/registry/documents/{doc_id}/status
    
    Updates the processing status of a registered document.
    Called by downstream pipeline stages (Download Manager, Parser, etc.)
    """
    success = await update_document_status(doc_id, body.status.upper())
    if not success:
        raise HTTPException(status_code=404, detail="Document not found in registry.")
    return {"id": doc_id, "status": body.status.upper(), "updated": True}


@router.patch("/documents/{doc_id}/pdf-hash")
async def patch_pdf_hash(doc_id: str, body: PdfHashUpdateRequest):
    """
    PATCH /api/registry/documents/{doc_id}/pdf-hash
    
    Records the PDF content hash after download.
    Called by the Download Manager after successfully fetching a PDF.
    """
    success = await update_pdf_hash(doc_id, body.pdf_hash)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found in registry.")
    return {"id": doc_id, "pdf_hash": body.pdf_hash, "updated": True}
