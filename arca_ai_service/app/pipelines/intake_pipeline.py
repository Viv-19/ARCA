"""
ARCA-003 — Intelligent Intake Pipeline (LangGraph + LangChain)
===============================================================

Hybrid pipeline that determines RBI circular relevance BEFORE downloading PDFs.

Architecture:
  - LangGraph: Orchestration, state management, conditional routing
  - LangChain: LLM-powered classification (metadata + enhanced)
  - Plain Python: Confidence routing, HTML fetching, decision engine

Graph Flow:
  START → metadata_classification → confidence_router
    ├── (high confidence) → decision_engine → END
    └── (low confidence)  → detail_page_fetcher → enhanced_classification → decision_engine → END

Pipeline Position:
  Document Registry (NEW docs) → [THIS PIPELINE] → Download Manager
"""

import json
import re
import logging
import datetime
from typing import Optional, Callable, List

import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from app.core.config import settings
from app.models.intake import (
    IntakeState,
    Classification,
    Decision,
    DetailPage,
    INTAKE_CONFIG,
)
from app.prompts.intake_prompts import (
    METADATA_CLASSIFICATION_PROMPT,
    ENHANCED_CLASSIFICATION_PROMPT,
)

logger = logging.getLogger("arca.intake_pipeline")


# ─────────────────────────────────────────────
# Helper: State Logger
# ─────────────────────────────────────────────

def _log(state: dict, msg: str) -> list:
    """Appends a timestamped log message to the state's log list."""
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    logger.info(msg)
    logs = list(state.get("logs", []))
    logs.append(entry)
    return logs


# ─────────────────────────────────────────────
# Shared LLM Invocation Helper
# ─────────────────────────────────────────────

async def _invoke_llm_classification(formatted_prompt: str) -> Classification:
    """
    Invokes the LLM to produce a Classification object.
    
    Strategy:
      1. Try with_structured_output (works with OpenAI, newer Groq models)
      2. Fallback to raw JSON invocation + manual parsing (works with all models)
    
    This matches the fallback pattern used in map_generation_agent.py.
    """
    llm = ChatOpenAI(
        model=settings.MODEL_NAME,
        openai_api_base=settings.OPENAI_API_BASE,
        temperature=0.1,
        openai_api_key=settings.OPENAI_API_KEY,
    )

    messages = [
        {"role": "system", "content": "You are an RBI regulatory circular classification agent. Respond with valid JSON only."},
        {"role": "user", "content": formatted_prompt},
    ]

    # Attempt 1: Structured output (preferred)
    try:
        structured_llm = llm.with_structured_output(Classification)
        result = await structured_llm.ainvoke(messages)
        return result
    except Exception as struct_err:
        logger.info(f"[Intake] structured_output failed ({struct_err}). Falling back to raw JSON...")

    # Attempt 2: Raw JSON response + manual parsing
    schema_json = json.dumps(Classification.model_json_schema(), indent=2)
    json_messages = [
        {
            "role": "system",
            "content": (
                "You are an RBI regulatory circular classification agent. "
                "You MUST respond with ONLY a valid JSON object (no markdown, no commentary). "
                f"The JSON must conform to this schema:\n{schema_json}"
            ),
        },
        {"role": "user", "content": formatted_prompt},
    ]

    response = await llm.ainvoke(json_messages)
    raw_content = response.content.strip()

    # Strip markdown fences if present
    json_match = re.search(r'(\{.*\})', raw_content, re.DOTALL)
    if json_match:
        raw_content = json_match.group(1)

    parsed = json.loads(raw_content)
    return Classification(**parsed)


# ─────────────────────────────────────────────
# Node 1: Metadata Classification Agent (LangChain)
# ─────────────────────────────────────────────

