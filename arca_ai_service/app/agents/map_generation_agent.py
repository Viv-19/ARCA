import datetime
import json
import re
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

async def generate_maps(document_analysis: dict, publication_date: str = None, raw_text: Optional[str] = None) -> dict:
    """
    Main entry point for MAP Generation Agent with LLM Self-Correction.
    """

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
        
        # Import self-correction prompt
        from app.prompts.map_generation import MAP_SELF_CORRECTION_PROMPT
        
        structured_llm = llm.with_structured_output(MAPGenerationResult)
        
        # 1. Generate Initial MAPs
        initial_result = None
        try:
            print(f"[MAP Generator Agent] Submitting provisions to LLM for MAP generation using {settings.MODEL_NAME}...")
            provisions_text = json.dumps(document_analysis.get('key_provisions', []), indent=2)
            
            result = await structured_llm.ainvoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract MAPs from the following extracted provisions list:\n\n{provisions_text}"}
            ])
            initial_result = result.model_dump()
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
            json_match = re.search(r'(\{.*\})', raw_content, re.DOTALL)
            if json_match:
                raw_content = json_match.group(1)
            initial_result = json.loads(raw_content)

        # 2. Run Self-Correction Step
        if initial_result and isinstance(initial_result, dict):
            ref_text = raw_text
            if not ref_text:
                ref_text = json.dumps(document_analysis.get('key_provisions', []), indent=2)
                
            print(f"[MAP Generator Agent] Running Self-Correction pass on {len(initial_result.get('maps', []))} initial maps...")
            schema_json = json.dumps(MAPGenerationResult.model_json_schema(), indent=2)
            corr_prompt = MAP_SELF_CORRECTION_PROMPT.format(
                raw_text=ref_text,
                initial_maps=json.dumps(initial_result, indent=2),
                schema=schema_json
            )
            
            try:
                print("[MAP Generator Agent] Submitting self-correction review to LLM...")
                corrected = await structured_llm.ainvoke([
                    {"role": "system", "content": corr_prompt},
                    {"role": "user", "content": "Review the initially generated MAPs against the raw text and output the final corrected MAP list."}
                ])
                corrected_dict = corrected.model_dump()
                print(f"[MAP Generator Agent] Self-correction complete. Final count: {len(corrected_dict.get('maps', []))} maps.")
                return corrected_dict
            except Exception as corr_err:
                print(f"[MAP Generator Agent Warning] Structured self-correction failed ({corr_err}). Retrying via raw JSON response...")
                try:
                    response = await llm.ainvoke([
                        {"role": "system", "content": corr_prompt},
                        {"role": "user", "content": "Review the initially generated MAPs against the raw text and output the final corrected MAP list."}
                    ], response_format={"type": "json_object"})
                    
                    raw_content = response.content.strip()
                    json_match = re.search(r'(\{.*\})', raw_content, re.DOTALL)
                    if json_match:
                        raw_content = json_match.group(1)
                    parsed = json.loads(raw_content)
                    print(f"[MAP Generator Agent] Self-correction (raw JSON fallback) complete. Final count: {len(parsed.get('maps', []))} maps.")
                    return parsed
                except Exception as raw_corr_err:
                    print(f"[MAP Generator Agent Error] Self-correction fallback failed ({raw_corr_err}). Returning initial MAPs.")
                    return initial_result
        else:
            return initial_result
    except Exception as e:
        print(f"[MAP Generator Agent Error] LLM structured invocation failed: {e}. Returning minimal error structure.")
        return {
            "maps": [
                {
                    "title": "MAP Generation Error",
                    "description": f"The AI encountered an error while translating provisions into tasks: {str(e)}",
                    "obligation_type": "CONDITIONAL",
                    "classification": "NON_TECHNICAL",
                    "deliverable": "Review Error Log",
                    "deadline": datetime.date.today().isoformat(),
                    "priority": "LOW",
                    "risk_level": "LOW",
                    "risk_description": "Failed to parse MAPs.",
                    "section_reference": "N/A",
                    "evidence_required": [],
                    "regulatory_keywords": ["Error"],
                    "confidence_score": 0.0,
                    "flagged_for_review": True,
                    "flag_reason": "AI parsing failure.",
                    "reasoning_chain": "Error in map_generation_agent."
                }
            ],
            "skipped_provisions": []
        }
