from fastapi import APIRouter, HTTPException
from app.agents.risk_agent import evaluate_system_risk

router = APIRouter()

@router.get("/scores")
async def get_risk_scores():
    try:
        print("[Risk API] Running system risk scores evaluation...")
        result = await evaluate_system_risk()
        return {
            "system_risk_score": result.get("system_risk_score", 15.0),
            "risk_level": result.get("risk_level", "LOW")
        }
    except Exception as e:
        print(f"[Risk API Error] Failed to evaluate risk scores: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clusters")
async def get_risk_clusters():
    try:
        print("[Risk API] Running system risk conflict clusters evaluation...")
        result = await evaluate_system_risk()
        return result.get("conflicts", [])
    except Exception as e:
        print(f"[Risk API Error] Failed to evaluate risk clusters: {e}")
        raise HTTPException(status_code=500, detail=str(e))
