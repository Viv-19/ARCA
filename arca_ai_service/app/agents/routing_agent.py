import json
import re
from typing import List
from app.core.config import settings
from app.vectorstore.chroma_client import get_departments_collection

# In-memory department descriptions for fast fallback matching
DEPARTMENT_PROFILES = {
    "IT Security": "cybersecurity MFA encryption firewall SSL TLS API security vulnerability patch incident response access control authentication hardware security keys FIDO2 systems hardening code audit network protection phishing",
    "Digital Banking IT": "mobile banking app NetBanking UPI digital channels online banking mobile app deployment APIs digital infrastructure payment gateway merchant banking integrations mobile wallets",
    "Core Banking IT": "CBS core banking SWIFT interbank transactions settlement NEFT RTGS account ledger transaction records banking systems batch runs interest calculations",
    "Compliance Central": "KYC AML policy compliance reporting regulatory circular master direction governance auditing board reporting corporate compliance guidelines inspection",
    "Legal": "legal approval regulatory notices penalties court filings legal compliance legal representation litigation contract agreements dispute resolution statutory filing guidance",
    "HR and Training": "employee training awareness program HR compliance staff certification attendance hiring onboarding policy training modules e-learning course assessments",
    "Risk Management": "risk assessment capital adequacy Basel credit risk market risk operational risk stress testing fraud prevention asset liability management liquidity monitoring",
    "Retail Banking Ops": "retail banking customer KYC account opening deposits loans interest rates branch deposits locker services savings account debit card credit card",
    "Treasury": "treasury forex investments foreign exchange currency trading money markets government securities corporate debt liquidity positioning",
    "Audit": "audit report internal audit inspection compliance audit evidence forensic audit tracking operational audit regulatory inspections verification checklist",
    "NRI Services": "nri services nri accounts non resident indian outward inward remittance foreign exchange currency accounts non-resident external NRE NRO banking",
    "Operations": "central operations operations branch processes clearing houses cheque books physical verification currency chest branch operations cash dispatch safe deposit boxes locker operational rules"
}

def seed_department_embeddings_if_empty():
    """
    Ensures the departments collection in ChromaDB is pre-populated.
    """
    try:
        collection = get_departments_collection()
        # Only seed if collection has no items
        count = collection.count()
        if count == 0:
            print("[ChromaDB] Collection departments_db is empty. Seeding department embeddings...")
            for dept_name, profile_text in DEPARTMENT_PROFILES.items():
                collection.add(
                    documents=[profile_text],
                    ids=[dept_name],
                    metadatas=[{"department": dept_name}]
                )
            print(f"[ChromaDB] Successfully seeded {len(DEPARTMENT_PROFILES)} department embeddings.")
    except Exception as e:
        print(f"[ChromaDB Seeding Warning] Department seed omitted: {e}")

async def route_map(map_id: str, title: str, description: str, keywords: List[str]) -> dict:
    """
    Smart semantic routing handler that assigns a MAP to a banking department.
    """
    # Seed department embeddings
    seed_department_embeddings_if_empty()
        
    try:
        from langchain_openai import ChatOpenAI
        from pydantic import BaseModel
        
        print(f"[Routing Agent] Invoking ChromaDB departments RAG for MAP: {title[:30]}...")
        collection = get_departments_collection()
        query_text = f"{title} {description} {' '.join(keywords)}"
        
        # RAG Search Top 3 department profiles
        results = collection.query(
            query_texts=[query_text],
            n_results=3
        )
        
        top_match = "Compliance Central"
        confidence = 0.7
        if results and results['ids'] and len(results['ids'][0]) > 0:
            top_match = results['ids'][0][0]
            distance = results['distances'][0][0] if results['distances'] else 0.3
            confidence = round(1.0 - distance, 2)
            
        print(f"[Routing Agent] Top RAG Department Match: {top_match} (confidence: {confidence})")
        
        # Structuring prompt for LLM confirmation
        prompt = f"""
        You are a senior banking workflow dispatcher.
        Confirm the correct department assignment for the following compliance MAP:
        
        MAP Title: {title}
        MAP Description: {description}
        Keywords: {keywords}
        
        Top similarity candidate: {top_match} (RAG confidence: {confidence})
        
        Determine if this assignment is correct, or choose a more appropriate bank department from this exact list:
        IT Security, Digital Banking IT, Core Banking IT, Compliance Central, Legal, HR and Training, Risk Management, Retail Banking Ops, Corporate Banking Ops, Treasury, Audit, NRI Services, Operations.
        
        Output a detailed, plain English justification for your decision.
        
        Return ONLY a valid JSON object matching this schema:
        {{
          "department": "Name of department (matching exact list options)",
          "confidence": 0.0 to 1.0,
          "justification": "Clear, professional, explainable reasoning justification text."
        }}
        """
        
        llm = ChatOpenAI(
            model=settings.MODEL_NAME,
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.0,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        response = await llm.ainvoke(prompt)
        content = response.content.strip()
        json_match = re.search(r'(\{.*\})', content, re.DOTALL)
        if json_match:
            content = json_match.group(1)
        parsed_res = json.loads(content)
        print(f"[Routing Agent Success] LLM assigned: \"{parsed_res['department']}\".")
        return parsed_res
    except Exception as e:
        print(f"[Routing Agent Error] Smart routing failed: {e}. Returning safe fallback assignment.")
        return {
            "department": "Compliance Central",
            "confidence": 0.5,
            "justification": f"Automatic semantic routing encountered an error ({str(e)}). Task routed to Compliance Central for manual reassignment."
        }
