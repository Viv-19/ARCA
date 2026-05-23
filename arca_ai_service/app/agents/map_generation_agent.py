import datetime
import json
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from app.core.config import settings
from app.prompts.map_generation import MAP_GENERATION_PROMPT

class MAPObject(BaseModel):
    title: str
    description: str
    obligation_type: str        # MANDATORY or CONDITIONAL
    classification: str         # TECHNICAL or NON_TECHNICAL
    deliverable: str
    deadline: str               # YYYY-MM-DD
    priority: str               # CRITICAL, HIGH, MEDIUM, LOW
    risk_level: str
    risk_description: str
    section_reference: str
    evidence_required: List[str]
    regulatory_keywords: List[str]
    confidence_score: float     # 0.0 to 1.0
    flagged_for_review: bool
    flag_reason: Optional[str]
    reasoning_chain: str        # The step-by-step thinking

class MAPGenerationResult(BaseModel):
    maps: List[MAPObject]
    skipped_provisions: List[str]

def run_mock_map_generation(document_analysis: dict) -> dict:
    """
    Resilient sandbox generator that yields high-quality, pre-defined MAP objects
    tailored specifically to Canara Bank SuRaksha problem domain scenarios.
    """
    print("[MAP Generator Agent] Sandbox Mode: Translating provisions to Measurable Action Points (MAPs)...")
    title = document_analysis.get('document_title', '')
    
    if "kyc" in title.lower() or "know your customer" in title.lower():
        print("[MAP Generator Agent] KYC Biometrics context parsed. Emitting pre-seeded compliance action list...")
        return {
            "maps": [
                {
                    "title": "Aadhaar Biometric SDK Integration on Digital Banking Portals",
                    "description": "Procure, implement, and test Aadhaar-compliant biometric scanning and authentication SDK libraries across the bank's net banking and mobile payment applications (Canara AI1 app) to verify customer identity during high-value transactions.",
                    "obligation_type": "MANDATORY",
                    "classification": "TECHNICAL",
                    "deliverable": "Successfully integrated and tested biometric authentication API endpoints in Mobile NetBanking apps, verified via API security logs.",
                    "deadline": "2026-08-30",
                    "priority": "CRITICAL",
                    "risk_level": "HIGH",
                    "risk_description": "Failure to verify biometric identity for digital account openings violates core RBI directions. Potential RBI penal fine up to Rs. 5 crore under Section 47A.",
                    "section_reference": "Section 4.3(a)",
                    "evidence_required": [
                        "API integration test execution logs",
                        "Screenshot confirmed from mobile app showing active finger/face scan prompt",
                        "IT Architecture Sign-off certificate"
                    ],
                    "regulatory_keywords": ["KYC", "Biometric", "Aadhaar", "SDK Integration"],
                    "confidence_score": 0.95,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "reasoning_chain": "Step 1: Direct obligation identified under Section 4.3(a) demanding Aadhaar biometric verification. Step 2: Since it targets digital net banking channels, assign it to Digital Banking IT department. Step 3: Set technical classification since it requires SDK code integration. Step 4: Map deadline to August 30, 2026, as specified in the circular."
                },
                {
                    "title": "Biometric Authentication Form & Customer Consent Policy Update",
                    "description": "Revise the bank's central customer privacy policy forms and terms of service documents to include mandatory biometric consent collection sections, ensuring compliance with the Digital Personal Data Protection (DPDP) Act.",
                    "obligation_type": "MANDATORY",
                    "classification": "NON_TECHNICAL",
                    "deliverable": "Approved updated customer consent PDF forms published on the official corporate repository with consent capture fields active.",
                    "deadline": "2026-08-30",
                    "priority": "HIGH",
                    "risk_level": "MEDIUM",
                    "risk_description": "Collecting customer biometrics without explicit DPDP-compliant consent forms exposes the bank to heavy data privacy penalties.",
                    "section_reference": "Section 4.3(c)",
                    "evidence_required": [
                        "Approved revised Privacy Policy PDF",
                        "Legal team sign-off memo",
                        "DPDP audit check report"
                    ],
                    "regulatory_keywords": ["Consent Policy", "DPDP Act", "Biometrics", "KYC"],
                    "confidence_score": 0.92,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "reasoning_chain": "Step 1: The biometrics circular requires legal consent. Step 2: Policy rewriting is a document change, hence NON_TECHNICAL. Step 3: Assigned to Legal and Compliance Central department for audit trail."
                }
            ],
            "skipped_provisions": [
                "Section 7.2: Penalty clause is informational regarding RBI enforcement details, no operational task is generated."
            ]
        }
        
    if "mfa" in title.lower() or "multi-factor" in title.lower() or "authentication" in title.lower() or "cybersecurity" in document_analysis.get('regulatory_domain', ''):
        print("[MAP Generator Agent] Cybersecurity MFA context parsed. Emitting standard action items...")
        return {
            "maps": [
                {
                    "title": "Hardware Token / FIDO2 Authentication Setup for Digital NetBanking Portal",
                    "description": "Implement hardware token or FIDO2-based multi-factor authentication (MFA) protocols on the NetBanking and payment API gateways to block automated login attempts and credential stuffing attacks.",
                    "obligation_type": "MANDATORY",
                    "classification": "TECHNICAL",
                    "deliverable": "FIDO2 security protocols successfully deployed on production login gateways, confirmed by penetration audit report.",
                    "deadline": "2026-09-15",
                    "priority": "CRITICAL",
                    "risk_level": "CRITICAL",
                    "risk_description": "Exposing transactional channels to single-factor credential threats is a major cyber liability, carrying potential CERT-In compliance penalties.",
                    "section_reference": "Section 2.1",
                    "evidence_required": [
                        "Penetration testing and security verification log",
                        "FIDO2 authentication configuration screenshot",
                        "Gateway audit report"
                    ],
                    "regulatory_keywords": ["MFA", "FIDO2", "NetBanking", "IT Security"],
                    "confidence_score": 0.98,
                    "flagged_for_review": False,
                    "flag_reason": None,
                    "reasoning_chain": "Step 1: Section 2.1 requires FIDO2/hardware multi-factor setups. Step 2: Requires login gateway system edits, so assign to IT Security and Digital Banking IT. Step 3: Priority is CRITICAL as it blocks core payment security threats."
                }
            ],
            "skipped_provisions": []
        }

    # Catch-all general directive MAP
    print("[MAP Generator Agent] Generic provisions parsed. Emitting operational supervision task...")
    return {
        "maps": [
            {
                "title": "Operational Compliance Internal Triage and Setup",
                "description": "Establish a compliance tracking task team to coordinate departmental reviews of the newly published directive " + title + " and set up corresponding audit records.",
                "obligation_type": "MANDATORY",
                "classification": "NON_TECHNICAL",
                "deliverable": "Triaged task delegation sheets uploaded to compliance central repository.",
                "deadline": (datetime.date.today() + datetime.timedelta(days=60)).isoformat(),
                "priority": "MEDIUM",
                "risk_level": "LOW",
                "risk_description": "Delayed coordination creates minor audit gaps during the quarterly board evaluations.",
                "section_reference": "Section 3.1",
                "evidence_required": [
                    "Meeting minutes detailing compliance delegation",
                    "Assigned task list sheet"
                ],
                "regulatory_keywords": ["Operations", "Compliance", "Triage"],
                "confidence_score": 0.85,
                "flagged_for_review": True,
                "flag_reason": "General obligation context requires human oversight for micro task allocations.",
                "reasoning_chain": "Step 1: Direct instruction to coordinate internal tracking of the circular. Step 2: Delegated to Operations and Compliance Central departments."
            }
        ],
        "skipped_provisions": []
    }

