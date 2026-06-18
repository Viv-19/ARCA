from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.pipelines.document_pipeline import build_pipeline

# Agent Imports
from app.agents.document_agent import run_document_agent
from app.agents.inventory_agent import check_inventory
from app.agents.map_generation_agent import generate_maps
from app.agents.routing_agent import route_map
from app.agents.risk_agent import evaluate_system_risk
from app.agents.script_generator import generate_validation_script

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

# Schema for Stage 1
class Stage1Request(BaseModel):
    extracted_text: str
    publication_date: Optional[str] = None

@router.post("/stage1")
async def pipeline_stage1(payload: Stage1Request):
    try:
        print(f"[Pipeline API] Stage 1 request received.")
        
        # 1. Analyze Document
        print("[Pipeline Stage 1] Running LLM Parsing (Document Agent)...")
        analysis = await run_document_agent(payload.extracted_text, payload.publication_date)
        
        # 2. Check Inventory
        print("[Pipeline Stage 1] Checking Inventory overlap...")
        inv_data = await check_inventory(analysis)
        inventory_result = inv_data.get("result", "NEW")
        
        # 3. Generate MAPs
        print("[Pipeline Stage 1] Generating Action Points (MAPs)...")
        maps_data = await generate_maps(analysis, payload.publication_date, payload.extracted_text)
        generated_maps = maps_data.get("maps", [])
        
        return {
            "analysis": analysis,
            "inventory_result": inventory_result,
            "generated_maps": generated_maps
        }
    except Exception as e:
        print(f"[Pipeline API Error] Stage 1 execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Schema for Stage 2
class Stage2Request(BaseModel):
    maps: List[dict]

@router.post("/stage2")
async def pipeline_stage2(payload: Stage2Request):
    try:
        print(f"[Pipeline API] Stage 2 request received (Routing {len(payload.maps)} MAPs).")
        routing_results = []
        for map_obj in payload.maps:
            result = await route_map(
                map_obj.get("title", "")[:20],
                map_obj.get("title", ""),
                map_obj.get("description", ""),
                map_obj.get("regulatory_keywords", [])
            )
            routing_results.append({
                "map_title": map_obj.get("title"),
                "department": result.get("department"),
                "confidence": result.get("confidence"),
                "justification": result.get("justification")
            })
        return {
            "routing_results": routing_results
        }
    except Exception as e:
        print(f"[Pipeline API Error] Stage 2 execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Schema for Stage 3
class Stage3Request(BaseModel):
    maps: List[dict]

@router.post("/stage3")
async def pipeline_stage3(payload: Stage3Request):
    try:
        print(f"[Pipeline API] Stage 3 request received (Risk/Script validation for {len(payload.maps)} MAPs).")
        
        # 1. Risk Assessment
        print("[Pipeline Stage 3] Evaluating systemic risk and conflicts...")
        risk_assessment = await evaluate_system_risk()
        
        # 2. Validation Scripts Generation
        print("[Pipeline Stage 3] Generating validation scripts...")
        scripts = []
        for map_obj in payload.maps:
            if map_obj.get("classification") == "TECHNICAL":
                script_content = await generate_validation_script(
                    map_obj.get("title", "")[:20],
                    map_obj.get("title", ""),
                    map_obj.get("description", ""),
                    map_obj.get("deliverable", "")
                )
                scripts.append({
                    "map_title": map_obj.get("title"),
                    "script": script_content
                })
        
        return {
            "risk_assessment": risk_assessment,
            "scripts": scripts
        }
    except Exception as e:
        print(f"[Pipeline API Error] Stage 3 execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
