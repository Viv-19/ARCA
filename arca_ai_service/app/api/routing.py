from fastapi import APIRouter, HTTPException
import httpx
from app.core.config import settings
from app.agents.routing_agent import route_map

router = APIRouter()

@router.post("/route-map/{map_id}")
async def route_map_endpoint(map_id: str):
    try:
        print(f"[Routing API] Received routing request for MAP ID: {map_id}")
        
        # 1. Fetch MAP from Express backend
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{settings.BACKEND_URL}/api/maps/{map_id}")
            if res.status_code != 200:
                raise ValueError(f"Backend returned status code {res.status_code}")
            map_obj = res.json()
            
        # 2. Invoke Routing Agent
        title = map_obj.get("title", "")
        description = map_obj.get("description", "")
        keywords = map_obj.get("regulatoryKeywords", [])
        
        routing_result = await route_map(title, description, keywords)
        
        return routing_result
    except Exception as e:
        print(f"[Routing API Error] Routing failed: {e}")
        # Return fallback values for system stability
        return {
            "department": "Compliance Central",
            "confidence": 0.5,
            "justification": f"Fallback router activated due to AI service exception: {str(e)}"
        }
