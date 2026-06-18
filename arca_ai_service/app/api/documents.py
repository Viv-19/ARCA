import os
import shutil
import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.pdf_processor import extract_text_from_pdf
from app.utils.hash_utils import compute_file_hash, compute_source_hash
from app.agents.document_agent import run_document_agent

router = APIRouter()

RAW_DIR = "./data/raw"
os.makedirs(RAW_DIR, exist_ok=True)

@router.post("/process")
async def process_document(
    file: UploadFile = File(...),
    regulator: str = Form("RBI"),
    document_type: str = Form("circular")
):
    try:
        # 1. Save uploaded file to raw directory
        file_path = os.path.join(RAW_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"[Documents API] Uploaded file saved at: {file_path}")
        
        # 2. Extract text from PDF
        extracted_text = extract_text_from_pdf(file_path)
        
        # 3. Analyze document using Document Agent to get structured metadata
        analysis = await run_document_agent(extracted_text)
        
        # 4. Generate stable content and source hashes
        content_hash = compute_file_hash(file_path)
        
        today_str = datetime.date.today().isoformat()
        doc_title = analysis.get("document_title") or file.filename.replace(".pdf", "")
        pub_date = analysis.get("publication_date") or today_str
        
        source_hash = compute_source_hash(regulator, doc_title, pub_date)
        
        # 5. Return high-quality structured response
        return {
            "title": doc_title,
            "documentId": analysis.get("document_id"),
            "publicationDate": pub_date,
            "sourceHash": source_hash,
            "contentHash": content_hash,
            "pdfUrl": f"/uploads/documents/{file.filename}",
            "extractedText": extracted_text
        }
    except Exception as e:
        print(f"[Documents API Error] Failed to process uploaded document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from typing import Optional

@router.delete("/{document_id}")
async def delete_document_memory(document_id: str, filename: Optional[str] = None):
    try:
        print(f"[Documents API] Deleting document memory for ID: {document_id}")
        # 1. Delete ChromaDB embeddings
        from app.vectorstore.chroma_client import get_regulations_collection
        try:
            collection = get_regulations_collection()
            collection.delete(ids=[document_id])
            print(f"[Documents API] Deleted embeddings from regulations_db for ID: {document_id}")
        except Exception as ve:
            print(f"[Documents API Warning] Failed to delete embeddings from regulations_db: {ve}")
            
        # 2. Delete raw PDF from raw directory if filename is provided
        if filename:
            # Clean path traversal attempts
            safe_filename = os.path.basename(filename)
            raw_path = os.path.join(RAW_DIR, safe_filename)
            if os.path.exists(raw_path):
                os.remove(raw_path)
                print(f"[Documents API] Deleted raw file from: {raw_path}")
                
        return {"success": True, "message": "Document memory cleared successfully"}
    except Exception as e:
        print(f"[Documents API Error] Failed to delete document memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))
