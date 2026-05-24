import httpx
from app.core.config import settings
from app.vectorstore.chroma_client import get_regulations_collection

async def check_inventory(document_analysis: dict) -> dict:
    """
    Scans vector database for similar regulations and determines if
    the new circular represents a duplicate or an amendment.
    """
    doc_id = document_analysis.get('document_id', 'unknown')
    summary = document_analysis.get('executive_summary', '')
    is_amendment = document_analysis.get('is_amendment', False)
    amends_id = document_analysis.get('amends_document_id')
    
    print(f"[Inventory Agent] Checking ChromaDB collection regulations_db for overlaps on Document ID: {doc_id}...")
    
    similar_docs = []
    try:
        collection = get_regulations_collection()
        # Query regulations database for semantic matches
        results = collection.query(
            query_texts=[summary],
            n_results=3
        )
        if results and results['ids'] and len(results['ids'][0]) > 0:
            for idx, item_id in enumerate(results['ids'][0]):
                distance = results['distances'][0][idx] if results['distances'] else 1.0
                similar_docs.append({
                    "id": item_id,
                    "similarity": round(1.0 - distance, 2)
                })
            print(f"[Inventory Agent] Discovered {len(similar_docs)} similar document records in vector store.")
    except Exception as e:
        print(f"[Inventory Agent Warning] ChromaDB query failed: {e}. Proceeding with clean index assumption.")
        
    # Standard output status
    result_type = "NEW"
    affected_maps = []
    
    if is_amendment and amends_id:
        result_type = "AMENDMENT"
        print(f"[Inventory Agent] Ingestion identified as AMENDMENT to document: {amends_id}. Querying active MAPs from backend...")
        try:
            # Query backend maps list for the amended document to retrieve affected tasks
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{settings.BACKEND_URL}/api/maps", params={"regulator": "RBI"})
                if response.status_code == 200:
                    all_maps = response.json().get('maps', [])
                    # Filter maps related to the amended document
                    affected_maps = [m for m in all_maps if amends_id in str(m.get('mapCode', '')) or amends_id in str(m.get('description', ''))]
                    print(f"[Inventory Agent] Discovered {len(affected_maps)} existing compliance MAPs impacted by this amendment.")
        except Exception as err:
            print(f"[Inventory Agent Error] Failed to connect to backend maps database: {err}.")
            
    # Check if a exact duplicate circular has already been processed
    for doc in similar_docs:
        if doc['similarity'] > 0.98:
            print(f"[Inventory Agent Alert] Document ID {doc['id']} shares 98%+ similarity. Classifying as DUPLICATE.")
            result_type = "DUPLICATE"
            break
            
    return {
        "result": result_type,
        "affected_maps": affected_maps,
        "similar_docs": similar_docs
    }