async def metadata_classification_node(state: IntakeState) -> dict:
    """
    Uses the LLM to classify a circular based on metadata only.
    
    Input: circular_metadata (title, department, meant_for, etc.)
    Output: metadata_classification (Classification), confidence (float)
    """
    meta = state["circular_metadata"]
    logs = _log(state, f"[Intake] Node 1: Metadata Classification started for {meta.get('circular_number', 'UNKNOWN')}")

    try:
        formatted_prompt = METADATA_CLASSIFICATION_PROMPT.format(
            circular_number=meta.get("circular_number", ""),
            title=meta.get("title", ""),
            department=meta.get("department", ""),
            meant_for=meta.get("meant_for", ""),
            publication_date=meta.get("publication_date", ""),
        )

        result = await _invoke_llm_classification(formatted_prompt)

        logs = _log({"logs": logs}, f"[Intake] Classification: domain={result.business_domain}, priority={result.priority}, confidence={result.confidence:.2f}")
        logs = _log({"logs": logs}, f"[Intake] Reason: {result.reason}")

        return {
            "metadata_classification": result,
            "confidence": result.confidence,
            "processing_status": "CLASSIFIED",
            "logs": logs,
        }

    except Exception as e:
        logs = _log({"logs": logs}, f"[Intake] ERROR in metadata classification: {e}")
        # On failure, produce a low-confidence fallback so the graph continues
        fallback = Classification(
            entity_types=["Unknown"],
            document_type="Unknown",
            business_domain="Other",
            priority="MEDIUM",
            confidence=0.0,
            needs_detail_page=True,
            reason=f"Classification failed: {str(e)}",
        )
        return {
            "metadata_classification": fallback,
            "confidence": 0.0,
            "processing_status": "CLASSIFICATION_FAILED",
            "logs": logs,
        }


# ─────────────────────────────────────────────
# Node 2: Confidence Router (Pure Python — Conditional Edge)
# ─────────────────────────────────────────────

def confidence_router(state: IntakeState) -> str:
    """
    Deterministic routing based on confidence threshold and LLM's own assessment.
    
    If needs_detail_page is True, route to detail_page_fetcher.
    Else if confidence >= threshold, route to decision_engine (skip detail page).
    Else route to detail_page_fetcher.
    """
    classification = state.get("metadata_classification")
    needs_detail = getattr(classification, "needs_detail_page", False)
    confidence = state.get("confidence", 0.0)
    threshold = INTAKE_CONFIG["confidence_threshold"]

    if needs_detail:
        logger.info(f"[Intake] Router: LLM explicitly requested detail page (needs_detail_page=True) → DETAIL_PAGE_FETCHER")
        return "low_confidence"
    elif confidence >= threshold:
        logger.info(f"[Intake] Router: confidence {confidence:.2f} >= {threshold} → DECISION_ENGINE (skipping detail page)")
        return "high_confidence"
    else:
        logger.info(f"[Intake] Router: confidence {confidence:.2f} < {threshold} → DETAIL_PAGE_FETCHER")
        return "low_confidence"


# ─────────────────────────────────────────────
# Node 3: Detail Page Fetcher (Pure Python)
# ─────────────────────────────────────────────

