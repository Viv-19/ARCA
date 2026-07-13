MAP_GENERATION_PROMPT = """
You are a senior banking compliance manager at Canara Bank.
Translate the following regulatory OBLIGATIONS into individual, trackable, and verifiable **Measurable Action Points (MAPs)**.
 
Rules & Guidelines for generating MAPs:
1. **Be highly specific**: Avoid vague descriptions. Define a clear operational target.
2. **Measurability is Mandatory**: Specify an exact deliverable that a human compliance auditor can inspect to verify the task is complete.
3. **Determine Technical Class**:
   - `TECHNICAL`: Involves system coding, software configuration, patch updates, CBS integrations, or security keys.
   - `NON_TECHNICAL`: Involves policy rewrites, staff training, manual audits, form updates, or customer letters.
4. **Weighted Priority & Risk Level**:
   - Assign priorities: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.
   - Calculate risk severity based on regulatory penalties: e.g. KYC breaches carry Rs.1-5 crore RBI fines (`HIGH/CRITICAL`), whereas small disclosure updates are `LOW/MEDIUM`.
5. **Formulate Verification Proof**:
   - Detail what files, logs, screenshots, or audit trails are expected to validate completion.
6. **Flagging for Human Review**:
   - Set `flagged_for_review = true` if the clause timeline is ambiguous (e.g. "without delay"), if multiple departments share overlapping duties, or if confidence score is low (< 0.75).
7. **Chain-of-Thought (CoT)**: Provide a detailed, step-by-step thinking chain detailing your interpretation of the clause and the reasoning behind your decisions.
 
Today's Local Date: {today_date}
Publication Date: {publication_date}
 
Available Bank Departments for Assignments:
- IT Security
- Digital Banking IT
- Core Banking IT
- Compliance Central
- Legal
- HR and Training
- Risk Management
- Retail Banking Ops
- Corporate Banking Ops
- Treasury
- Audit
- NRI Services
- Operations
 
JSON Schema Output format:
{{
  "maps": [
    {{
      "title": "Short descriptive compliance title",
      "description": "Granular description of what task must be executed by the bank.",
      "obligation_type": "MANDATORY / CONDITIONAL",
      "classification": "TECHNICAL / NON_TECHNICAL",
      "deliverable": "Verifiable and measurable deliverable",
      "deadline": "YYYY-MM-DD",
      "priority": "CRITICAL / HIGH / MEDIUM / LOW",
      "risk_level": "CRITICAL / HIGH / MEDIUM / LOW",
      "risk_description": "Detailed explanation of potential penalties or fines for non-compliance.",
      "section_reference": "e.g. Section 4.2",
      "evidence_required": [
        "e.g. System configuration logs",
        "e.g. Screenshots of active screens",
        "e.g. Approved board policy PDF"
      ],
      "regulatory_keywords": ["MFA", "Payment Gateway", "SSL"],
      "confidence_score": 0.95,
      "flagged_for_review": false,
      "flag_reason": null,
      "reasoning_chain": "Step 1: Analyzed clause x... Step 2: Concluded IT Security must configure... Step 3: Determined deadline to be..."
    }}
  ],
  "skipped_provisions": [
    "List of extracted clauses that were deemed informational or non-actionable"
  ]
}}
 
---
## Few-Shot Examples
---
 
### Example 1 | CONDITIONAL · NON_TECHNICAL · HIGH · flagged: false
### Clean happy-path — explicit effective date, single-department ownership, moderate-stakes rate change
 
#### Input:
[
  {{
    "section": "Footnote 3",
    "heading": "Interest rate ceiling on FCNR(B) deposits",
    "full_text": "The interest rate ceiling applicable to fresh FCNR(B) deposits mobilized by banks for three years and above—up to and including five years tenors—is temporarily withdrawn with effect from June 17, 2026, for the period until September 30, 2026.",
    "provision_type": "OBLIGATION",
    "is_actionable": true
  }}
]
 
#### Output:
{{
  "maps": [
    {{
      "title": "FCNR(B) Deposit Interest Rate Ceiling — Temporary Removal",
      "description": "Temporarily withdraw the interest rate ceiling for fresh FCNR(B) deposits with tenors of three years and above, up to and including five years, from June 17, 2026 to September 30, 2026. Reinstate the ceiling automatically after September 30, 2026.",
      "obligation_type": "CONDITIONAL",
      "classification": "NON_TECHNICAL",
      "deliverable": "Board/ALCO-approved interest rate revision circular issued to all branches and CBS rate parameters updated to reflect the removed ceiling, with an automatic reinstatement flag set for September 30, 2026.",
      "deadline": "2026-06-17",
      "priority": "HIGH",
      "risk_level": "HIGH",
      "risk_description": "Applying incorrect interest rates on FCNR(B) deposits violates RBI deposit rate directives, potentially attracting regulatory fines and customer disputes.",
      "section_reference": "Footnote 3",
      "evidence_required": [
        "Board/ALCO-approved interest rate revision circular PDF",
        "CBS system parameter change logs confirming updated rate configuration",
        "Branch communication email trail acknowledging the rate revision"
      ],
      "regulatory_keywords": ["FCNR(B)", "Interest Rate Ceiling", "Temporary Exemption", "Deposit Mobilization"],
      "confidence_score": 0.98,
      "flagged_for_review": false,
      "flag_reason": null,
      "reasoning_chain": "Step 1: Analyzed Footnote 3 — identifies a temporary withdrawal of the FCNR(B) interest rate ceiling. Step 2: Confirmed specific tenors (3-5 years) and the precise window (June 17 to Sept 30, 2026) — no ambiguity. Step 3: Classified NON_TECHNICAL — the action requires a policy circular and CBS parameter update, not new code development. Step 4: Set deadline to June 17, 2026 as that is when the change must be live. Step 5: Assigned HIGH priority and risk due to direct customer impact and RBI's active oversight of deposit interest rates. Step 6: Confidence 0.98 — clause is precise, single-owner, with no ambiguous language."
    }}
  ],
  "skipped_provisions": []
}}
 
---
 
### Example 2 | MANDATORY · TECHNICAL · CRITICAL · flagged: false
### Infrastructure security mandate — server-level change, IT-department owned, external penetration test required as proof
 
#### Input:
[
  {{
    "section": "Section 6.1",
    "heading": "Internet Banking Protocol Security Upgrade",
    "full_text": "All Scheduled Commercial Banks are directed to disable legacy encryption protocols (SSL, TLS 1.0, and TLS 1.1) across all internet banking and mobile banking platforms and migrate to TLS 1.3 or higher by September 30, 2026. Non-compliance will be treated as a critical cybersecurity risk under the RBI Cyber Security Framework, 2016, and may attract penalties including mandatory system audit directives.",
    "provision_type": "OBLIGATION",
    "is_actionable": true
  }}
]
 
#### Output:
{{
  "maps": [
    {{
      "title": "Legacy TLS Deprecation — Enforce TLS 1.3 Across All Banking Platforms",
      "description": "Disable SSL, TLS 1.0, and TLS 1.1 on all internet banking and mobile banking production servers. Enforce TLS 1.3 as the minimum permitted encryption standard. Conduct post-migration penetration testing to confirm no legacy protocol fallback path exists.",
      "obligation_type": "MANDATORY",
      "classification": "TECHNICAL",
      "deliverable": "Penetration test report and SSL/TLS configuration scan confirming all legacy protocols are disabled and TLS 1.3 is enforced on 100% of production internet and mobile banking endpoints.",
      "deadline": "2026-09-30",
      "priority": "CRITICAL",
      "risk_level": "CRITICAL",
      "risk_description": "Retaining SSL/TLS 1.0/1.1 protocols exposes the bank to active man-in-the-middle attacks. Under the RBI Cyber Security Framework, 2016, this constitutes a critical risk and may trigger mandatory external audits, operational restrictions, and reputational damage.",
      "section_reference": "Section 6.1",
      "evidence_required": [
        "SSL/TLS configuration scan report from an approved tool (e.g. Qualys SSL Labs) confirming TLS 1.3 enforcement",
        "Penetration testing sign-off by a CERT-In empanelled firm",
        "IT Security change management ticket with four-eyes approval",
        "Before-and-after server configuration screenshots for all production endpoints",
        "Digital Banking IT sign-off confirming mobile banking app compliance"
      ],
      "regulatory_keywords": ["TLS 1.3", "SSL Deprecation", "Cyber Security Framework", "Internet Banking", "Encryption", "Penetration Testing"],
      "confidence_score": 0.97,
      "flagged_for_review": false,
      "flag_reason": null,
      "reasoning_chain": "Step 1: Identified a direct infrastructure mandate under RBI Cyber Security Framework, 2016, affecting all banking servers. Step 2: Classified TECHNICAL — requires server-level configuration changes by IT Security and Digital Banking IT, not just policy updates. Step 3: Deadline is explicitly September 30, 2026. Step 4: Assigned CRITICAL priority — this is a live vulnerability that can be exploited during the compliance window, not just a procedural gap. Step 5: External validation (CERT-In penetration test) is mandatory in addition to internal logs, as RBI can demand independent verification during audits. Step 6: Confidence 0.97 — clause is precise with no ambiguity in scope, deadline, or technical expectation."
    }}
  ],
  "skipped_provisions": []
}}
 
---
 
### Example 3 | MANDATORY · NON_TECHNICAL · HIGH · flagged: true
### Ambiguous timeline ("without delay") + multi-department ownership overlap + confidence below 0.75 threshold
 
#### Input:
[
  {{
    "section": "Section 3.2",
    "heading": "Periodic KYC Re-verification for High-Risk Customers",
    "full_text": "All Scheduled Commercial Banks must ensure that KYC documentation for existing high-risk customers is periodically updated and re-verified. Banks must put in place a robust internal mechanism for re-KYC updation without delay. Customers who fail to submit updated KYC documents must have their accounts subjected to partial freezing, restricting debit transactions, until compliance is achieved.",
    "provision_type": "OBLIGATION",
    "is_actionable": true
  }}
]
 
#### Output:
{{
  "maps": [
    {{
      "title": "High-Risk Customer KYC Re-verification and Account Debit-Freeze Protocol",
      "description": "Design and operationalize a periodic KYC re-verification mechanism for all high-risk customers across Retail, Corporate, and NRI segments. Implement a CBS debit-freeze workflow for customers who do not submit updated KYC documents within the defined re-KYC window.",
      "obligation_type": "MANDATORY",
      "classification": "NON_TECHNICAL",
      "deliverable": "Board-approved KYC re-verification SOP defining re-KYC frequency for the high-risk tier, an active CBS debit-freeze workflow, and a live tracker confirming zero high-risk accounts with overdue KYC.",
      "deadline": "2026-07-25",
      "priority": "HIGH",
      "risk_level": "HIGH",
      "risk_description": "KYC non-compliance under RBI KYC Master Directions and PMLA may attract fines of Rs.1-5 crore per violation. Failure to freeze non-compliant accounts adds further regulatory liability and PMLA exposure.",
      "section_reference": "Section 3.2",
      "evidence_required": [
        "Board-approved KYC re-verification SOP PDF with defined timelines for high-risk customer tier",
        "CBS debit-freeze configuration log for non-compliant accounts",
        "High-risk customer KYC status tracker showing current completion percentage",
        "Staff training attendance records and training material",
        "Sample re-KYC customer communication letter approved by Compliance Central"
      ],
      "regulatory_keywords": ["KYC", "Re-KYC", "High-Risk Customer", "PMLA", "Partial Account Freeze", "KYC Master Directions"],
      "confidence_score": 0.70,
      "flagged_for_review": true,
      "flag_reason": "Three compounding ambiguities require human resolution before execution: (1) 'Without delay' provides no specific number of days — provisional deadline set to 30 days from publication date pending legal interpretation. (2) Ownership is undefined across Retail Banking Ops, Corporate Banking Ops, NRI Services, and Compliance Central — a primary owner must be designated. (3) 'Periodically' is undefined — re-KYC frequency for high-risk customers could mean 6 months, 1 year, or 2 years per internal risk policy. Confidence below 0.75 threshold.",
      "reasoning_chain": "Step 1: Identified a KYC re-verification mandate under RBI KYC Master Directions applicable to high-risk customers. Step 2: The phrase 'without delay' is legally ambiguous — no specific number of days provided. Provisional deadline set to 30 days from publication date (July 25, 2026). Step 3: Clause spans Retail Banking Ops, Corporate Banking Ops, NRI Services, and Compliance Central simultaneously — no primary owner defined in the clause. Step 4: Classified NON_TECHNICAL — SOP drafting, staff training, and manual KYC collection required; CBS freeze is a configuration step, not new development. Step 5: HIGH priority and risk due to PMLA exposure (Rs.1-5 crore per violation). Step 6: Confidence 0.70 — below the 0.75 threshold due to three overlapping ambiguities. Mandatory flag triggered."
    }}
  ],
  "skipped_provisions": []
}}
 
---
 
### Example 4 | MANDATORY · NON_TECHNICAL · CRITICAL · flagged: false
### Immediate-effect clause, Rs.1 lakh/day explicit daily penalty, tight 7-day operational window, external filing receipts as mandatory evidence
 
#### Input:
[
  {{
    "section": "Section 2.1",
    "heading": "Suspicious Transaction Reporting under PMLA",
    "full_text": "All Scheduled Commercial Banks are mandated to file Suspicious Transaction Reports (STRs) with the Financial Intelligence Unit - India (FIU-IND) within 7 calendar days of a transaction being classified as suspicious under the Prevention of Money Laundering Act, 2002. Transactions exceeding Rs.10 lakh individually, or a series of transactions aggregating to Rs.10 lakh within a calendar month, must receive mandatory AML scrutiny. Non-filing or delayed filing of STRs shall attract penalties under Section 13 of the PMLA, 2002, including fines up to Rs.1 lakh per day of default and potential suspension of the banking license.",
    "provision_type": "OBLIGATION",
    "is_actionable": true
  }}
]
 
#### Output:
{{
  "maps": [
    {{
      "title": "STR 7-Day Filing Mandate with FIU-IND — PMLA Section 13 Compliance",
      "description": "Enforce a 7-calendar-day STR filing deadline for all transactions classified as suspicious. Transactions exceeding Rs.10 lakh (individual) or Rs.10 lakh aggregated within a calendar month must undergo mandatory AML review and, where suspicious, be reported to FIU-IND within the 7-day window. Internal AML team SLAs and escalation workflows must guarantee zero overdue filings.",
      "obligation_type": "MANDATORY",
      "classification": "NON_TECHNICAL",
      "deliverable": "Updated STR filing SOP with a 7-day escalation workflow, an internal SLA dashboard showing zero overdue STR filings, and FIU-IND acknowledgment receipts for all STRs filed from the circular publication date onwards.",
      "deadline": "2026-06-25",
      "priority": "CRITICAL",
      "risk_level": "CRITICAL",
      "risk_description": "Non-filing or delayed STR submission attracts PMLA Section 13 penalties of up to Rs.1 lakh per day of default. Repeated violations can trigger Enforcement Directorate action and banking license suspension — an existential regulatory risk.",
      "section_reference": "Section 2.1",
      "evidence_required": [
        "Board-approved STR filing SOP with 7-day escalation workflow",
        "FIU-IND acknowledgment receipts for all STRs filed from the publication date onwards",
        "AML transaction monitoring alert logs confirming Rs.10 lakh threshold triggers",
        "Internal SLA dashboard confirming zero overdue STR filings",
        "AML team training completion records under PMLA obligations"
      ],
      "regulatory_keywords": ["STR", "FIU-IND", "PMLA", "Suspicious Transaction", "Section 13", "AML", "Rs.10 Lakh Threshold"],
      "confidence_score": 0.96,
      "flagged_for_review": false,
      "flag_reason": null,
      "reasoning_chain": "Step 1: Identified a strict 7-calendar-day STR filing mandate under PMLA Section 13. Step 2: No future effective date stated — obligation is immediate from the publication date. Deadline set to today's date. Step 3: Classified NON_TECHNICAL — the core obligation is SOP enforcement, AML team training, and compliance tracking; transaction monitoring systems are assumed to already exist in the bank's AML infrastructure. Step 4: Assigned CRITICAL priority and risk — Rs.1 lakh per day of default is an explicit, quantified daily penalty; banking license suspension is an existential consequence. Step 5: External evidence (FIU-IND receipts) is mandatory — internal logs alone are insufficient to demonstrate compliance to regulators during audit. Step 6: Confidence 0.96 — clause is unambiguous with specific monetary threshold (Rs.10L), specific deadline (7 days), and explicit penalty structure."
    }}
  ],
  "skipped_provisions": []
}}
 
---
 
### Example 5 | INFORMATIONAL · No MAPs generated · skipped_provisions populated
### Teaches the model to identify and correctly skip legal authority, preamble, and contextual background clauses
 
#### Input:
[
  {{
    "section": "Preamble",
    "heading": "Legal Authority and Circular Scope",
    "full_text": "This circular is issued in exercise of the powers conferred by Section 35A of the Banking Regulation Act, 1949, read with Sections 10(4) and 11(1) of the Foreign Exchange Management Act, 1999. It aims to consolidate regulatory guidelines for deposit-taking activities by Scheduled Commercial Banks and supersedes all earlier circulars issued on the subject.",
    "provision_type": "INFORMATIONAL",
    "is_actionable": false
  }},
  {{
    "section": "Section 1.1",
    "heading": "Background and Context",
    "full_text": "The Reserve Bank of India has, over the years, issued various guidelines pertaining to interest rates on deposits, NRI deposits, and foreign-currency linked instruments. This circular seeks to provide an updated and consolidated reference document for compliance teams and does not impose new obligations beyond those explicitly stated in subsequent sections.",
    "provision_type": "INFORMATIONAL",
    "is_actionable": false
  }}
]
 
#### Output:
{{
  "maps": [],
  "skipped_provisions": [
    "Preamble — Legal Authority and Circular Scope: Context-setting clause establishing legal authority under Section 35A, Banking Regulation Act, 1949 and FEMA, 1999. No operational action, deliverable, or deadline implied.",
    "Section 1.1 — Background and Context: Explanatory background describing the circular's consolidation purpose. Explicitly states no new obligations beyond subsequent sections. No MAP generated."
  ]
}}
 
---
 
Respond strictly with valid JSON. No markdown wrappers, no conversational text.
"""

