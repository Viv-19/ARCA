import json
import re
from typing import List
from app.core.config import settings
from app.vectorstore.chroma_client import get_departments_collection

# Canonical department names — must match seed_departments.js exactly
CANONICAL_DEPARTMENTS = [
    "IT Security",
    "Digital Banking IT",
    "Core Banking IT",
    "Compliance Central",
    "Legal",
    "HR and Training",
    "Risk Management",
    "Retail Banking Ops",
    "Corporate Banking Ops",
    "Treasury",
    "Audit",
    "NRI Services",
    "Operations",
]

# Department profiles used for ChromaDB fallback seeding.
# Rich keyword sets improve fallback quality when the LLM is unavailable.
DEPARTMENT_PROFILES = {
    "IT Security": (
        "cybersecurity MFA multi-factor authentication encryption TLS SSL firewall VAPT vulnerability "
        "assessment penetration testing CERT-In information security policy access control IAM identity "
        "access management hardware security keys FIDO2 TOTP OTP incident response SOC security operations "
        "SIEM patch management API security phishing DLP data loss prevention network hardening "
        "endpoint security zero trust privileged access ransomware cyber resilience"
    ),
    "Digital Banking IT": (
        "mobile banking app iOS Android NetBanking UPI IMPS digital channels payment gateway API gateway "
        "NACH ECS digital VKYC video KYC online banking mobile app digital infrastructure mobile wallet "
        "fintech digital lending AEPS Aadhaar enabled digital payments internet banking BankingAsAService "
        "cloud infrastructure DevSecOps digital product compliance app store"
    ),
    "Core Banking IT": (
        "CBS core banking solution SWIFT interbank settlement NEFT RTGS IMPS system level account ledger "
        "integrity batch processing data archival inter-core reconciliation interest calculation engine "
        "CBS patch upgrade transaction processing database maintenance system integration middleware "
        "CBS vendor compliance Finacle Flexcube mainframe legacy modernisation"
    ),
    "Compliance Central": (
        "KYC know your customer AML anti money laundering regulatory reporting RBI returns PMLA compliance "
        "governance policy dissemination board reporting regulatory inspection circular implementation "
        "FEMA sanctions screening STR CTR compliance program internal compliance officer compliance audit "
        "CERSAI FIU-IND SEBI compliance returns compliance monitoring"
    ),
    "Legal": (
        "legal penalty regulatory notice court litigation legal opinion contract agreement dispute resolution "
        "statutory filing legal compliance enforcement action show cause notice legal representation "
        "consumer court DRT recovery SARFAESI legal documentation legal review regulatory order "
        "legal risk grievance arbitration"
    ),
    "HR and Training": (
        "employee training compliance awareness HR policy staff certification onboarding induction "
        "fit and proper background verification whistleblower code of conduct e-learning LMS "
        "compliance training mandatory training regulatory awareness staff competency HR circular "
        "promotion transfer HR compliance hiring workforce"
    ),
    "Risk Management": (
        "credit risk market risk operational risk capital adequacy Basel III Basel IV stress testing "
        "ICAAP ILAAP fraud risk NPA non performing asset asset quality risk weighted assets RAROC "
        "enterprise risk management ERM risk framework liquidity risk interest rate risk concentration "
        "risk operational risk loss provisioning risk appetite board risk committee"
    ),
    "Retail Banking Ops": (
        "retail banking customer KYC savings account current account fixed deposit recurring deposit "
        "retail loan home loan personal loan auto loan gold loan priority sector lending PSL "
        "debit card ATM credit card locker interest rate disclosure BCSBI consumer protection "
        "grievance redressal branch operations fair practices code retail products"
    ),
    "Corporate Banking Ops": (
        "corporate banking SME MSME large enterprise working capital term loan credit appraisal "
        "trade finance letter of credit bank guarantee standby LC SBLC project finance syndicated loan "
        "consortium lending corporate KYC due diligence restructuring OTS one time settlement "
        "MSME priority sector corporate credit NPA resolution corporate restructuring"
    ),
    "Treasury": (
        "treasury forex foreign exchange FEMA government securities G-Sec SLR statutory liquidity ratio "
        "CRR cash reserve ratio LCR liquidity coverage ratio NSFR ALM asset liability management "
        "money market call money T-bills bond derivative forex derivative overnight index swap "
        "forex hedging investment portfolio treasury compliance front office"
    ),
    "Audit": (
        "internal audit concurrent audit IS audit revenue audit risk based audit inspection "
        "LFAR long form audit report audit trail evidence management statutory audit coordination "
        "forensic audit audit committee compliance audit follow up regulatory inspection findings "
        "audit checklist audit planning audit report bank audit"
    ),
    "NRI Services": (
        "NRI non resident Indian NRE NRO FCNR non resident external ordinary foreign currency "
        "inward remittance outward remittance FEMA NRI repatriation FATCA CRS common reporting "
        "overseas direct investment OCI PIO foreign currency account NRI account "
        "NRI loan NRI deposits NRI services compliance"
    ),
    "Operations": (
        "central operations clearing cheque NACH mandate currency chest cash management "
        "clearing house back office safe deposit locker operations Fedai physical operations "
        "cheque truncation CTS outward clearing inward clearing DD pay order cash remittance "
        "physical document management vault operations"
    ),
}

