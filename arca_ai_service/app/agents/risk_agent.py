import json
import httpx
from typing import List, Optional
from app.core.config import settings

def run_mock_risk_agent(maps_list: list) -> dict:
    """
    Simulates cross-MAP conflict audits and systemic compliance risks.
    Detects realistic overlaps in regulatory targets (like KYC biometric vs privacy consent, MFA gateway deployment vs speed).
    """
    print("[Risk Agent] Sandbox Mode: Evaluating compliance dependency and conflict map...")
    
    conflicts = []
    
    # 1. Look for Aadhaar biometric vs Legal DPDP consent overlap
    has_bio = any("biometric" in str(m.get("title", "")).lower() or "aadhaar" in str(m.get("title", "")).lower() for m in maps_list)
    has_consent = any("consent" in str(m.get("title", "")).lower() or "dpdp" in str(m.get("title", "")).lower() for m in maps_list)
    
    if has_bio and has_consent:
        conflicts.append({
            "conflict_id": "CONF-2026-001",
            "title": "Biometric Authentication vs DPDP Consent Timing Conflict",
            "description": "IT Security plans to deploy the Aadhaar SDK authentication modules on the net banking gate immediately, while Legal has a policy-review task pending to draft DPDP privacy consent updates. Launching biometrics without consent is a regulatory violation.",
            "severity": "HIGH",
            "impact_departments": ["IT Security", "Legal", "Compliance Central"],
            "mitigation_plan": "Establish a sequential dependency gate: prevent the biometric authentication SDK from being enabled in production until the DPDP Privacy Consent forms are officially approved and uploaded."
        })
        
    # 2. Check for general payment channels MFA bottlenecks
    has_mfa = any("mfa" in str(m.get("title", "")).lower() or "fido2" in str(m.get("title", "")).lower() for m in maps_list)
    if has_mfa:
        conflicts.append({
            "conflict_id": "CONF-2026-002",
            "title": "MFA Gateway Hardware Delivery Dependency",
            "description": "UPI payment channel MFA rollout is scheduled for compliance. However, there is a physical hardware tokens deployment dependency in Digital Banking IT. Shortages could delay implementation.",
            "severity": "MEDIUM",
            "impact_departments": ["Digital Banking IT", "Operations"],
            "mitigation_plan": "Establish a temporary software-authenticator fallback protocol to allow system launch prior to hardware tokens dispatch completion."
        })
        
    # If no specific matches, generate a standard systemic report
    if not conflicts:
        conflicts.append({
            "conflict_id": "CONF-2026-003",
            "title": "Cross-Department Alignment Check Required",
            "description": "No active high-priority structural conflicts detected in the current MAP inventory. Continue monitoring standard compliance channels.",
            "severity": "LOW",
            "impact_departments": ["Compliance Central"],
            "mitigation_plan": "Routine quarterly audits."
        })
        
    # Calculate overall risk score
    max_severity = "LOW"
    for c in conflicts:
        if c["severity"] == "HIGH":
            max_severity = "HIGH"
        elif c["severity"] == "MEDIUM" and max_severity != "HIGH":
            max_severity = "MEDIUM"
            
    risk_score = 15.0
    if max_severity == "HIGH":
        risk_score = 78.0
    elif max_severity == "MEDIUM":
        risk_score = 45.0
        
    return {
        "system_risk_score": risk_score,
        "risk_level": max_severity,
        "conflicts": conflicts
    }

async def evaluate_system_risk() -> dict:
    """
    Evaluates global compliance safety and maps risk overlaps across active departments.
    """
    print("[Risk Agent] Retrieving active MAP list from Express backend...")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{settings.BACKEND_URL}/api/maps")
            if res.status_code != 200:
                raise ValueError(f"Backend returned status {res.status_code}")
            maps_data = res.json()
            maps_list = maps_data.get("maps", [])
    except Exception as e:
        print(f"[Risk Agent Error] Failed to retrieve maps from backend: {e}. Defaulting to sandbox mapping...")
        # Populate dummy list for offline sandbox compatibility
        maps_list = [
            {"title": "Aadhaar Biometric SDK Integration on Digital Banking Portals", "classification": "TECHNICAL"},
            {"title": "Biometric Authentication Form & Customer Consent Policy Update", "classification": "NON_TECHNICAL"},
            {"title": "Hardware Token / FIDO2 Authentication Setup for Digital NetBanking Portal", "classification": "TECHNICAL"}
        ]
        
    is_dummy_key = settings.OPENAI_API_KEY == "your_openai_api_key_here" or not settings.OPENAI_API_KEY
    if is_dummy_key:
        return run_mock_risk_agent(maps_list)
        
    try:
        from langchain_openai import ChatOpenAI
        
        # We call GPT-4o to find overlaps
        llm = ChatOpenAI(
            model=settings.MODEL_NAME,
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.1,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        maps_context = []
        for idx, m in enumerate(maps_list):
            maps_context.append(f"MAP {idx+1}: {m.get('title')}\nDescription: {m.get('description')}\nDepartment: {m.get('department', {}).get('name') if m.get('department') else 'None'}\n")
            
        maps_text = "\n".join(maps_context)
        
        prompt = f"""
        You are a chief risk compliance officer at a large bank.
        Review the following active compliance actions (MAPs) currently scheduled for execution:
        
        {maps_text}
        
        Analyze if there are any conflicts, overlapping deadlines, resource constraints, or sequence dependencies between these compliance actions.
        For example:
        - IT executing biometric tracking features BEFORE legal establishes policy forms (Privacy Compliance Conflict).
        - Multiple high-priority security gateway migrations happening on overlapping dates (System Stability Risk).
        
        Output a risk score (0.0 to 100.0), a global risk level (HIGH, MEDIUM, LOW), and a detailed conflicts list.
        
        Return ONLY valid JSON matching this schema:
        {{
          "system_risk_score": 75.5,
          "risk_level": "HIGH or MEDIUM or LOW",
          "conflicts": [
            {{
              "conflict_id": "CONF-YYYY-NNN",
              "title": "Short title of conflict",
              "description": "Detailed explanation of overlapping compliance instructions",
              "severity": "HIGH or MEDIUM or LOW",
              "impact_departments": ["IT Security", "Legal"],
              "mitigation_plan": "Actionable proposal to mitigate or sequence the execution."
            }}
          ]
        }}
        """
        
        response = await llm.ainvoke(prompt)
        import re
        parsed_res = json.loads(re.sub(r'```json|```', '', response.content).strip())
        return parsed_res
        
    except Exception as e:
        print(f"[Risk Agent Error] LLM analysis failed: {e}. Activating sandbox fallback risk mapper...")
        return run_mock_risk_agent(maps_list)
