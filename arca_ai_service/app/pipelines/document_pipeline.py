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
    routing_results: Optional[List[dict]]
    risk_assessment: Optional[dict]
    scripts_generated: Optional[int]
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
        result = await generate_maps(analysis, pub_date, state.get("extracted_text", ""))
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
                    "modelUsed": f"{settings.MODEL_NAME} (ARCA multi-agent)",
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

# Node 5: Route All Generated MAPs to Banking Departments
async def node_route_all_maps(state: PipelineState) -> dict:
    from app.agents.routing_agent import route_map
    maps = state.get("generated_maps", [])
    errors = state.get("errors", [])
    routing_results = []
    
    print(f"[Pipeline] Node [route_maps]: Running AI department routing for {len(maps)} MAPs...")
    for map_obj in maps:
        try:
            result = await route_map(
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
            print(f"[Pipeline] Routed '{map_obj.get('title', '')[:30]}...' -> {result.get('department')} ({result.get('confidence', 0):.0%})")
        except Exception as e:
            err_msg = f"Routing failed for MAP '{map_obj.get('title', '')[:30]}': {e}"
            print(f"[Pipeline Error] {err_msg}")
            errors.append(err_msg)
    
    return {
        "routing_results": routing_results,
        "errors": errors
    }

# Node 6: Assess System-Wide Risk and Detect Conflicts
async def node_assess_risk(state: PipelineState) -> dict:
    from app.agents.risk_agent import evaluate_system_risk
    errors = state.get("errors", [])
    
    print(f"[Pipeline] Node [assess_risk]: Running cross-MAP conflict analysis and systemic risk scoring...")
    try:
        risk_data = await evaluate_system_risk()
        print(f"[Pipeline] Risk Assessment Complete — Score: {risk_data.get('system_risk_score')}, Level: {risk_data.get('risk_level')}, Conflicts: {len(risk_data.get('conflicts', []))}")
        return {
            "risk_assessment": risk_data,
            "errors": errors
        }
    except Exception as e:
        err_msg = f"Risk assessment failed: {e}"
        print(f"[Pipeline Error] {err_msg}")
        return {
            "risk_assessment": None,
            "errors": errors + [err_msg]
        }

# Node 7: Generate Validation Scripts for Technical MAPs
async def node_generate_scripts(state: PipelineState) -> dict:
    from app.agents.script_generator import generate_validation_script
    maps = state.get("generated_maps", [])
    errors = state.get("errors", [])
    scripts_generated = 0
    
    print(f"[Pipeline] Node [generate_scripts]: Creating validation scripts for TECHNICAL MAPs...")
    for map_obj in maps:
        if map_obj.get("classification") == "TECHNICAL":
            try:
                script = await generate_validation_script(
                    map_obj.get("title", "")[:20],
                    map_obj.get("title", ""),
                    map_obj.get("description", ""),
                    map_obj.get("deliverable", "")
                )
                scripts_generated += 1
                print(f"[Pipeline] Generated validation script for: '{map_obj.get('title', '')[:30]}...' ({len(script)} chars)")
            except Exception as e:
                err_msg = f"Script generation failed for '{map_obj.get('title', '')[:30]}': {e}"
                print(f"[Pipeline Error] {err_msg}")
                errors.append(err_msg)
    
    print(f"[Pipeline] Script generation complete. {scripts_generated} script(s) generated.")
    return {
        "scripts_generated": scripts_generated,
        "errors": errors
    }

def build_pipeline():
    """
    Assembles, compiles, and registers the full 7-agent stateful graph.
    Pipeline: analyze → inventory → generate_maps → save_maps → route → risk → scripts → END
    """
    print("[LangGraph Engine] Initializing stateful 7-agent LangGraph workflow pipeline...")
    builder = StateGraph(PipelineState)
    
    # Register ALL 7 Agent Nodes
    builder.add_node("analyze", node_analyze_document)
    builder.add_node("check_inventory", node_check_inventory)
    builder.add_node("generate_maps", node_generate_maps)
    builder.add_node("save_maps", node_save_maps_to_backend)
    builder.add_node("route_maps", node_route_all_maps)
    builder.add_node("assess_risk", node_assess_risk)
    builder.add_node("generate_scripts", node_generate_scripts)
    
    # Configure Directed Graph Edges (Full 7-Agent Flow)
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
    builder.add_edge("save_maps", "route_maps")
    builder.add_edge("route_maps", "assess_risk")
    builder.add_edge("assess_risk", "generate_scripts")
    builder.add_edge("generate_scripts", END)
    
    print("[LangGraph Engine] Full 7-agent stateful graph compiled successfully.")
    return builder.compile()