async def detail_page_fetcher_node(state: IntakeState) -> dict:
    """
    Fetches the RBI circular's HTML detail page and extracts key text.
    
    NEVER downloads the PDF. Only grabs the HTML body text.
    
    Extracts:
      - Recipient / addressee
      - Subject line
      - Introductory paragraphs
      - References to previous circulars
      - Effective dates
      - Issuing authority
    
    On failure: logs the error and continues with empty detail_page.
    """
    meta = state["circular_metadata"]
    detail_url = meta.get("detail_url", "")
    logs = _log(state, f"[Intake] Node 3: Fetching detail page: {detail_url}")

    if not detail_url:
        logs = _log({"logs": logs}, "[Intake] No detail_url available. Skipping fetch.")
        return {
            "detail_page": DetailPage(content="", error="No detail URL provided"),
            "logs": logs,
        }

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        async with httpx.AsyncClient(
            headers=headers,
            follow_redirects=True,
            timeout=20.0,
        ) as client:
            response = await client.get(detail_url)
            response.raise_for_status()

        html = response.text
        soup = BeautifulSoup(html, "html.parser")

        # ── Extract the circular content area ──
        # RBI detail pages typically use a panel with ID "divContent" or "pnlDetails"
        content_div = (
            soup.find("div", id="divContent")
            or soup.find("div", id="pnlDetails")
            or soup.find("div", {"class": "content_area"})
            or soup.find("div", {"class": "tablecontent"})
        )

        if content_div:
            # Remove script/style tags
            for tag in content_div.find_all(["script", "style"]):
                tag.decompose()
            
            extracted_text = content_div.get_text(separator="\n", strip=True)
        else:
            # Fallback: extract all paragraph text from the page body
            paragraphs = soup.find_all("p")
            extracted_text = "\n".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))

        # Truncate to ~4000 chars to stay within LLM context limits
        if len(extracted_text) > 4000:
            extracted_text = extracted_text[:4000] + "\n\n[... truncated for classification ...]"

        logs = _log({"logs": logs}, f"[Intake] Detail page fetched successfully ({len(extracted_text)} chars extracted)")

        return {
            "detail_page": DetailPage(content=extracted_text),
            "logs": logs,
        }

    except Exception as e:
        error_msg = f"Detail page fetch failed: {str(e)}"
        logs = _log({"logs": logs}, f"[Intake] WARNING: {error_msg}. Continuing with metadata classification only.")

        return {
            "detail_page": DetailPage(content="", error=error_msg),
            "processing_status": "LOW_CONFIDENCE",
            "logs": logs,
        }


# ─────────────────────────────────────────────
# Node 4: Enhanced Classification Agent (LangChain)
# ─────────────────────────────────────────────

async def enhanced_classification_node(state: IntakeState) -> dict:
    """
    Re-classifies the circular using both metadata AND detail page content.
    
    Only runs when the Confidence Router determined that metadata-only
    classification had insufficient confidence.
    """
    meta = state["circular_metadata"]
    detail = state.get("detail_page")
    logs = _log(state, "[Intake] Node 4: Enhanced Classification started (metadata + detail page)")

    detail_content = ""
    if detail and detail.content:
        detail_content = detail.content
    else:
        logs = _log({"logs": logs}, "[Intake] Detail page content is empty. Classifying with metadata only (degraded mode).")
        detail_content = "[Detail page content unavailable]"

    try:
        formatted_prompt = ENHANCED_CLASSIFICATION_PROMPT.format(
            circular_number=meta.get("circular_number", ""),
            title=meta.get("title", ""),
            department=meta.get("department", ""),
            meant_for=meta.get("meant_for", ""),
            publication_date=meta.get("publication_date", ""),
            detail_page_content=detail_content,
        )

        result = await _invoke_llm_classification(formatted_prompt)

        logs = _log({"logs": logs}, f"[Intake] Enhanced Classification: domain={result.business_domain}, confidence={result.confidence:.2f}")
        logs = _log({"logs": logs}, f"[Intake] Enhanced Reason: {result.reason}")

        return {
            "enhanced_classification": result,
            "confidence": result.confidence,
            "logs": logs,
        }

    except Exception as e:
        logs = _log({"logs": logs}, f"[Intake] ERROR in enhanced classification: {e}")
        # Fall through to decision engine with existing metadata classification but flag needs_pdf
        fallback = Classification(
            entity_types=meta.get("entity_types", ["Unknown"]),
            document_type="Unknown",
            business_domain="Other",
            priority="MEDIUM",
            confidence=0.0,
            needs_pdf=True,
            reason=f"Enhanced classification failed: {str(e)}",
        )
        return {
            "enhanced_classification": fallback,
            "processing_status": "ENHANCED_CLASSIFICATION_FAILED",
            "logs": logs,
        }


# ─────────────────────────────────────────────
# Node 5: Decision Engine (Pure Python)
# ─────────────────────────────────────────────

