# ARCA Phase 1: Scraping & Compliance Identification
## Current Architecture & Status Report

Phase 1 of ARCA is fully responsible for discovering, filtering, acquiring, and parsing regulatory documents from the Reserve Bank of India. Its primary goal is to ensure that **only relevant** circulars are processed, saving compute power and reducing noise for the downstream agents.

---

### 1. The RBI Scraper (Collection Engine)
**Status: ✅ Completed**
*   **What it does:** Runs an automated web crawler using `Playwright` and `BeautifulSoup` against the RBI Notifications portal.
*   **How it works:** It extracts the Date, Circular Number, Title, and the direct PDF download URL.
*   **Deduplication:** It computes a unique SHA-256 hash based on the circular URL to ensure we never ingest the same circular twice.
*   **Persistence:** Newly discovered circulars are inserted into the SQLite `document_registry` with a status of `NEW`.

### 2. Intelligent Intake Pipeline (Applicability Identification)
**Status: ✅ Completed**
*   **What it does:** Acts as the AI gatekeeper. It determines if a circular is applicable to a **Commercial Bank** (ignoring NBFC-only, Primary Agricultural Societies, and Co-operative Bank circulars).
*   **How it works:**
    1.  **Metadata Classification:** First, it uses an LLM acting as a Senior Regulatory Analyst to evaluate the Title and Metadata.
    2.  **HTML Context Retrieval (Self-Correction):** If the LLM returns a LOW or MODERATE confidence score, the pipeline automatically spins up a scraper to read the detailed HTML page of the circular on the RBI website.
    3.  **Enhanced Re-evaluation:** The LLM re-evaluates the classification using the full HTML context to make a final, highly accurate decision.
*   **Outcome:** Circulars are marked as either `CLASSIFIED` (relevant) or `REJECTED` (not relevant).

### 3. The Download Manager (Acquisition)
**Status: ✅ Completed**
*   **What it does:** A deterministic (non-AI) infrastructure component responsible for securely acquiring the raw PDFs.
*   **How it works:** It queries the registry for all circulars marked as `CLASSIFIED` and executes asynchronous HTTP downloads.
*   **Storage:** Saves the raw PDFs to the `data/storage/raw/` directory and updates the registry status to `DOWNLOADED`.

### 4. Docling Processing Engine (Deep Parsing)
**Status: ✅ Completed & CPU-Optimized**
*   **What it does:** Translates the raw PDF into structured, canonical data for the downstream AI agents.
*   **How it works:** Uses the **IBM Docling 2.x API**.
    *   **Text Extraction:** Uses `PyPdfium2` for lightning-fast text extraction.
    *   **Table Structure Recognition:** Uses the AI `TableFormer` model to perfectly reconstruct complex financial grids, forex tables, and limits from the Annexures.
    *   **OCR:** Currently disabled to prioritize CPU speed, but can be enabled on-demand for scanned documents.
*   **Outcome:** Generates `document.json`, `document.md`, and `tables.json` in the `data/storage/processed/` directory. Updates the status to `PROCESSED`.

### 5. Frontend & UI Integration
**Status: ✅ Completed**
*   **What it does:** Provides the Compliance Officer with a real-time view of the ingestion pipeline.
*   **How it works:** The React Dashboard's **Circulars Widget** and **All Documents Modal** have been wired to read the live SQLite registry. It cleanly displays status pills (`NEW`, `CLASSIFIED`, `DOWNLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`) so users can watch the pipeline work in real-time.
