from fastapi import APIRouter, HTTPException
import httpx
from app.core.config import settings
from app.agents.validation_agent import validate_evidence
from app.agents.script_generator import generate_validation_script

router = APIRouter()

@router.post("/validate/{map_id}")
async def validate_evidence_endpoint(map_id: str):
    try:
        print(f"[Validation API] Received validation trigger for MAP ID: {map_id}")
        result = await validate_evidence(map_id)
        return result
    except Exception as e:
        print(f"[Validation API Error] Evidence validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/script/{map_id}")
async def get_validation_script_endpoint(map_id: str):
    try:
        print(f"[Validation API] Generating validation script for MAP ID: {map_id}")
        
        # 1. Fetch MAP from Express backend
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{settings.BACKEND_URL}/api/maps/{map_id}")
            if res.status_code != 200:
                raise ValueError(f"Backend returned status code {res.status_code}")
            map_obj = res.json()
            
        # 2. Generate validation script
        script_code = await generate_validation_script(
            map_id,
            map_obj.get("title", ""),
            map_obj.get("description", ""),
            map_obj.get("deliverable", "")
        )
        
        return {
            "mapId": map_id,
            "script": script_code
        }
    except Exception as e:
        print(f"[Validation API Error] Failed to generate script: {e}")
        raise HTTPException(status_code=500, detail=str(e))