# Full department guide embedded in LLM prompts for context-aware routing
_DEPARTMENT_ROUTING_GUIDE = """
You are a compliance routing specialist at Canara Bank. Your job is to assign each compliance
MAP (Measurable Action Point) to the ONE department that owns it operationally.

CANARA BANK DEPARTMENT DIRECTORY — 13 Departments:
══════════════════════════════════════════════════════════════════════

1. IT Security
   OWNS: Cybersecurity mandates, MFA/2FA implementation, encryption standards (TLS 1.3/SSL),
   firewall and network hardening, VAPT, CERT-In directives, information security policy,
   access control/IAM, hardware security keys (FIDO2/TOTP), incident response, SOC/SIEM,
   patch and vulnerability management, API security, phishing prevention, DLP.
   ► Route HERE for: anything about securing systems, encrypting data, authentication, or responding to cyber threats.

2. Digital Banking IT
   OWNS: Mobile banking app compliance, NetBanking portal mandates, UPI/IMPS/NEFT digital
   channels, API gateway compliance, payment gateway integration, digital KYC (VKYC),
   mobile wallet regulations, digital lending platforms, NACH/ECS digital mandates, fintech integrations.
   ► Route HERE for: anything about digital/mobile/online banking products or digital channel infrastructure.

3. Core Banking IT
   OWNS: CBS (Finacle/Flexcube) upgrades and patches, SWIFT interface compliance,
   NEFT/RTGS system-level compliance, account ledger integrity, batch processing,
   CBS-level data archival, inter-core reconciliation, interest calculation engine, CBS vendor rules.
   ► Route HERE for: anything about the core banking system software, SWIFT, or system-level transaction processing.

4. Compliance Central
   OWNS: KYC/AML implementation, RBI regulatory returns filing, compliance program governance,
   internal policy updates for circulars, board compliance reporting, PMLA compliance,
   FEMA/FIU-IND reporting, sanctions screening, regulatory inspection readiness.
   ► Route HERE for: general policy compliance, regulatory reporting returns, KYC/AML programs, governance.

5. Legal
   OWNS: Regulatory penalty notices, legal interpretation of directives, court/tribunal
   representations, contract review, dispute resolution, statutory filings, SARFAESI/DRT,
   legal opinions on circular applicability, enforcement actions, show-cause notices.
   ► Route HERE for: anything involving legal notices, penalties, court proceedings, or legal risk.

6. HR and Training
   OWNS: Staff compliance training programs, RBI-mandated awareness campaigns, fit-and-proper
   processes, compliance certification, onboarding compliance, e-learning, code of conduct,
   whistleblower policy, background verification mandates.
   ► Route HERE for: training programs, employee awareness, HR policy updates for regulatory requirements.

7. Risk Management
   OWNS: Credit/market/operational risk frameworks, capital adequacy (Basel III/IV), stress
   testing, ICAAP/ILAAP, fraud risk monitoring, NPA management, asset quality review,
   risk-weighted assets, enterprise risk, liquidity risk, RAROC.
   ► Route HERE for: risk measurement, capital requirements, stress tests, fraud/NPA risk, risk frameworks.

8. Retail Banking Ops
   OWNS: Retail customer KYC, savings/current account regulations, fixed/recurring deposits,
   retail loan mandates (home/personal/auto/gold), debit cards, ATMs, credit card fair
   practice, locker regulations, branch operations, BCSBI/customer protection, PSL retail.
   ► Route HERE for: retail customer products, branch-level compliance, individual customer account rules.

9. Corporate Banking Ops
   OWNS: SME/MSME/large enterprise credit, working capital and term loan compliance, trade
   finance (LC/BG/SBLC), syndicated loans, corporate KYC/due diligence, project finance,
   consortium lending, MSME priority sector, corporate restructuring/OTS.
   ► Route HERE for: corporate/business lending, trade finance, enterprise client compliance.

10. Treasury
    OWNS: Forex compliance (FEMA), G-Sec/T-Bill investments, SLR/CRR compliance, LCR/NSFR,
    ALM (asset-liability management), money market, forex derivatives, bond/debt compliance,
    treasury front-office operations compliance.
    ► Route HERE for: foreign exchange, government securities, statutory reserves (SLR/CRR), liquidity ratios.

11. Audit
    OWNS: Internal/concurrent/IS/revenue audit mandates, LFAR, inspection findings remediation,
    risk-based audit planning, audit trail and evidence, statutory audit coordination, forensic
    audit, audit committee compliance, compliance audit follow-up.
    ► Route HERE for: auditing obligations, inspection follow-up, audit report submissions, audit evidence.

12. NRI Services
    OWNS: NRE/NRO/FCNR account compliance, inward/outward remittance regulations, FEMA
    (non-resident provisions), repatriation rules, FATCA/CRS reporting, OCI/PIO banking.
    ► Route HERE for: anything specific to non-resident Indians, remittances, NRI accounts, or FATCA/CRS.

13. Operations
    OWNS: Central clearing operations, cheque/NACH/CTS processing, currency chest management,
    cash handling regulations, safe deposit/locker operations, back-office processing, Fedai
    operational guidelines, physical document management.
    ► Route HERE for: back-office clearing, cheque processing, currency chest, physical cash/vault operations.

══════════════════════════════════════════════════════════════════════
"""


