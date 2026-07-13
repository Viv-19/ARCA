from typing import List, Optional, TypedDict
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────
# Business Rules Configuration
# ─────────────────────────────────────────────
# Hardcoded for Phase 1 as requested. Can be moved to DB or .env later.

INTAKE_CONFIG = {
    "confidence_threshold": 0.85,  # Trigger detail page fetch if confidence < 0.85
    "supported_entities": [
        "Commercial Banks",
        "All Banks",
        "Scheduled Commercial Banks",
        "Authorised Dealer Category-I Banks",
        "Payment System Providers",
        "Non-Banking Financial Companies (NBFCs)"
    ],
    "supported_domains": [
        "IT Governance",
        "Cybersecurity",
        "Treasury",
        "Capital Adequacy",
        "KYC",
        "AML",
        "Digital Payments",
        "Foreign Exchange",
        "Risk Management",
        "Compliance"
    ]
}


# ─────────────────────────────────────────────
# Structured LLM Outputs (Pydantic Models)
# ─────────────────────────────────────────────

class Classification(BaseModel):
    """
    The structured output expected from the Classification Agents (both Metadata and Enhanced).
    """
    entity_types: List[str] = Field(
        description="The specific types of regulated entities this circular applies to (e.g., 'Commercial Banks', 'NBFCs')."
    )
    document_type: str = Field(
        description="The type of the document (e.g., 'Master Direction', 'Notification', 'Amendment')."
    )
    business_domain: str = Field(
        description="The primary business domain affected (e.g., 'IT Governance', 'Treasury', 'KYC')."
    )
    priority: str = Field(
        description="The regulatory priority of this circular: 'HIGH', 'MEDIUM', or 'LOW'."
    )
    confidence: float = Field(
        description="Your confidence score in this classification from 0.0 to 1.0. If you lack sufficient context from the provided text, lower this score."
    )
    needs_detail_page: bool = Field(
        default=False,
        description="True if confidence is low or entities cannot be confidently identified, signaling that the HTML detail page should be fetched."
    )
    needs_pdf: bool = Field(
        default=False,
        description="True if even the HTML detail page is insufficient to determine relevance and the PDF must be downloaded."
    )
    reason: str = Field(
        description="A brief explanation for your classification and confidence score."
    )


class Decision(BaseModel):
    """
    The output of the Python Decision Engine.
    """
    relevant: bool = Field(description="Is this circular relevant to our organization?")
    download_pdf: bool = Field(description="Should we proceed to download and parse the PDF?")
    matched_entity: Optional[str] = Field(description="The specific supported entity type that matched, if any.")
    matched_domain: Optional[str] = Field(description="The specific supported business domain that matched, if any.")
    reason: str = Field(description="Explanation for the routing decision.")


class DetailPage(BaseModel):
    """
    Data extracted deterministically from the RBI detail HTML page.
    """
    content: str = Field(description="The extracted introductory text from the HTML.")
    error: Optional[str] = Field(default=None, description="Any error encountered during fetching.")


# ─────────────────────────────────────────────
# LangGraph State Definition
# ─────────────────────────────────────────────

class IntakeState(TypedDict):
    """
    The shared state passed through the LangGraph workflow.
    Each node updates only its relevant fields.
    """
    # Input
    circular_metadata: dict  # The metadata dict from the Document Registry
    
    # Node 1: Metadata Classification Agent
    metadata_classification: Optional[Classification]
    
    # Routing variable (extracted from classification for convenience)
    confidence: float
    
    # Node 3: Detail Page Fetcher
    detail_page: Optional[DetailPage]
    
    # Node 4: Enhanced Classification Agent
    enhanced_classification: Optional[Classification]
    
    # Node 5: Decision Engine
    decision: Optional[Decision]
    
    # Processing state
    processing_status: str  # "IN_PROGRESS", "LOW_CONFIDENCE", "COMPLETED"
    logs: List[str]
