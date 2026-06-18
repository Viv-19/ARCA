import os
import httpx
import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.services.scrapers.rbi_scraper import scrape_rbi_circulars
from app.services.pdf_processor import extract_text_from_pdf
from app.core.config import settings
from app.utils.hash_utils import compute_file_hash

router = APIRouter()

# Simple global status tracking
scraper_status = {
    "status": "IDLE",
    "last_run": None,
    "last_results_count": 0,
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

    append_log("[Scraper Task] Running RBI scraper background job...")
    try:
        circulars = await scrape_rbi_circulars(limit=2, log_callback=append_log)
        scraper_status["last_results_count"] = len(circulars)
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            for circ in circulars:
                # 1. Extract text and compute hash
                local_path = circ["local_path"]
                text = ""
                file_hash = ""
                if os.path.exists(local_path):
                    text = extract_text_from_pdf(local_path)
                    file_hash = compute_file_hash(local_path)
                else:
                    append_log(f"[Scraper Task] PDF file not found at {local_path}. Skipping.")
                    continue
                    
                # 2. Build backend document creation payload
                payload = {
                    "title": circ["title"],
                    "regulator": "RBI",
                    "documentId": circ.get("document_id") or ("RBI/2026/" + str(hash(circ["title"]) % 1000).zfill(3)),
                    "documentType": "circular",
                    "publicationDate": circ["date"] + "T00:00:00.000Z",
                    "sourceHash": circ["source_hash"],
                    "contentHash": file_hash,
                    "pdfUrl": circ["url"],
                    "localFilePath": local_path,
                    "extractedText": text,
                    "status": "INGESTED",
                    "ingestionMethod": "AUTO_SCRAPE"
                }
                
                # 3. Write document to database
                append_log(f"[Scraper Task] Posting scraped document \"{circ['title'][:30]}\" to backend...")
                res = await client.post(f"{settings.BACKEND_URL}/api/documents", json=payload)
                
                if res.status_code == 201:
                    doc = res.json()
                    append_log(f"[Scraper Task] Document \"{doc['title'][:30]}\" successfully stored in database. Awaiting manual pipeline trigger.")
                elif res.status_code == 409:
                    append_log(f"[Scraper Task] Document \"{circ['title'][:30]}\" already exists in database (duplicate hash).")
                else:
                    append_log(f"[Scraper Task Warning] Backend returned code {res.status_code}: {res.text}")
                    
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
