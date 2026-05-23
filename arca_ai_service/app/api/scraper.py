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
    "errors": []
}

async def run_scraper_task():
    global scraper_status
    scraper_status["status"] = "RUNNING"
    scraper_status["errors"] = []
    
    try:
        print("[Scraper Task] Running RBI scraper background job...")
        circulars = await scrape_rbi_circulars(limit=2)
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
                print(f"[Scraper Task] Posting scraped document \"{circ['title'][:30]}\" to backend...")
                res = await client.post(f"{settings.BACKEND_URL}/api/documents", json=payload)
                
                if res.status_code == 201:
                    doc = res.json()
                    # Trigger pipeline run automatically for this document!
                    print(f"[Scraper Task] Triggering pipeline run for document ID: {doc['id']}...")
                    pipeline_res = await client.post(f"{settings.BACKEND_URL}/api/pipeline/run", json={
                        "document_id": doc["id"],
                        "extracted_text": doc["extractedText"],
                        "publication_date": doc["publicationDate"]
                    })
                    print(f"[Scraper Task] Pipeline response: {pipeline_res.status_code}")
                elif res.status_code == 409:
                    print(f"[Scraper Task] Document \"{circ['title'][:30]}\" is already ingested (duplicate hash). Skipping.")
                else:
                    print(f"[Scraper Task Warning] Backend returned code {res.status_code}: {res.text}")
                    
        scraper_status["status"] = "COMPLETED"
        scraper_status["last_run"] = datetime.datetime.now().isoformat()
    except Exception as e:
        print(f"[Scraper Task Error] Background job failed: {e}")
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
