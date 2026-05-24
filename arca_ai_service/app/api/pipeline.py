from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.pipelines.document_pipeline import build_pipeline

router = APIRouter()

class PipelineRunRequest(BaseModel):
    document_id: str
    extracted_text: str
    publication_date: Optional[str] = None

@router.post("/run")
async def run_pipeline(payload: PipelineRunRequest):
    try:
        print(f"[Pipeline API] Received pipeline run request for document ID: {payload.document_id}")
        
        # Build and compile pipeline
        pipeline = build_pipeline()
        
        # Initialize state
        initial_state = {
            "document_id": payload.document_id,
            "extracted_text": payload.extracted_text,
            "publication_date": payload.publication_date or "",
            "analysis": None,
            "inventory_result": None,
            "generated_maps": None,
            "routing_results": None,
            "risk_assessment": None,
            "scripts_generated": None,
            "errors": []
        }
        
        # Execute async LangGraph execution loop
        result_state = await pipeline.ainvoke(initial_state)
        
        # Check for errors
        if result_state.get("errors"):
            print(f"[Pipeline API Warning] Execution completed with errors: {result_state['errors']}")
            
        return {
            "success": len(result_state.get("errors", [])) == 0,
            "document_id": payload.document_id,
            "inventory_result": result_state.get("inventory_result"),
            "maps_count": len(result_state.get("generated_maps") or []),
            "routing_results": result_state.get("routing_results"),
            "risk_assessment": result_state.get("risk_assessment"),
            "scripts_generated": result_state.get("scripts_generated"),
            "errors": result_state.get("errors", [])
        }
    except Exception as e:
        print(f"[Pipeline API Error] Pipeline execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
