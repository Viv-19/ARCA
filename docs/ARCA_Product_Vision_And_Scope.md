# ARCA Product Scope & Vision

## Product Vision

**ARCA (Autonomous Regulatory Compliance Agent)** is an AI-powered Regulatory Compliance Platform that helps commercial banks automatically identify, interpret, distribute, and verify compliance obligations arising from RBI regulations.

Rather than acting as a document management system, ARCA functions as an intelligent compliance operations platform that transforms regulatory circulars into measurable, trackable, and verifiable compliance actions across the bank.

## Mission

Reduce the manual effort required to interpret RBI regulations by automatically converting regulatory documents into operational tasks that can be assigned, monitored, and verified throughout the organization.

---

## Primary Target Users

ARCA is designed for commercial banks operating under the regulatory supervision of the Reserve Bank of India.

Examples include:
*   State Bank of India (SBI)
*   Punjab National Bank (PNB)
*   Bank of Baroda
*   Canara Bank
*   Union Bank of India
*   HDFC Bank
*   ICICI Bank
*   Axis Bank
*   Kotak Mahindra Bank
*   IndusInd Bank
*   IDBI Bank
*   Yes Bank

---

## Scope of Regulations

ARCA processes RBI regulations that create compliance obligations for one or more regulated business functions within a commercial bank.

The regulation may apply:
*   directly to commercial banks,
*   to all banks,
*   to scheduled commercial banks,
*   to authorised dealer category-I banks,
*   to regulated entities that include commercial banks.

**The determining factor is whether the regulation creates an actionable compliance obligation for the bank.**

### What ARCA Does NOT Process (Current Scope)
The following are outside the current product scope unless the bank itself operates these regulated businesses:
*   Regulations applicable exclusively to NBFCs
*   Rural Co-operative Banks (RCBs)
*   Urban Co-operative Banks (UCBs)
*   Primary Agricultural Credit Societies
*   Standalone Payment Aggregators & Gateways
*   Insurance Companies, Mutual Funds, Pension Funds
*   Stock Brokers & Market Infrastructure Institutions

*(Note: These regulations may be collected by the crawler but are explicitly filtered out and archived by the LLM-powered **Intake Pipeline**).*

---

## Business Functions Covered

ARCA supports compliance obligations across all major banking functions. In the system architecture, these are mapped to explicit operational profiles for semantic RAG routing.

### Compliance & Governance
*   Regulatory Compliance
*   Internal Compliance Monitoring
*   Regulatory Reporting
*   Corporate & Board Governance

### Information Technology
*   IT Governance
*   Information Security & Cyber Security
*   Core Banking Systems (CBS)
*   Digital Banking & Infrastructure
*   API & Cloud Security

### Banking Operations
*   Retail Banking & Corporate Banking
*   Branch & Deposit Operations
*   Customer Service & Loan Operations

### Treasury & Financial Markets
*   Treasury & Liquidity Management
*   Foreign Exchange (FEMA Compliance)
*   Investment Operations

### Risk Functions
*   Risk Management (Operational, Credit, Market Risk)
*   Capital Adequacy & Basel Compliance

### Regulatory Functions
*   KYC / AML / Customer Due Diligence
*   FATCA / CRS / Financial Crime Compliance

### Support Functions
*   Legal
*   Internal Audit
*   HR & Training
*   NRI Services

---

## Document & Obligation Types

### Types of RBI Documents Supported
ARCA can process:
*   Master Directions & Master Circulars
*   Circulars & Notifications
*   Amendment Directions
*   Operational Instructions & Guidelines
*   Regulatory Frameworks & Prudential Norms
*   Reporting Requirements

### Types of Compliance Obligations Extracted (MAPs)
ARCA extracts obligations such as:
1.  **Operational:** Submit reports, update operational procedures, revise internal processes, maintain records, conduct periodic reviews.
2.  **Technical:** Update system configuration, enable security controls, configure APIs, update CBS, modify reporting systems, patch infrastructure.
3.  **Governance:** Board approvals, committee reviews, policy updates, risk assessments, internal audits.
4.  **Documentation:** Issue internal circulars, update manuals, maintain registers, preserve audit trails.
5.  **Training:** Staff awareness, compliance training, certification, department communication.

---

## What ARCA Does (The Pipeline Lifecycle)

For every relevant RBI regulation, ARCA executes the following workflow:

### 1. Detects New Regulations
Continuously monitors RBI publications via the Playwright-powered **Collection Engine**.

### 2. Determines Applicability
The **Intake Pipeline** identifies which regulated entities are affected, whether commercial banks are in scope, and which business functions are impacted.

### 3. Understands the Regulation
Downloads the PDF and uses the **Docling Document Processing Engine** to extract raw text and complex financial tables.

### 4. Generates Measurable Action Points (MAPs)
The **MAP Generation Agent** transforms dense legal language into specific, measurable, auditable, department-ready tasks.

### 5. Routes Responsibilities
The **Routing Agent** assigns each MAP to the correct department (e.g., Treasury, IT Security, Legal) using semantic vector RAG matching.

### 6. Tracks Compliance
The React Dashboard monitors deadlines, progress, ownership, and completion status.

### 7. Verifies Evidence
The **Validation Agent** and **Script Generator Agent** validate submitted evidence through document analysis, log inspection, and automated technical sandbox validation.

---

## Decision Rule Summary

A regulation is considered relevant if it satisfies **both** conditions:
1.  It applies to a commercial bank (or a regulated role performed by a commercial bank, such as Authorised Dealer Category-I Bank).
2.  It creates at least one actionable compliance obligation for one or more business functions within the bank.

```text
If both conditions are true:
Relevant → Download PDF → Parse → Generate MAPs → Route → Track → Validate

Otherwise:
Not Relevant → Archive
```
