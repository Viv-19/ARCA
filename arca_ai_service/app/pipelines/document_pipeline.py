import datetime
import httpx
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from app.core.config import settings
from app.agents.document_agent import run_document_agent
from app.agents.inventory_agent import check_inventory
from app.agents.map_generation_agent import generate_maps

class PipelineState(TypedDict):
    document_id: str
    extracted_text: str
    publication_date: str
    analysis: Optional[dict]
    inventory_result: Optional[str]   # NEW, AMENDMENT, DUPLICATE
    generated_maps: Optional[List[dict]]
    errors: List[str]

# Node 1: Analyze Document
async def node_analyze_document(state: PipelineState) -> dict:
    doc_id = state.get("document_id")
    text = state.get("extracted_text", "")
    pub_date = state.get("publication_date")
    
    print(f"[Pipeline] Node [analyze]: Starting LLM parsing for document ID: {doc_id}...")
    try:
        analysis = await run_document_agent(text, pub_date)
        return {
            "analysis": analysis,
            "errors": state.get("errors", [])
        }
    except Exception as e:
        err_msg = f"Document Agent analysis failed: {e}"
        print(f"[Pipeline Error] {err_msg}")
        return {
            "errors": state.get("errors", []) + [err_msg]
        }

# Node 2: Check Inventory
async def node_check_inventory(state: PipelineState) -> dict:
    analysis = state.get("analysis")
    print(f"[Pipeline] Node [check_inventory]: Scanning for overlapping previous directions...")
    try:
        inv_data = await check_inventory(analysis)
        result = inv_data.get("result", "NEW")
        print(f"[Pipeline] Node [check_inventory]: Result -> {result}")
        return {
            "inventory_result": result,
            "errors": state.get("errors", [])
        }
    except Exception as e:
        err_msg = f"Inventory check node failed: {e}"
        print(f"[Pipeline Error] {err_msg}")
        return {
            "inventory_result": "NEW", # Default to new on error
            "errors": state.get("errors", []) + [err_msg]
        }

# Node 3: Generate MAPs
async def node_generate_maps(state: PipelineState) -> dict:
    analysis = state.get("analysis")
    pub_date = state.get("publication_date")
    print(f"[Pipeline] Node [generate_maps]: Executing CoT mapping on actionable provisions...")
    try:
        result = await generate_maps(analysis, pub_date)
        return {
            "generated_maps": result.get("maps", []),
            "errors": state.get("errors", [])
        }
    except Exception as e:
        err_msg = f"MAP generation node failed: {e}"
        print(f"[Pipeline Error] {err_msg}")
        return {
            "generated_maps": [],
            "errors": state.get("errors", []) + [err_msg]
        }

# Node 4: Save MAPs to Express Backend PostgreSQL
async def node_save_maps_to_backend(state: PipelineState) -> dict:
    doc_id = state.get("document_id")
    analysis = state.get("analysis")
    maps = state.get("generated_maps", [])
    errors = state.get("errors", [])
    
    print(f"[Pipeline] Node [save_maps]: Writing {len(maps)} calculated MAPs and Document metrics to Express PostgreSQL backend...")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Update Document record status, parsed metadata inside backend database
            doc_update_payload = {
                "documentId": analysis.get("document_id"),
                "publicationDate": analysis.get("publication_date") or datetime.date.today().isoformat(),
                "extractedText": state.get("extracted_text"),
                "status": "PROCESSED"
            }
            
            print(f"[Pipeline] Updating document status in backend: {settings.BACKEND_URL}/api/documents/{doc_id}/status...")
            await client.put(f"{settings.BACKEND_URL}/api/documents/{doc_id}/status", json={"status": "PROCESSED"})
            
            # 2. Iterate and write each individual MAP record
            for map_obj in maps:
                # Format department to departmentId lookup if pre-routed
                # Create a high-quality DB write payload matching backend database schema
                db_map_payload = {
                    "documentId": doc_id,
                    "sectionReference": map_obj.get("section_reference"),
                    "rawTextExcerpt": map_obj.get("reasoning_chain"),
                    "title": map_obj.get("title"),
                    "description": map_obj.get("description"),
                    "obligationType": map_obj.get("obligation_type"),
                    "classification": map_obj.get("classification"),
                    "regulatoryKeywords": map_obj.get("regulatory_keywords", []),
                    "deliverable": map_obj.get("deliverable"),
                    "deadline": map_obj.get("deadline") + "T00:00:00.000Z" if map_obj.get("deadline") else None,
                    "priority": map_obj.get("priority", "MEDIUM"),
                    "riskLevel": map_obj.get("risk_level", "MEDIUM"),
                    "riskDescription": map_obj.get("risk_description"),
                    "evidenceRequired": map_obj.get("evidence_required", []),
                    "autoValidationResult": None,
                    "autoValidationReason": None,
                    "confidenceScore": map_obj.get("confidence_score", 0.9),
                    "flaggedForReview": map_obj.get("flagged_for_review", False),
                    "flagReason": map_obj.get("flag_reason"),
                    "reasoningChain": map_obj.get("reasoning_chain"),
                    "modelUsed": "gpt-4o (ARCA multi-agent)",
                    "status": "PENDING_REVIEW"
                }
                
                print(f"[Pipeline] Posting MAP \"{map_obj.get('title')[:30]}...\" to database...")
                await client.post(f"{settings.BACKEND_URL}/api/maps", json=db_map_payload)
                
            print(f"[Pipeline] Successfully synced document ID {doc_id} to PostgreSQL compliance database.")
    except Exception as e:
        err_msg = f"Failed to sync outputs to Express backend: {e}"
        print(f"[Pipeline Sync Error] {err_msg}")
        errors.append(err_msg)
        
    return {
        "errors": errors
    }

# Stateful transitions conditional routing
def conditional_route_after_inventory(state: PipelineState) -> str:
    res = state.get("inventory_result", "NEW")
    if res == "DUPLICATE":
        print("[Pipeline Routing] Duplicate document detected. Direct transition to END.")
        return "DUPLICATE"
    print(f"[Pipeline Routing] Class: {res}. Transitioning to map generator nodes...")
    return "PROCEED"

def build_pipeline():
    """
    Assembles, compiles, and registers the multi-agent stateful graph.
    """
    print("[LangGraph Engine] Initializing stateful multi-agent LangGraph workflow pipeline...")
    builder = StateGraph(PipelineState)
    
    # Register Nodes
    builder.add_node("analyze", node_analyze_document)
    builder.add_node("check_inventory", node_check_inventory)
    builder.add_node("generate_maps", node_generate_maps)
    builder.add_node("save_maps", node_save_maps_to_backend)
    
    # Configure Directed Graph Edges
    builder.set_entry_point("analyze")
    builder.add_edge("analyze", "check_inventory")
    
    builder.add_conditional_edges(
        "check_inventory",
        conditional_route_after_inventory,
        {
            "DUPLICATE": END,
            "PROCEED": "generate_maps"
        }
    )
    
    builder.add_edge("generate_maps", "save_maps")
    builder.add_edge("save_maps", END)
    
    print("[LangGraph Engine] Stateful multi-agent graph compiled successfully.")
    return builder.compile()
