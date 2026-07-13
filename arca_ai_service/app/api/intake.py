"""
API Router for the ARCA Intelligent Intake Pipeline.

Endpoints:
  POST /api/intake/evaluate       — Run intake on a single document by registry ID
  POST /api/intake/evaluate-batch — Run intake on all NEW documents in the registry
  GET  /api/intake/config         — View current intake configuration
"""

import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.pipelines.intake_pipeline import run_intake_for_document, run_intake_batch
from app.models.intake import INTAKE_CONFIG
from app.services.collection_engine.document_registry import (
    get_document_by_id,
    get_pending_raw_circulars,
    update_raw_circular_status,
    promote_raw_to_document,
)

router = APIRouter()


# ─────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────

class EvaluateSingleRequest(BaseModel):
    document_id: str


# ─────────────────────────────────────────────
# Background task state for batch processing
# ─────────────────────────────────────────────

batch_status = {
    "status": "IDLE",  # IDLE | RUNNING | COMPLETED | FAILED
    "last_run": None,
    "logs": [],
    "results": [],
    "summary": {},
}


async def _run_batch_intake():
    """Background task: runs intake for all NEW documents in the registry."""
    global batch_status

    batch_status["status"] = "RUNNING"
    batch_status["logs"] = []
    batch_status["results"] = []
    batch_status["summary"] = {}

    def append_log(msg: str):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        batch_status["logs"].append(f"[{timestamp}] {msg}")

    try:
        # Get all PENDING documents from the raw circulars staging registry
        new_docs = await get_pending_raw_circulars()
        append_log(f"[Intake Batch] Found {len(new_docs)} PENDING documents in raw staging registry.")

        if not new_docs:
            append_log("[Intake Batch] Nothing to process. Exiting.")
            batch_status["status"] = "COMPLETED"
            batch_status["last_run"] = datetime.datetime.now().isoformat()
            batch_status["summary"] = {
                "total": 0, "relevant": 0, "not_relevant": 0, "failed": 0
            }
            return

        # Run intake pipeline for each document
        results = await run_intake_batch(new_docs, log_callback=append_log)
        batch_status["results"] = results

        # Update registry status for classified documents
        relevant_count = 0
        not_relevant_count = 0
        failed_count = 0

        for result in results:
            doc_id = None
            # Find the matching document by circular_number
            for doc in new_docs:
                if doc.get("circular_number") == result.get("circular_number"):
                    doc_id = doc.get("id")
                    break

            if not doc_id:
                continue

            decision = result.get("decision", {})
            if result.get("processing_status") == "FAILED":
                failed_count += 1
                await update_raw_circular_status(doc_id, "FAILED", str(result.get("error", "Unknown error")))
            elif decision.get("relevant", False):
                relevant_count += 1
                await update_raw_circular_status(doc_id, "RELEVANT", decision.get("reason", ""))
                # Promote to main documents registry for processing
                
                # Find the full raw doc
                raw_doc = next((d for d in new_docs if d["id"] == doc_id), None)
                if raw_doc:
                    await promote_raw_to_document(raw_doc)
            else:
                not_relevant_count += 1
                await update_raw_circular_status(doc_id, "IRRELEVANT", decision.get("reason", ""))

        batch_status["summary"] = {
            "total": len(results),
            "relevant": relevant_count,
            "not_relevant": not_relevant_count,
            "failed": failed_count,
        }
        batch_status["status"] = "COMPLETED"
        batch_status["last_run"] = datetime.datetime.now().isoformat()
        append_log(f"[Intake Batch] Complete. Relevant: {relevant_count}, Not Relevant: {not_relevant_count}, Failed: {failed_count}")

    except Exception as e:
        append_log(f"[Intake Batch] FAILED: {e}")
        batch_status["status"] = "FAILED"


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.post("/evaluate")
async def evaluate_single(body: EvaluateSingleRequest):
    """
    POST /api/intake/evaluate
    
    Runs the Intelligent Intake Pipeline for a single document.
    Looks up the document from the registry by ID.
    """
    doc = await get_document_by_id(body.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found in registry.")

    result = await run_intake_for_document(doc)
    return result


@router.post("/evaluate-batch")
def evaluate_batch(background_tasks: BackgroundTasks):
    """
    POST /api/intake/evaluate-batch
    
    Runs the Intake Pipeline for ALL raw circulars with status=PENDING.
    Processes in background. Poll /batch-status for progress.
    """
    if batch_status["status"] == "RUNNING":
        return {
            "status": "ALREADY_RUNNING",
            "message": "A batch intake is currently in progress."
        }

    background_tasks.add_task(_run_batch_intake)
    return {
        "status": "TRIGGERED",
        "message": "Batch intake pipeline started for all PENDING raw circulars."
    }


@router.get("/batch-status")
def get_batch_status():
    """
    GET /api/intake/batch-status
    
    Returns the status, logs, results, and summary of the last batch intake run.
    """
    return batch_status


@router.get("/config")
def get_intake_config():
    """
    GET /api/intake/config
    
    Returns the current intake configuration (thresholds, supported entities, domains).
    """
    return INTAKE_CONFIG