async def decision_engine_node(state: IntakeState) -> dict:
    """
    Evaluates the final classification against business rules.
    
    Uses the enhanced classification if available, otherwise falls back
    to metadata classification.
    
    Checks:
      1. Does any entity_type match our supported_entities list?
      2. Does the business_domain match our supported_domains list?
    
    No LLM involved. Pure rule-based evaluation.
    """
    logs = _log(state, "[Intake] Node 5: Decision Engine evaluating relevance...")

    # Pick the best available classification
    classification = state.get("enhanced_classification") or state.get("metadata_classification")

    if not classification:
        logs = _log({"logs": logs}, "[Intake] CRITICAL: No classification available. Defaulting to NOT relevant.")
        decision = Decision(
            relevant=False,
            download_pdf=False,
            matched_entity=None,
            matched_domain=None,
            reason="No classification was produced by the pipeline.",
        )
        return {
            "decision": decision,
            "processing_status": "COMPLETED",
            "logs": logs,
        }

    supported_entities = INTAKE_CONFIG["supported_entities"]
    supported_domains = INTAKE_CONFIG["supported_domains"]

    # ── Entity Matching ──
    # Check if any classified entity type matches (case-insensitive partial match)
    matched_entity = None
    for classified_entity in classification.entity_types:
        for supported in supported_entities:
            if supported.lower() in classified_entity.lower() or classified_entity.lower() in supported.lower():
                matched_entity = supported
                break
        if matched_entity:
            break

    # ── Domain Matching ──
    matched_domain = None
    classified_domain = classification.business_domain
    for supported in supported_domains:
        if supported.lower() == classified_domain.lower():
            matched_domain = supported
            break
        # Fuzzy: check if the classified domain contains or is contained by a supported domain
        if supported.lower() in classified_domain.lower() or classified_domain.lower() in supported.lower():
            matched_domain = supported
            break

    # ── Relevance Decision ──
    is_relevant = matched_entity is not None  # Entity match is required
    should_download = is_relevant  # Download PDF only if relevant
    needs_pdf = getattr(classification, "needs_pdf", False)

    if needs_pdf:
        should_download = True
        reason = f"LLM explicitly requested PDF evaluation (needs_pdf=True). Entity match: {matched_entity}. Domain match: {matched_domain}."
    elif is_relevant and matched_domain:
        reason = f"Entity '{matched_entity}' and domain '{matched_domain}' are both supported. Classification confidence: {classification.confidence:.2f}."
    elif is_relevant:
        reason = f"Entity '{matched_entity}' is supported but domain '{classified_domain}' is not directly in our tracked list. Downloading for review. Confidence: {classification.confidence:.2f}."
    else:
        reason = f"No supported entity match found. Classified entities: {classification.entity_types}. Domain: {classified_domain}. Confidence: {classification.confidence:.2f}."
        should_download = False

    decision = Decision(
        relevant=is_relevant,
        download_pdf=should_download,
        matched_entity=matched_entity,
        matched_domain=matched_domain,
        reason=reason,
    )

    logs = _log({"logs": logs}, f"[Intake] Decision: relevant={decision.relevant}, download_pdf={decision.download_pdf}")
    logs = _log({"logs": logs}, f"[Intake] Matched entity: {decision.matched_entity}, domain: {decision.matched_domain}")
    logs = _log({"logs": logs}, f"[Intake] Reason: {decision.reason}")

    return {
        "decision": decision,
        "processing_status": "COMPLETED",
        "logs": logs,
    }


# ─────────────────────────────────────────────
# Graph Assembly
# ─────────────────────────────────────────────

def build_intake_graph():
    """
    Assembles and compiles the Intelligent Intake LangGraph pipeline.
    
    Graph:
      START → metadata_classification → confidence_router
        ├── high_confidence → decision_engine → END
        └── low_confidence  → detail_page_fetcher → enhanced_classification → decision_engine → END
    """
    logger.info("[Intake Graph] Building Intelligent Intake Pipeline...")

    builder = StateGraph(IntakeState)

    # Register nodes
    builder.add_node("metadata_classification", metadata_classification_node)
    builder.add_node("detail_page_fetcher", detail_page_fetcher_node)
    builder.add_node("enhanced_classification", enhanced_classification_node)
    builder.add_node("decision_engine", decision_engine_node)

    # Entry point
    builder.set_entry_point("metadata_classification")

    # Conditional routing after metadata classification
    builder.add_conditional_edges(
        "metadata_classification",
        confidence_router,
        {
            "high_confidence": "decision_engine",
            "low_confidence": "detail_page_fetcher",
        },
    )

    # Low-confidence path: fetch detail → enhance → decide
    builder.add_edge("detail_page_fetcher", "enhanced_classification")
    builder.add_edge("enhanced_classification", "decision_engine")

    # Terminal
    builder.add_edge("decision_engine", END)

    logger.info("[Intake Graph] Pipeline compiled successfully.")
    return builder.compile()