def seed_department_embeddings_if_empty():
    """Seeds ChromaDB with department profiles if the collection is empty."""
    try:
        collection = get_departments_collection()
        if collection.count() == 0:
            print("[ChromaDB] departments_db empty. Seeding department embeddings...")
            for dept_name, profile_text in DEPARTMENT_PROFILES.items():
                collection.add(
                    documents=[profile_text],
                    ids=[dept_name],
                    metadatas=[{"department": dept_name}]
                )
            print(f"[ChromaDB] Seeded {len(DEPARTMENT_PROFILES)} department embeddings.")
    except Exception as e:
        print(f"[ChromaDB Seeding Warning] {e}")


def _normalize_department(name: str) -> str:
    """
    Maps the LLM's returned department name to the exact canonical name.
    Tries exact match → case-insensitive match → substring match → default.
    """
    if name in CANONICAL_DEPARTMENTS:
        return name
    lower = name.lower()
    # Case-insensitive exact
    for d in CANONICAL_DEPARTMENTS:
        if d.lower() == lower:
            return d
    # Substring match both ways
    for d in CANONICAL_DEPARTMENTS:
        if lower in d.lower() or d.lower() in lower:
            return d
    return "Compliance Central"


async def _chroma_fallback(title: str, description: str, keywords: List[str]) -> dict:
    """ChromaDB-based fallback when LLM routing is unavailable."""
    try:
        seed_department_embeddings_if_empty()
        collection = get_departments_collection()
        query = f"{title} {description} {' '.join(keywords)}"
        results = collection.query(query_texts=[query], n_results=1)
        dept = "Compliance Central"
        if results and results["ids"] and results["ids"][0]:
            dept = _normalize_department(results["ids"][0][0])
        return {
            "department": dept,
            "confidence": 0.5,
            "justification": "Assigned via ChromaDB semantic similarity (LLM routing unavailable).",
        }
    except Exception as e:
        return {
            "department": "Compliance Central",
            "confidence": 0.3,
            "justification": f"All routing methods failed. Defaulted to Compliance Central. Error: {e}",
        }


async def route_map(title: str, description: str, keywords: List[str]) -> dict:
    """
    Routes a compliance MAP to the correct Canara Bank department.

    Strategy:
      1. LLM is the primary router — receives full department descriptions so it can
         reason properly about which team owns the obligation.
      2. Output department name is normalized against the canonical list so the
         backend DB lookup always succeeds.
      3. ChromaDB is used only as a fallback when the LLM call fails.
    """
    from langchain_openai import ChatOpenAI

    keyword_str = ", ".join(keywords) if keywords else "N/A"

    user_message = f"""Assign the compliance MAP below to exactly ONE department.

MAP TITLE: {title}
MAP DESCRIPTION: {description}
REGULATORY KEYWORDS: {keyword_str}

Return ONLY a valid JSON object — no markdown, no commentary:
{{
  "department": "<exact department name from the 13 listed>",
  "confidence": <float 0.0–1.0>,
  "justification": "<2–3 sentence professional reasoning>"
}}"""

    llm = ChatOpenAI(
        model=settings.MODEL_NAME,
        openai_api_base=settings.OPENAI_API_BASE,
        temperature=0.0,
        openai_api_key=settings.OPENAI_API_KEY,
    )

    try:
        response = await llm.ainvoke([
            {"role": "system", "content": _DEPARTMENT_ROUTING_GUIDE},
            {"role": "user", "content": user_message},
        ])
        content = response.content.strip()

        # Strip markdown fences if present
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            content = json_match.group(0)

        parsed = json.loads(content)

        # Normalize the department name against the canonical list
        raw_dept = parsed.get("department", "")
        parsed["department"] = _normalize_department(raw_dept)

        if raw_dept != parsed["department"]:
            print(f"[Routing Agent] Normalized '{raw_dept}' → '{parsed['department']}'")

        print(
            f"[Routing Agent] Assigned '{parsed['department']}' "
            f"(confidence: {parsed.get('confidence', 0):.0%}) for MAP: '{title[:50]}'"
        )
        return parsed

    except Exception as e:
        print(f"[Routing Agent Error] LLM routing failed: {e}. Falling back to ChromaDB...")
        return await _chroma_fallback(title, description, keywords)
