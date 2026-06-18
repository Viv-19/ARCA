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
   - Calculate risk severity based on regulatory penalties: e.g. KYC breaches carry ₹1-5 crore RBI fines (`HIGH/CRITICAL`), whereas small disclosure updates are `LOW/MEDIUM`.
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
      "deliverable": "Verifiable and measurable deliverable (e.g. System configuration confirmed via API inspection)",
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

## Few-Shot Example:

### Input (Key Provisions):
[
  {{
    "section": "Footnote 3",
    "heading": "Interest rate ceiling on FCNR(B) deposits",
    "full_text": "The interest rate ceiling applicable to fresh FCNR(B) deposits mobilized by banks... for three years and above-up to and including five years tenors, is temporarily withdrawn with effect from June 17, 2026, for the period until September 30, 2026.",
    "provision_type": "OBLIGATION",
    "is_actionable": true
  }}
]

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