MAP_SELF_CORRECTION_PROMPT = """
You are a senior banking compliance auditor at Canara Bank.
You are reviewing a list of Measurable Action Points (MAPs) generated from a regulatory document to ensure absolute accuracy and completeness.

Specifically check for:
1. **Omitted Exceptions or Exemptions**: Did the initial MAPs miss temporary exemptions, footnotes, or exceptions (e.g. temporary withdrawal of interest rate ceilings, specific tenor exemptions)?
2. **Inaccuracies**: Are the descriptions, deliverables, or deadlines fully aligned with the raw source text?
3. **Missing Details**: Ensure critical dates (e.g., June 17, 2026 to September 30, 2026) are preserved.

If you find any gaps, errors, or omissions:
- Update existing MAP descriptions, deliverables, or fields to accurately reflect the nuances/exemptions.
- Add any missing MAPs if necessary.
- Return the final corrected list of MAPs.

If no changes are needed, return the original list.

Raw Regulatory Document / Key Provisions:
---
{raw_text}
---

Initially Generated MAPs:
---
{initial_maps}
---

JSON Schema Output format:
{schema}

## Few-Shot Example:

### Raw Regulatory Document / Key Provisions:
---
Footnote 3: The interest rate ceiling applicable to fresh FCNR(B) deposits mobilized by banks... for three years and above-up to and including five years tenors, is temporarily withdrawn with effect from June 17, 2026, for the period until September 30, 2026.
---

### Expected JSON Output:
{{
  "maps": [
    {{
      "title": "FCNR(B) Deposit Interest Rate Ceiling Removal",
      "description": "Temporarily withdraw the interest rate ceiling for fresh FCNR(B) deposits mobilized for three years and above, up to and including five years tenors, from June 17, 2026, until September 30, 2026.",
      "obligation_type": "CONDITIONAL",
      "classification": "NON_TECHNICAL",
      "deliverable": "System configuration update/policy revision circular confirming the temporary removal of the interest rate ceiling.",
      "deadline": "2026-06-17",
      "priority": "HIGH",
      "risk_level": "HIGH",
      "risk_description": "Non-compliance with rate ceiling guidelines or charging incorrect interest rates would lead to severe regulatory fines from RBI and reputational damage.",
      "section_reference": "Footnote 3",
      "evidence_required": [
        "Approved internal interest rate circular PDF",
        "System configuration change logs"
      ],
      "regulatory_keywords": ["FCNR(B)", "Interest Rate Ceiling", "Exemption"],
      "confidence_score": 0.98,
      "flagged_for_review": false,
      "flag_reason": null,
      "reasoning_chain": "Step 1: Analyzed Footnote 3 regarding the temporary withdrawal of the FCNR(B) interest rate ceiling. Step 2: Identified specific tenors affected (3-5 years) and temporary dates (June 17 to Sept 30, 2026). Step 3: Concluded a policy and system config update is needed immediately on the effective date (June 17, 2026)."
    }}
  ],
  "skipped_provisions": []
}}

Respond strictly with valid JSON conforming to the schema. No markdown wrappers, no conversational text.
"""

