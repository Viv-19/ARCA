"""
API Router for the ARCA Collection Engine.

Exposes endpoints to trigger metadata collection and check status.
This is a thin HTTP layer over the collection_engine module.
"""

import datetime
from fastapi import APIRouter, BackgroundTasks

from app.services.collection_engine.rbi_collector import collect_rbi_metadata

router = APIRouter()

# ─────────────────────────────────────────────
# Global status tracker
# ─────────────────────────────────────────────

collector_status = {
    "status": "IDLE",           # IDLE | RUNNING | COMPLETED | FAILED
    "last_run": None,
    "circulars_found": 0,
    "errors": [],
    "logs": [],
    "results": [],              # Last collected metadata
}


# ─────────────────────────────────────────────
# Background Task
# ─────────────────────────────────────────────

async def _run_collection_task():
    """Runs the collection engine as a background task."""
    global collector_status

    collector_status["status"] = "RUNNING"
    collector_status["errors"] = []
    collector_status["logs"] = []
    collector_status["results"] = []

    def append_log(msg: str):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        collector_status["logs"].append(f"[{timestamp}] {msg}")

    try:
        results = await collect_rbi_metadata(log_callback=append_log)
        collector_status["results"] = results
        collector_status["circulars_found"] = len(results)
        collector_status["status"] = "COMPLETED"
        collector_status["last_run"] = datetime.datetime.now().isoformat()
        append_log(f"[Collector API] Finished. {len(results)} metadata records collected.")

    except Exception as e:
        append_log(f"[Collector API] FAILED: {e}")
        collector_status["status"] = "FAILED"
        collector_status["errors"].append(str(e))


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.post("/collect")
def trigger_collection(background_tasks: BackgroundTasks):
    """
    POST /api/collector/collect
    
    Triggers the RBI metadata collection engine as a background task.
    Returns immediately with a status indicator.
    """
    if collector_status["status"] == "RUNNING":
        return {
            "status": "ALREADY_RUNNING",
            "message": "The collection engine is currently executing."
        }

    background_tasks.add_task(_run_collection_task)
    return {
        "status": "TRIGGERED",
        "message": "RBI metadata collection started."
    }


@router.get("/status")
def get_collector_status():
    """
    GET /api/collector/status
    
    Returns the current status, logs, and most recent results
    of the collection engine.
    """
    return collector_status


@router.get("/results")
def get_collector_results():
    """
    GET /api/collector/results
    
    Returns only the last collected metadata list.
    Useful for downstream pipeline stages that just need the data.
    """
    return {
        "count": len(collector_status["results"]),
        "circulars": collector_status["results"],
    }
