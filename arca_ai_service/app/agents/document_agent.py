import datetime
import json
import re
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from app.core.config import settings
from app.prompts.document_analysis import DOCUMENT_ANALYSIS_PROMPT

class Provision(BaseModel):
    section: str
    heading: str
    full_text: str
    provision_type: str  # OBLIGATION, GUIDANCE, DEFINITION, PENALTY
    is_actionable: bool

class DocumentAnalysis(BaseModel):
    document_title: str
    document_id: Optional[str]
    document_type: str
    executive_summary: str
    key_provisions: List[Provision]
    deadlines: List[dict]
    cross_references: List[dict]
    is_amendment: bool
    amends_document_id: Optional[str]
    applicability_keywords: List[str]
    regulatory_domain: str

async def run_document_agent(extracted_text: str, publication_date: str = None) -> dict:
    """
    Main entry point for Document Understanding Agent.
    """

    try:
        print(f"[Document Agent] Initializing ChatOpenAI handler with {settings.MODEL_NAME}...")
        llm = ChatOpenAI(
            model=settings.MODEL_NAME,
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.0,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        today_str = datetime.date.today().isoformat()
        pub_str = publication_date or today_str
        
        system_prompt = DOCUMENT_ANALYSIS_PROMPT.format(
            today_date=today_str,
            publication_date=pub_str
        )
        
        try:
            structured_llm = llm.with_structured_output(DocumentAnalysis)
            print(f"[Document Agent] Calling {settings.MODEL_NAME} with structured analysis payload...")
            result = await structured_llm.ainvoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the regulatory circular text:\n\n{extracted_text}"}
            ])
            return result.model_dump()
        except Exception as structure_err:
            print(f"[Document Agent] structured_output failed ({structure_err}). Retrying via raw invoke with JSON format...")
            schema_json = json.dumps(DocumentAnalysis.model_json_schema(), indent=2)
            json_prompt = system_prompt + f"\n\nYou MUST return a JSON object conforming strictly to this JSON Schema:\n{schema_json}"
            
            response = await llm.ainvoke([
                {"role": "system", "content": json_prompt},
                {"role": "user", "content": f"Here is the regulatory circular text:\n\n{extracted_text}"}
            ], response_format={"type": "json_object"})
            
            raw_content = response.content.strip()
            json_match = re.search(r'(\{.*\})', raw_content, re.DOTALL)
            if json_match:
                raw_content = json_match.group(1)
            parsed = json.loads(raw_content)
            return parsed
    except Exception as e:
        print(f"[Document Agent Error] LLM structured invocation failed: {e}. Returning minimal error structure.")
        return {
            "document_title": "Parsing Error - Unrecognized Document",
            "document_id": "ERR-PARSE",
            "document_type": "unknown",
            "executive_summary": f"The AI encountered an error while analyzing the document: {str(e)}",
            "key_provisions": [],
            "deadlines": [],
            "cross_references": [],
            "is_amendment": False,
            "amends_document_id": None,
            "applicability_keywords": ["Error", "Failed to Parse"],
            "regulatory_domain": "unknown"
        }