async def generate_maps(document_analysis: dict, publication_date: str = None) -> dict:
    """
    Main entry point for MAP Generation Agent.
    """
    is_dummy_key = settings.OPENAI_API_KEY == "your_openai_api_key_here" or not settings.OPENAI_API_KEY
    if is_dummy_key:
        return run_mock_map_generation(document_analysis)

    try:
        print(f"[MAP Generator Agent] Initializing ChatOpenAI handler with {settings.MODEL_NAME}...")
        llm = ChatOpenAI(
            model=settings.MODEL_NAME,
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.1,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        today_str = datetime.date.today().isoformat()
        pub_str = publication_date or today_str
        
        system_prompt = MAP_GENERATION_PROMPT.format(
            today_date=today_str,
            publication_date=pub_str
        )
        
        try:
            structured_llm = llm.with_structured_output(MAPGenerationResult)
            print(f"[MAP Generator Agent] Submitting provisions to LLM for MAP generation using {settings.MODEL_NAME}...")
            
            provisions_text = json.dumps(document_analysis.get('key_provisions', []), indent=2)
            
            result = await structured_llm.ainvoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract MAPs from the following extracted provisions list:\n\n{provisions_text}"}
            ])
            return result.model_dump()
        except Exception as structure_err:
            print(f"[MAP Generator Agent] structured_output failed ({structure_err}). Retrying via raw invoke with JSON format...")
            schema_json = json.dumps(MAPGenerationResult.model_json_schema(), indent=2)
            json_prompt = system_prompt + f"\n\nYou MUST return a JSON object conforming strictly to this JSON Schema:\n{schema_json}"
            
            provisions_text = json.dumps(document_analysis.get('key_provisions', []), indent=2)
            
            response = await llm.ainvoke([
                {"role": "system", "content": json_prompt},
                {"role": "user", "content": f"Extract MAPs from the following extracted provisions list:\n\n{provisions_text}"}
            ], response_format={"type": "json_object"})
            
            raw_content = response.content.strip()
            raw_content = re.sub(r'^```json\s*|\s*```$', '', raw_content, flags=re.MULTILINE).strip()
            parsed = json.loads(raw_content)
            return parsed
    except Exception as e:
        print(f"[MAP Generator Agent Error] LLM structured invocation failed: {e}. Falling back to sandbox generator...")
        return run_mock_map_generation(document_analysis)
