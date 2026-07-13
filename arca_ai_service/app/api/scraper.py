import os
import httpx
import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.services.scrapers.rbi_scraper import scrape_rbi_circulars
from app.services.pdf_processor import extract_text_from_pdf
from app.core.config import settings
from app.utils.hash_utils import compute_file_hash
from app.services.collection_engine.document_registry import (
    synchronize,
    update_raw_document_download_info,
    get_all_raw_circular_numbers
)

router = APIRouter()

# Simple global status tracking
scraper_status = {
    "status": "IDLE",
    "last_run": None,
    "last_results_count": 0,
    "new_documents_count": 0,
    "existing_documents_count": 0,
    "updated_documents_count": 0,
    "errors": [],
    "logs": []
}

async def run_scraper_task():
    global scraper_status
    scraper_status["status"] = "RUNNING"
    scraper_status["errors"] = []
    scraper_status["logs"] = []
    
    def append_log(msg: str):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        scraper_status["logs"].append(f"[{timestamp}] {msg}")

    # Fetch high-water mark memory
    append_log("[Scraper Task] Fetching known circular numbers from database...")
    known_list = await get_all_raw_circular_numbers()
    known_circulars = set(known_list)
    append_log(f"[Scraper Task] High-Water Mark loaded with {len(known_circulars)} existing circulars.")

    append_log("[Scraper Task] Starting RBI Circulars Index Scraper (First Page)")
    try:
        circulars = await scrape_rbi_circulars(limit=50, known_circulars=known_circulars, log_callback=append_log)
        scraper_status["last_results_count"] = len(circulars)
        
        # Convert to registry format
        crawled_metadata = []
        for circ in circulars:
            crawled_metadata.append({
                "circular_number": circ["circular_number"],
                "title": circ["title"],
                "publication_date": circ["date"],
                "department": circ["department"],
                "meant_for": circ["meant_for"],
                "detail_url": circ["url"]
            })
            
        sync_result = await synchronize(crawled_metadata, log_callback=append_log)
        
        scraper_status["new_documents_count"] = len(sync_result.new_documents)
        scraper_status["existing_documents_count"] = len(sync_result.existing_documents)
        scraper_status["updated_documents_count"] = len(sync_result.updated_documents)
        
        # Match back to circulars to update PDF info
        for entry in sync_result.new_documents + sync_result.updated_documents:
            circ = next((c for c in circulars if c["circular_number"] == entry["circular_number"]), None)
            if circ and circ["local_path"] and os.path.exists(circ["local_path"]):
                local_path = circ["local_path"]
                file_hash = compute_file_hash(local_path)
                file_size = os.path.getsize(local_path)
                mime_type = "application/pdf" if circ["has_pdf"] else "text/plain"
                
                await update_raw_document_download_info(
                    doc_id=entry["id"],
                    pdf_path=local_path,
                    pdf_hash=file_hash,
                    file_size=file_size,
                    mime_type=mime_type,
                    status="PENDING"
                )
                append_log(f"[Scraper Task] PDF metadata updated for \"{circ['title'][:30]}\".")
        
        # Trigger Intake Pipeline for relevance filtering (lazy import to avoid circular dependency)
        append_log("[Scraper Task] Triggering Intelligent Intake Pipeline to evaluate pending raw circulars...")
        from app.api.intake import _run_batch_intake
        await _run_batch_intake()
        
        scraper_status["status"] = "COMPLETED"
        scraper_status["last_run"] = datetime.datetime.now().isoformat()
        append_log("[Scraper Task] Crawling finished successfully.")
    except Exception as e:
        append_log(f"[Scraper Task Error] Background job failed: {e}")
        scraper_status["status"] = "FAILED"
        scraper_status["errors"].append(str(e))

@router.post("/trigger")
def trigger_scraper(background_tasks: BackgroundTasks):
    if scraper_status["status"] == "RUNNING":
        return {"status": "ALREADY_RUNNING", "message": "The scraper job is currently executing."}
        
    background_tasks.add_task(run_scraper_task)
    return {"status": "TRIGGERED", "message": "Scraper background task launched successfully."}

@router.get("/status")
def get_scraper_status():
    return scraper_status