# ─────────────────────────────────────────────
# Public API: Run Intake for a Single Document
# ─────────────────────────────────────────────

# Compile the graph once at module level
_intake_graph = None


def _get_graph():
    """Lazy initialization of the compiled graph."""
    global _intake_graph
    if _intake_graph is None:
        _intake_graph = build_intake_graph()
    return _intake_graph


async def run_intake_for_document(
    circular_metadata: dict,
    log_callback: Optional[Callable[[str], None]] = None,
) -> dict:
    """
    Runs the Intelligent Intake Pipeline for a single document.
    
    Args:
        circular_metadata: A metadata dict with keys:
            circular_number, title, department, meant_for,
            publication_date, detail_url
        log_callback: Optional function for real-time log streaming.
    
    Returns:
        Dict with the full pipeline result including:
            - metadata_classification
            - enhanced_classification (if triggered)
            - decision
            - processing_status
            - logs
    """
    graph = _get_graph()

    initial_state: IntakeState = {
        "circular_metadata": circular_metadata,
        "metadata_classification": None,
        "enhanced_classification": None,
        "confidence": 0.0,
        "detail_page": None,
        "decision": None,
        "processing_status": "IN_PROGRESS",
        "logs": [],
    }

    # Execute the graph
    final_state = await graph.ainvoke(initial_state)

    # Stream logs to callback if provided
    if log_callback:
        for log_entry in final_state.get("logs", []):
            log_callback(log_entry)

    # Serialize Pydantic models to dicts for JSON response
    result = {
        "circular_number": circular_metadata.get("circular_number"),
        "title": circular_metadata.get("title"),
        "processing_status": final_state.get("processing_status"),
        "confidence": final_state.get("confidence", 0.0),
        "logs": final_state.get("logs", []),
    }

    meta_class = final_state.get("metadata_classification")
    if meta_class:
        result["metadata_classification"] = meta_class.model_dump() if hasattr(meta_class, "model_dump") else meta_class

    enhanced_class = final_state.get("enhanced_classification")
    if enhanced_class:
        result["enhanced_classification"] = enhanced_class.model_dump() if hasattr(enhanced_class, "model_dump") else enhanced_class

    decision = final_state.get("decision")
    if decision:
        result["decision"] = decision.model_dump() if hasattr(decision, "model_dump") else decision

    return result


async def run_intake_batch(
    documents: List[dict],
    log_callback: Optional[Callable[[str], None]] = None,
) -> List[dict]:
    """
    Runs the Intake Pipeline for a batch of documents (sequentially).
    
    Rate-limited to respect Groq free tier constraints.
    
    Args:
        documents: List of metadata dicts from the Document Registry.
        log_callback: Optional function for real-time log streaming.
    
    Returns:
        List of pipeline results, one per document.
    """
    import asyncio
    
    results = []
    total = len(documents)

    for idx, doc in enumerate(documents):
        if log_callback:
            log_callback(f"[Intake Batch] Processing {idx+1}/{total}: {doc.get('circular_number', 'UNKNOWN')}")

        try:
            result = await run_intake_for_document(doc, log_callback=log_callback)
            results.append(result)
        except Exception as e:
            logger.error(f"[Intake Batch] Failed for {doc.get('circular_number')}: {e}")
            results.append({
                "circular_number": doc.get("circular_number"),
                "title": doc.get("title"),
                "processing_status": "FAILED",
                "error": str(e),
            })

        # Rate limiting: wait 2s between LLM calls for Groq free tier
        if idx < total - 1:
            await asyncio.sleep(2)

    return results
