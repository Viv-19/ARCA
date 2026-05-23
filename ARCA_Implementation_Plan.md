# ARCA — Implementation Plan
## Step-by-Step Build Guide for Two Developers

---

> **You (AI Services)** → Works on `arca_ai_service/` — Python, FastAPI, LangChain, LangGraph, LangSmith
> **Ayush (Backend)** → Works on `arca_backend/` — Node.js, Express, Prisma, PostgreSQL
> **Frontend** → Both contribute when needed, basic React first, serious UI later

**How to read this doc:**
Each phase has a GOAL, then tasks split clearly into YOU and AYUSH.
Complete one phase fully before starting the next — never skip ahead.
At the end of each phase, both of you should be able to run your parts and they should talk to each other.

---

## Final Project Structure

```
arca/
├── arca_ai_service/             ← YOUR TERRITORY (Python)
│   ├── app/
│   │   ├── api/                 ← FastAPI route handlers
│   │   ├── agents/              ← All LangGraph agents
│   │   ├── core/                ← Config, DB connections, celery
│   │   ├── models/              ← SQLAlchemy DB models
│   │   ├── pipelines/           ← LangGraph workflow definitions
│   │   ├── prompts/             ← All LLM system prompts
│   │   ├── services/            ← Business logic (pdf, ocr, email)
│   │   ├── utils/               ← Helpers (hashing, text cleaning)
│   │   └── vectorstore/         ← ChromaDB client + collections
│   ├── data/
│   │   ├── chroma_db/           ← ChromaDB persistent storage
│   │   ├── raw/                 ← Downloaded PDFs from regulators
│   │   ├── processed/           ← Cleaned text after OCR/parsing
│   │   └── validation_scripts/  ← AI-generated validation scripts
│   ├── notebooks/               ← Jupyter notebooks for testing agents
│   ├── tests/
│   ├── .env
│   ├── requirements.txt
│   └── main.py
│
├── arca_backend/                ← AYUSH'S TERRITORY (Node.js)
│   ├── prisma/
│   │   └── schema.prisma        ← All database table definitions
│   ├── src/
│   │   ├── config/              ← DB config, env, constants
│   │   ├── controllers/         ← Route handler functions
│   │   ├── middlewares/         ← Auth, error handling, validation
│   │   ├── models/              ← Prisma model helpers
│   │   ├── routes/              ← Express route definitions
│   │   ├── services/            ← Business logic (Jira, email, auth)
│   │   ├── sockets/             ← WebSocket (Socket.io) handlers
│   │   ├── queues/              ← Bull queue for background jobs
│   │   ├── validators/          ← Request body validation (Zod/Joi)
│   │   └── utils/               ← Helpers
│   ├── uploads/                 ← Evidence files uploaded by departments
│   ├── tests/
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── arca_frontend/               ← BOTH (React + TypeScript, basic first)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/                 ← API call functions
│   │   └── types/
│   └── package.json
│
├── docker/
│   ├── docker-compose.yml       ← Runs everything together
│   ├── ai.Dockerfile
│   └── backend.Dockerfile
│
├── docs/
│   ├── api_contract.md          ← Shared API format both must follow
│   └── env_template.md          ← What env vars each service needs
│
└── README.md
```

---

---

# PHASE 0 — Project Setup
## Goal: Both of you have the project running locally. Nothing works yet, but the structure is in place and you can both start coding without blocking each other.

**Time estimate: Half a day**

---

### AYUSH — Backend Setup

**Task 1: Initialize the Node.js project**
```bash
mkdir arca_backend && cd arca_backend
npm init -y
npm install express prisma @prisma/client dotenv cors helmet
npm install -D nodemon jest supertest
```
Create the folder structure exactly as shown above.

**Task 2: Set up PostgreSQL with Prisma**
```bash
npx prisma init
```
In `prisma/schema.prisma`, create the FIRST VERSION of your schema — just 3 tables to start:
```prisma
model Document {
  id          String   @id @default(cuid())
  title       String
  regulator   String
  sourceHash  String   @unique
  status      String   @default("INGESTED")
  createdAt   DateTime @default(now())
  maps        Map[]
}

model Map {
  id         String   @id @default(cuid())
  documentId String
  title      String
  status     String   @default("PENDING_REVIEW")
  priority   String   @default("MEDIUM")
  department String?
  deadline   DateTime?
  createdAt  DateTime @default(now())
  document   Document @relation(fields: [documentId], references: [id])
}

model Department {
  id    String @id @default(cuid())
  name  String @unique
  email String
}
```
Run: `npx prisma migrate dev --name init`

**Task 3: Basic Express server**
```javascript
// server.js
const app = require('./src/app');
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
```

**Task 4: Health check endpoint**
```
GET /api/health  →  { status: "ok", service: "arca-backend" }
```

---

### YOU — AI Service Setup

**Task 1: Initialize Python project**
```bash
mkdir arca_ai_service && cd arca_ai_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn langchain langchain-openai langgraph
pip install chromadb sqlalchemy alembic python-dotenv celery redis
pip install PyMuPDF pdfplumber pytesseract pdf2image playwright
pip install beautifulsoup4 httpx langsmith pydantic
pip freeze > requirements.txt
```
Create the folder structure as shown above.

**Task 2: Basic FastAPI server**
```python
# main.py
from fastapi import FastAPI
app = FastAPI(title="ARCA AI Service", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "service": "arca-ai-service"}
```
Run: `uvicorn main:app --reload --port 8000`

**Task 3: Set up .env files**

AI Service `.env`:
```
OPENAI_API_KEY=your_key_here
LANGSMITH_API_KEY=your_key_here
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=arca-compliance
DATABASE_URL=postgresql://user:pass@localhost:5432/arca
REDIS_URL=redis://localhost:6379
BACKEND_URL=http://localhost:3001
CHROMA_PERSIST_PATH=./data/chroma_db
```

Backend `.env`:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/arca
AI_SERVICE_URL=http://localhost:8000
PORT=3001
JWT_SECRET=your_jwt_secret
JIRA_BASE_URL=https://your-jira.atlassian.net
JIRA_EMAIL=your_email
JIRA_API_TOKEN=your_token
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email
SMTP_PASS=your_app_password
```

**Task 4: Docker Compose**
```yaml
# docker/docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: arca
      POSTGRES_USER: arca_user
      POSTGRES_PASSWORD: arca_pass
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```
Run: `docker-compose up -d` — this starts the shared database and Redis.

---

### PHASE 0 DONE WHEN:
- [ ] `GET http://localhost:3001/api/health` returns `{ status: "ok" }`
- [ ] `GET http://localhost:8000/health` returns `{ status: "ok" }`
- [ ] PostgreSQL is running, Prisma migrations applied
- [ ] Both `.env` files are set up
- [ ] You can commit and push to shared repo without conflicts

---

---

# PHASE 1 — Document Ingestion
## Goal: The AI service can scrape RBI website, download PDFs, and extract text. The backend can store documents and serve them via API. A compliance officer can manually upload a PDF.

**Time estimate: 2–3 days**

---

### YOU — AI Service: Scraper + PDF Processing

**Task 1: Build the RBI scraper**

File: `app/services/scrapers/rbi_scraper.py`

What it does:
- Uses Playwright to open `https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx`
- Finds all circular links on the page
- For each circular: extracts title, URL, date
- Downloads the PDF to `data/raw/`
- Returns list of `{ title, url, date, local_path }`

```python
# Rough structure — you fill in the logic
from playwright.async_api import async_playwright
import hashlib, httpx, os

async def scrape_rbi_circulars(limit=10):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx")
        # Extract circular links here...
        await browser.close()
    return circulars
```

**Task 2: Document deduplication**

File: `app/utils/hash_utils.py`
```python
import hashlib

def compute_source_hash(regulator: str, title: str, date: str) -> str:
    content = f"{regulator}|{title}|{date}"
    return hashlib.sha256(content.encode()).hexdigest()

def compute_file_hash(file_path: str) -> str:
    with open(file_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()
```
Before saving a document, always check if this hash already exists.

**Task 3: PDF text extraction**

File: `app/services/pdf_processor.py`
```python
import fitz  # PyMuPDF

def extract_text_from_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    
    # If text is empty or very short, it's a scanned PDF
    if len(text.strip()) < 100:
        return extract_text_with_ocr(file_path)
    
    return clean_text(text)

def extract_text_with_ocr(file_path: str) -> str:
    # pdf2image → pytesseract
    from pdf2image import convert_from_path
    import pytesseract
    images = convert_from_path(file_path)
    text = ""
    for img in images:
        text += pytesseract.image_to_string(img)
    return clean_text(text)

def clean_text(text: str) -> str:
    # Remove repeated headers/footers, fix encoding
    import re
    text = re.sub(r'\n{3,}', '\n\n', text)  # collapse excess newlines
    return text.strip()
```

**Task 4: Celery scheduler for auto-scraping**

File: `app/core/celery_app.py`
```python
from celery import Celery
from celery.schedules import crontab

celery_app = Celery('arca', broker='redis://localhost:6379/0')

celery_app.conf.beat_schedule = {
    'scrape-rbi-every-6-hours': {
        'task': 'app.tasks.scraping.scrape_all_sources',
        'schedule': crontab(minute=0, hour='*/6'),
    },
}
```

File: `app/tasks/scraping.py`
```python
from app.core.celery_app import celery_app
from app.services.scrapers.rbi_scraper import scrape_rbi_circulars

@celery_app.task(name='app.tasks.scraping.scrape_all_sources')
def scrape_all_sources():
    # 1. Scrape RBI
    # 2. Check deduplication
    # 3. Download new PDFs
    # 4. Call backend API to save document record
    # 5. Trigger document processing pipeline
    pass
```

**Task 5: Manual upload processing endpoint**

File: `app/api/documents.py`
```python
from fastapi import APIRouter, UploadFile, File

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/process")
async def process_uploaded_document(
    file: UploadFile = File(...),
    regulator: str = "RBI",
    document_type: str = "circular"
):
    # Save file to data/raw/
    # Extract text
    # Return extracted text + metadata
    pass
```

**APIs YOU BUILD in Phase 1:**

| Method | URL | What it does |
|--------|-----|-------------|
| POST | `/api/documents/process` | Process an uploaded PDF, return extracted text |
| POST | `/api/scraper/trigger` | Manually trigger a scrape of all sources |
| GET | `/api/scraper/status` | Check if a scrape is running |

---

### AYUSH — Backend: Document Storage + Upload API

**Task 1: Expand Prisma schema**

Add these fields to `Document` model:
```prisma
model Document {
  id              String   @id @default(cuid())
  title           String
  regulator       String
  documentId      String?  // Official ID like RBI/2024/47
  documentType    String   // circular, master_direction, etc.
  publicationDate DateTime?
  sourceHash      String   @unique
  contentHash     String?  // Hash of PDF content
  pdfUrl          String?  // Original URL from regulator website
  localFilePath   String?  // Where PDF is stored
  extractedText   String?  // Full text after OCR/parsing
  status          String   @default("INGESTED")
  ingestionMethod String   @default("AUTO_SCRAPE") // AUTO_SCRAPE or MANUAL_UPLOAD
  uploadedBy      String?  // Officer ID if manually uploaded
  createdAt       DateTime @default(now())
  maps            Map[]
}
```
Run: `npx prisma migrate dev --name add_document_fields`

**Task 2: Document controller + routes**

File: `src/controllers/documentController.js`
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/documents — list all with filters
const getDocuments = async (req, res) => {
    const { regulator, status, limit = 20, page = 1 } = req.query;
    const where = {};
    if (regulator) where.regulator = regulator;
    if (status) where.status = status;
    
    const documents = await prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit)
    });
    res.json({ documents, page, limit });
};

// POST /api/documents — create document record (called by AI service after scraping)
const createDocument = async (req, res) => {
    const doc = await prisma.document.create({ data: req.body });
    res.status(201).json(doc);
};

// GET /api/documents/:id
const getDocumentById = async (req, res) => {
    const doc = await prisma.document.findUnique({ 
        where: { id: req.params.id },
        include: { maps: true }
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
};

module.exports = { getDocuments, createDocument, getDocumentById };
```

File: `src/routes/documents.js`
```javascript
const express = require('express');
const router = express.Router();
const { getDocuments, createDocument, getDocumentById } = require('../controllers/documentController');

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', getDocumentById);

module.exports = router;
```

**Task 3: File upload endpoint**

Install multer: `npm install multer`

This endpoint accepts the PDF from the compliance officer's browser, saves it, then calls the AI service to process it:
```javascript
// In documentController.js
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const upload = multer({ dest: 'uploads/documents/' });

const uploadDocument = async (req, res) => {
    const { file } = req;
    const { regulator, documentType, priorityFlag } = req.body;
    
    // Send to AI service for processing
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));
    formData.append('regulator', regulator || 'RBI');
    formData.append('document_type', documentType || 'circular');
    
    const aiResponse = await axios.post(
        `${process.env.AI_SERVICE_URL}/api/documents/process`,
        formData,
        { headers: formData.getHeaders() }
    );
    
    // Save document record to our database
    const doc = await prisma.document.create({
        data: {
            ...aiResponse.data,
            ingestionMethod: 'MANUAL_UPLOAD',
            uploadedBy: req.user?.id
        }
    });
    
    res.status(201).json(doc);
};
```

**Task 4: Department seed data**

File: `scripts/seed_departments.js`
```javascript
const departments = [
    { name: "IT Security",              email: "it-security@canarabank.com" },
    { name: "Digital Banking IT",       email: "digital-it@canarabank.com" },
    { name: "Core Banking IT",          email: "cbs-it@canarabank.com" },
    { name: "Compliance Central",       email: "compliance@canarabank.com" },
    { name: "Legal",                    email: "legal@canarabank.com" },
    { name: "HR and Training",          email: "hr@canarabank.com" },
    { name: "Risk Management",          email: "risk@canarabank.com" },
    { name: "Retail Banking Ops",       email: "retail@canarabank.com" },
    { name: "Corporate Banking Ops",    email: "corporate@canarabank.com" },
    { name: "Treasury",                 email: "treasury@canarabank.com" },
    { name: "Audit",                    email: "audit@canarabank.com" },
    { name: "NRI Services",             email: "nri@canarabank.com" },
    { name: "Operations",               email: "operations@canarabank.com" },
];
// Insert all departments into DB
```

**APIs AYUSH BUILDS in Phase 1:**

| Method | URL | What it does |
|--------|-----|-------------|
| GET | `/api/documents` | List documents (with filters) |
| GET | `/api/documents/:id` | Get one document |
| POST | `/api/documents` | Create document record (called by AI) |
| PUT | `/api/documents/:id/status` | Update document status |
| POST | `/api/documents/upload` | Officer uploads PDF (calls AI, stores result) |

---

### PHASE 1 DONE WHEN:
- [ ] RBI scraper can fetch circulars and download PDFs
- [ ] PDF text extraction works for both digital and scanned PDFs
- [ ] AI service can process a manually uploaded PDF and return structured text
- [ ] Backend stores document records in PostgreSQL
- [ ] You can POST to `/api/documents/upload` with a PDF and it gets processed
- [ ] `GET /api/documents` returns list of processed documents

---

---

# PHASE 2 — Document Understanding + MAP Generation
## Goal: The AI service can read a regulatory document and produce structured MAPs. This is the hardest and most important phase.

**Time estimate: 3–4 days**

---

### YOU — AI Service: Document Understanding + MAP Generation

**Task 1: Document Understanding Agent**

File: `app/agents/document_agent.py`

This agent takes the extracted text and calls GPT-4o to produce a structured analysis.

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from typing import List, Optional

# Define the exact output structure
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

# Load your system prompt from app/prompts/document_analysis.py
# Call GPT-4o with structured output mode
# Return DocumentAnalysis object
```

File: `app/prompts/document_analysis.py`
```python
DOCUMENT_ANALYSIS_PROMPT = """
You are a senior banking compliance expert at a major Indian bank.
Analyze the given regulatory document and extract structured information.

Rules:
- Extract EVERY provision, not just the major ones
- For deadlines, calculate the actual date (e.g. "within 90 days" + publication date)
- is_amendment = true only if the document explicitly modifies an existing rule
- executive_summary must be plain English, under 150 words
- regulatory_domain options: cybersecurity, kyc, capital_adequacy, lending, payments, aml, governance, reporting, other

Today's date: {today_date}
Document publication date: {publication_date}

Respond ONLY with JSON. No explanation.
"""
```

**Task 2: Inventory Check**

File: `app/agents/inventory_agent.py`

Before generating new MAPs, check if this regulation overlaps with existing ones:
```python
from app.vectorstore.chroma_client import get_regulations_collection

def check_inventory(document_analysis: dict) -> dict:
    collection = get_regulations_collection()
    
    # Search for similar regulations
    results = collection.query(
        query_texts=[document_analysis['executive_summary']],
        n_results=5
    )
    
    # Check if this is an amendment to an existing document
    if document_analysis['is_amendment']:
        # Find MAPs from the document being amended
        # Call backend API to get those MAPs
        existing_maps = get_maps_by_source_document(
            document_analysis['amends_document_id']
        )
        return {
            "result": "AMENDMENT",
            "affected_maps": existing_maps,
            "similar_docs": results
        }
    
    return {"result": "NEW", "affected_maps": [], "similar_docs": results}
```

**Task 3: ChromaDB setup**

File: `app/vectorstore/chroma_client.py`
```python
import chromadb

_client = None

def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path="./data/chroma_db")
    return _client

def get_regulations_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        "regulations_db",
        metadata={"hnsw:space": "cosine"}
    )

def get_maps_collection():
    return get_chroma_client().get_or_create_collection("maps_db")

def get_departments_collection():
    return get_chroma_client().get_or_create_collection("departments_db")

def add_regulation_embedding(document_id: str, text: str):
    collection = get_regulations_collection()
    collection.add(
        documents=[text],
        ids=[document_id]
    )
```

**Task 4: MAP Generation Agent — the most important piece**

File: `app/agents/map_generation_agent.py`
```python
from pydantic import BaseModel
from typing import List, Optional
from langchain_openai import ChatOpenAI

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
    skipped_provisions: List[str]  # provisions that are not actionable

def generate_maps(document_analysis: dict, publication_date: str) -> MAPGenerationResult:
    # Filter only actionable provisions
    actionable = [p for p in document_analysis['key_provisions'] if p['is_actionable']]
    
    # Call GPT-4o with chain-of-thought prompting
    # Return MAPGenerationResult
    pass
```

File: `app/prompts/map_generation.py`
```python
MAP_GENERATION_PROMPT = """
You are a senior banking compliance specialist at Canara Bank.

For each regulatory OBLIGATION in the document, generate a complete Measurable Action Point (MAP).

Chain of thought process for each obligation:
Step 1: Quote the exact provision text.
Step 2: What specific action does this require? Who must do it?
Step 3: Calculate the exact deadline date.
Step 4: What is TECHNICAL (software/system) vs NON_TECHNICAL (policy/docs)?
Step 5: What evidence would PROVE this was done?
Step 6: What is the penalty risk?
Step 7: Score your confidence (0-1) for deadline, department, deliverable.
Step 8: Generate the MAP JSON.

Available bank departments: IT Security, Digital Banking IT, Core Banking IT,
Compliance Central, Legal, HR and Training, Risk Management, Retail Banking Ops,
Corporate Banking Ops, Treasury, Audit, NRI Services, Operations

IMPORTANT:
- Each MAP must be specific, not vague
- Deliverable must be something you can verify
- If confidence < 0.75 on any field, set flagged_for_review = true
- Include your full reasoning_chain

Today: {today_date}
Publication date: {publication_date}

Respond ONLY with JSON.
"""
```

**Task 5: LangGraph Pipeline**

File: `app/pipelines/document_pipeline.py`
```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional

class PipelineState(TypedDict):
    document_id: str
    extracted_text: str
    publication_date: str
    analysis: Optional[dict]
    inventory_result: Optional[str]   # NEW, AMENDMENT, DUPLICATE
    generated_maps: Optional[List[dict]]
    errors: List[str]

def build_pipeline():
    workflow = StateGraph(PipelineState)
    
    workflow.add_node("analyze", run_document_agent)
    workflow.add_node("check_inventory", run_inventory_agent)
    workflow.add_node("generate_maps", run_map_generation_agent)
    workflow.add_node("save_maps", save_maps_to_backend)
    
    workflow.set_entry_point("analyze")
    workflow.add_edge("analyze", "check_inventory")
    workflow.add_conditional_edges(
        "check_inventory",
        lambda s: s["inventory_result"],
        {"DUPLICATE": END, "AMENDMENT": "generate_maps", "NEW": "generate_maps"}
    )
    workflow.add_edge("generate_maps", "save_maps")
    workflow.add_edge("save_maps", END)
    
    return workflow.compile()
```

**Task 6: LangSmith tracing setup**

Add to `app/core/config.py`:
```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "arca-compliance"
# This automatically traces every LangChain call to LangSmith
# You can see every agent's input/output/token usage at smith.langchain.com
```

**APIs YOU BUILD in Phase 2:**

| Method | URL | What it does |
|--------|-----|-------------|
| POST | `/api/pipeline/run` | Run full pipeline on a document ID |
| GET | `/api/pipeline/status/:job_id` | Check pipeline progress |
| POST | `/api/maps/generate` | Generate MAPs for a document (called internally by pipeline) |

---

### AYUSH — Backend: MAP Storage + Review API

**Task 1: Expand MAP schema in Prisma**

```prisma
model Map {
  id                String    @id @default(cuid())
  mapCode           String    @unique  // MAP-RBI-2024-0047-003
  version           Int       @default(1)

  // Source info
  documentId        String
  sectionReference  String?
  rawTextExcerpt    String?

  // Obligation
  title             String
  description       String
  obligationType    String    // MANDATORY, CONDITIONAL
  classification    String    // TECHNICAL, NON_TECHNICAL
  regulatoryKeywords String[] // array of strings

  // Action
  deliverable       String
  deadline          DateTime?
  priority          String    @default("MEDIUM")  // CRITICAL, HIGH, MEDIUM, LOW
  riskLevel         String    @default("MEDIUM")
  riskDescription   String?
  evidenceRequired  String[]  // what proof is needed

  // Assignment
  departmentId      String?
  assignedTo        String?
  jiraTicketId      String?

  // Validation
  autoValidationResult  String?    // PASSED, FAILED, PARTIALLY_COMPLIANT, NEEDS_REVIEW
  autoValidationReason  String?
  officerOverride       String?
  finalVerdict          String?

  // AI metadata
  confidenceScore   Float?
  flaggedForReview  Boolean   @default(false)
  flagReason        String?
  reasoningChain    String?
  modelUsed         String?

  // Lifecycle
  status            String    @default("PENDING_REVIEW")
  approvedBy        String?
  approvedAt        DateTime?
  dispatchedAt      DateTime?
  closedAt          DateTime?

  // Relations
  createdAt         DateTime  @default(now())
  document          Document  @relation(fields: [documentId], references: [id])
  department        Department? @relation(fields: [departmentId], references: [id])
  evidenceFiles     Evidence[]
  auditLogs         AuditLog[]
}

model AuditLog {
  id               String   @id @default(cuid())
  mapId            String?
  documentId       String?
  eventType        String
  actor            String   // "system:agent" or "user:officer_id"
  description      String
  inputData        Json?
  outputData       Json?
  reasoning        String?
  contentHash      String
  previousHash     String?
  createdAt        DateTime @default(now())
  map              Map?     @relation(fields: [mapId], references: [id])
}
```
Run: `npx prisma migrate dev --name add_map_fields`

**Task 2: MAP CRUD controller**

File: `src/controllers/mapController.js`

Key functions to build:
```javascript
// GET /api/maps — list MAPs with filters
const getMaps = async (req, res) => {
    // Filter by: status, department, priority, regulator
    // Sort by: deadline ASC, priority DESC
    // Pagination
};

// GET /api/maps/pending-review — maps waiting for officer approval
const getPendingReview = async (req, res) => {
    const maps = await prisma.map.findMany({
        where: { status: 'PENDING_REVIEW' },
        orderBy: [
            { flaggedForReview: 'desc' },  // flagged ones first
            { priority: 'desc' },
            { deadline: 'asc' }
        ],
        include: { document: true, department: true }
    });
    res.json(maps);
};

// PUT /api/maps/:id/approve — officer approves MAP
const approveMap = async (req, res) => {
    const { approvedBy, notes } = req.body;
    const map = await prisma.map.update({
        where: { id: req.params.id },
        data: {
            status: 'APPROVED',
            approvedBy,
            approvedAt: new Date()
        }
    });
    // Log to audit trail
    await createAuditLog({
        mapId: map.id,
        eventType: 'MAP_APPROVED',
        actor: `user:${approvedBy}`,
        description: `MAP approved by officer. Notes: ${notes || 'none'}`
    });
    // Emit socket event to frontend
    req.io.emit('map:approved', { mapId: map.id });
    res.json(map);
};

// PUT /api/maps/:id/edit — officer edits then approves
const editAndApproveMap = async (req, res) => {
    const { fieldsToUpdate, editReason, editedBy } = req.body;
    const map = await prisma.map.update({
        where: { id: req.params.id },
        data: { ...fieldsToUpdate, status: 'APPROVED', approvedBy: editedBy, approvedAt: new Date() }
    });
    // Log the edit for self-improvement feedback loop
    await createAuditLog({
        mapId: map.id,
        eventType: 'MAP_EDITED',
        actor: `user:${editedBy}`,
        description: editReason,
        inputData: req.body.originalValues,
        outputData: fieldsToUpdate
    });
    res.json(map);
};

// PUT /api/maps/:id/reject
const rejectMap = async (req, res) => { ... };
```

**Task 3: Bulk approve API**
```javascript
// POST /api/maps/approve-bulk
const bulkApprove = async (req, res) => {
    const { mapIds, approvedBy } = req.body;
    await prisma.map.updateMany({
        where: { id: { in: mapIds } },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() }
    });
    res.json({ approved: mapIds.length });
};
```

**APIs AYUSH BUILDS in Phase 2:**

| Method | URL | What it does |
|--------|-----|-------------|
| GET | `/api/maps` | List MAPs with filters |
| GET | `/api/maps/:id` | Get full MAP details |
| POST | `/api/maps` | Save new MAPs (called by AI after generation) |
| GET | `/api/maps/pending-review` | Get all MAPs needing officer approval |
| PUT | `/api/maps/:id/approve` | Officer approves MAP |
| PUT | `/api/maps/:id/edit` | Officer edits + approves MAP |
| PUT | `/api/maps/:id/reject` | Officer rejects MAP |
| POST | `/api/maps/approve-bulk` | Approve multiple MAPs at once |

---

### PHASE 2 DONE WHEN:
- [ ] AI service can take a real RBI circular PDF and produce a list of MAPs
- [ ] MAPs have proper fields: title, description, deadline, classification, confidence, reasoning
- [ ] MAPs are saved to PostgreSQL via backend API
- [ ] Compliance officer can call `GET /api/maps/pending-review` and see generated MAPs
- [ ] Officer can approve/reject/edit a MAP via API
- [ ] LangSmith shows traces of every LLM call
- [ ] Test with at least 2 real RBI circulars end-to-end

---

---

# PHASE 3 — Routing: Jira + Email Notifications
## Goal: When a MAP is approved, it automatically gets assigned to the right department. Technical MAPs create Jira tickets. All MAPs send email notifications. Departments can see their tasks.

**Time estimate: 2–3 days**

---

### YOU — AI Service: Smart Routing with RAG

**Task 1: Department knowledge base in ChromaDB**

File: `app/services/department_knowledge_base.py`

Load each department's profile as a vector embedding:
```python
DEPARTMENT_PROFILES = {
    "IT Security": "cybersecurity MFA encryption firewall SSL TLS API security vulnerability patch incident response access control authentication hardware security keys FIDO2",
    "Digital Banking IT": "mobile banking app NetBanking UPI digital channels online banking mobile app deployment APIs digital infrastructure",
    "Core Banking IT": "CBS core banking SWIFT interbank transactions settlement NEFT RTGS account systems",
    "Compliance Central": "KYC AML policy compliance reporting regulatory circular master direction governance",
    "Legal": "legal approval regulatory notices penalties court filings legal compliance",
    "HR and Training": "employee training awareness program HR compliance staff certification attendance",
    "Risk Management": "risk assessment capital adequacy Basel credit risk market risk operational risk",
    "Retail Banking Ops": "retail banking customer KYC account opening deposits loans interest rates",
    "Treasury": "treasury forex investments SWIFT government securities liquidity",
    "Audit": "audit report internal audit inspection compliance audit evidence",
}

def seed_department_embeddings():
    collection = get_departments_collection()
    for dept_name, profile_text in DEPARTMENT_PROFILES.items():
        collection.add(
            documents=[profile_text],
            ids=[dept_name],
            metadatas=[{"department": dept_name}]
        )
```

**Task 2: Routing Agent**

File: `app/agents/routing_agent.py`
```python
def route_map(map_obj: dict) -> dict:
    """
    Determines which department a MAP belongs to and why.
    Returns: { department, confidence, justification }
    """
    # Build search query from MAP keywords
    query = f"{map_obj['title']} {map_obj['description']} {' '.join(map_obj['regulatory_keywords'])}"
    
    # RAG: find most similar department profile
    collection = get_departments_collection()
    results = collection.query(query_texts=[query], n_results=3)
    
    top_department = results['ids'][0][0]
    confidence = 1 - results['distances'][0][0]  # convert distance to similarity
    
    # Also check correction history for similar past routings
    past_corrections = get_similar_routing_corrections(query)
    
    # LLM final decision with context
    routing_prompt = f"""
    MAP to route: {map_obj['title']}
    Description: {map_obj['description']}
    Keywords: {map_obj['regulatory_keywords']}
    
    Top match by similarity: {top_department} (confidence: {confidence:.2f})
    Past routing corrections for similar MAPs: {past_corrections}
    
    Confirm the routing or suggest a different department.
    Provide a plain-English justification for this routing decision.
    
    Respond with JSON: {{ "department": "...", "confidence": 0.0-1.0, "justification": "..." }}
    """
    
    # Call LLM and return routing decision
    ...
```

**Task 3: Routing trigger endpoint**

File: `app/api/routing.py`
```python
@router.post("/api/routing/route-map/{map_id}")
async def route_single_map(map_id: str):
    # Called by backend when a MAP is approved
    # 1. Fetch MAP details from backend
    # 2. Run routing agent
    # 3. Return: { department, confidence, justification }
    pass
```

**APIs YOU BUILD in Phase 3:**

| Method | URL | What it does |
|--------|-----|-------------|
| POST | `/api/routing/route-map/:map_id` | Route a MAP to the right department |
| POST | `/api/routing/classify` | Classify MAP as TECHNICAL or NON_TECHNICAL |

---

### AYUSH — Backend: Dispatch (Jira + Email)

**Task 1: Install integrations**
```bash
npm install nodemailer axios
```

**Task 2: Jira integration service**

File: `src/services/jiraService.js`
```javascript
const axios = require('axios');

const jiraClient = axios.create({
    baseURL: process.env.JIRA_BASE_URL,
    auth: {
        username: process.env.JIRA_EMAIL,
        password: process.env.JIRA_API_TOKEN
    }
});

const DEPARTMENT_JIRA_MAP = {
    "IT Security":       { projectKey: "ITSEC",  lead: "it-security-lead" },
    "Digital Banking IT":{ projectKey: "DIGIIT", lead: "digital-it-lead" },
    "Core Banking IT":   { projectKey: "CBSIT",  lead: "cbs-lead" },
};

const PRIORITY_MAP = {
    "CRITICAL": "Highest",
    "HIGH": "High",
    "MEDIUM": "Medium",
    "LOW": "Low"
};

async function createComplianceTicket(map) {
    const jiraProject = DEPARTMENT_JIRA_MAP[map.department];
    if (!jiraProject) {
        console.log(`No Jira project for department: ${map.department}`);
        return null;
    }
    
    const ticketData = {
        fields: {
            project: { key: jiraProject.projectKey },
            summary: `[COMPLIANCE] ${map.mapCode} — ${map.title}`,
            description: buildJiraDescription(map),
            issuetype: { name: "Task" },
            priority: { name: PRIORITY_MAP[map.priority] || "Medium" },
            duedate: map.deadline?.toISOString().split('T')[0],
            labels: ["regulatory-compliance", "arca-auto", map.document?.regulator?.toLowerCase()]
        }
    };
    
    const response = await jiraClient.post('/rest/api/2/issue', ticketData);
    return response.data.id;
}

function buildJiraDescription(map) {
    return `
*REGULATORY COMPLIANCE REQUIREMENT*
----
Source: ${map.document?.regulator} — ${map.document?.title}
Section: ${map.sectionReference}
Published: ${map.document?.publicationDate}

*REQUIRED ACTION*
${map.description}

*COMPLIANCE DEADLINE:* ${map.deadline} (${getDaysRemaining(map.deadline)} days remaining)
*RISK:* ${map.riskDescription}

*EVIDENCE REQUIRED*
${map.evidenceRequired.map(e => `□ ${e}`).join('\n')}

Submit evidence: ${process.env.FRONTEND_URL}/maps/${map.id}/submit
ARCA MAP ID: ${map.mapCode}
    `.trim();
}

module.exports = { createComplianceTicket };
```

**Task 3: Email service**

File: `src/services/emailService.js`
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function sendMapAssignmentEmail(map, department) {
    const subject = `[ACTION REQUIRED] Compliance MAP ${map.mapCode} | ${map.priority} | Deadline: ${map.deadline?.toDateString()}`;
    
    const html = buildEmailTemplate(map, department);
    
    await transporter.sendMail({
        from: `"ARCA Compliance" <${process.env.SMTP_USER}>`,
        to: department.email,
        cc: 'compliance@canarabank.com',
        subject,
        html
    });
}

module.exports = { sendMapAssignmentEmail };
```

**Task 4: Dispatch controller — the central orchestrator**

File: `src/controllers/dispatchController.js`

This runs AFTER a MAP is approved:
```javascript
const { createComplianceTicket } = require('../services/jiraService');
const { sendMapAssignmentEmail } = require('../services/emailService');

const dispatchMap = async (req, res) => {
    const map = await prisma.map.findUnique({
        where: { id: req.params.id },
        include: { document: true, department: true }
    });
    
    // Step 1: Route the MAP (call AI service)
    const aiResponse = await axios.post(
        `${process.env.AI_SERVICE_URL}/api/routing/route-map/${map.id}`
    );
    const { department: deptName, justification } = aiResponse.data;
    
    // Step 2: Update MAP with department
    const dept = await prisma.department.findUnique({ where: { name: deptName } });
    await prisma.map.update({
        where: { id: map.id },
        data: { departmentId: dept.id, status: 'DISPATCHED', dispatchedAt: new Date() }
    });
    
    // Step 3: Create Jira ticket (if TECHNICAL)
    let jiraTicketId = null;
    if (map.classification === 'TECHNICAL') {
        jiraTicketId = await createComplianceTicket({ ...map, department: deptName });
        await prisma.map.update({ where: { id: map.id }, data: { jiraTicketId } });
    }
    
    // Step 4: Send email notification
    await sendMapAssignmentEmail({ ...map, jiraTicketId }, dept);
    
    // Step 5: Audit log
    await createAuditLog({
        mapId: map.id,
        eventType: 'MAP_DISPATCHED',
        actor: 'system:dispatch',
        description: `MAP dispatched to ${deptName}. Justification: ${justification}`,
    });
    
    res.json({ success: true, department: deptName, jiraTicketId });
};
```

**Task 5: Auto-dispatch after approval**

Modify the `approveMap` function to automatically call dispatch after approval:
```javascript
const approveMap = async (req, res) => {
    // ... (approve the map as before)
    
    // After approval, trigger dispatch automatically
    await dispatchMap(map.id);  // internal call
    
    res.json(map);
};
```

**APIs AYUSH BUILDS in Phase 3:**

| Method | URL | What it does |
|--------|-----|-------------|
| POST | `/api/maps/:id/dispatch` | Dispatch approved MAP (route + Jira + email) |
| GET | `/api/departments` | List all departments |
| GET | `/api/departments/:id` | Get department with its MAPs |
| GET | `/api/departments/:id/maps` | Get all MAPs for a department |

---

### PHASE 3 DONE WHEN:
- [ ] When a MAP is approved, it automatically gets routed to the right department
- [ ] Technical MAPs create a Jira ticket (test in Jira sandbox)
- [ ] Email is sent to the department with MAP details
- [ ] Routing justification is stored in the MAP record
- [ ] `GET /api/departments/IT Security/maps` returns all IT Security MAPs
- [ ] Audit log records every dispatch event

---

---

# PHASE 4 — Evidence Upload + Autonomous Validation
## Goal: Departments can submit evidence. The AI validates it automatically. Compliance officer can override.

**Time estimate: 3 days**

---

### YOU — AI Service: Validation Agent + Script Generation

**Task 1: Validation Script Generator**

File: `app/agents/script_generator.py`

For technical MAPs, generate a Python validation script:
```python
SCRIPT_GENERATION_PROMPT = """
You are a security engineer. Generate a Python validation script for this compliance requirement:

Requirement: {map_title}
Description: {map_description}
Evidence required: {evidence_required}

The script must:
1. Test whether the requirement is actually implemented
2. Output: {{ "overall": "PASS/FAIL/INCONCLUSIVE", "checks": [...] }}
3. Be READ-ONLY (no writes, no deletes, no destructive operations)
4. Be executable with: python validate.py <target_url_or_host>
5. Include comments explaining each check

Respond with ONLY the Python code.
"""

def generate_validation_script(map_obj: dict) -> str:
    # Call LLM
    # Safety check: reject if script contains rm, DROP, DELETE, truncate
    # Return script as string
    pass

def save_validation_script(map_id: str, script_code: str) -> str:
    import os
    path = f"data/validation_scripts/{map_id}_validate.py"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(script_code)
    return path
```

**Task 2: Evidence Validation Agent**

File: `app/agents/validation_agent.py`

This runs the 4-level check:
```python
def validate_evidence(map_obj: dict, evidence_files: list) -> dict:
    result = {
        "level_1": check_submission_completeness(map_obj, evidence_files),
        "level_2": check_content_relevance(map_obj, evidence_files),
        "level_3": check_requirement_match(map_obj, evidence_files),
        "level_4": check_deadline_compliance(map_obj, evidence_files),
    }
    
    overall = determine_overall_verdict(result)
    reasoning = generate_reasoning(result, map_obj)
    feedback = generate_department_feedback(result, map_obj)
    
    return {
        "overall_result": overall,   # PASSED / FAILED / PARTIALLY_COMPLIANT / NEEDS_REVIEW
        "level_results": result,
        "reasoning": reasoning,
        "feedback_to_department": feedback,
        "requires_officer_review": overall == "NEEDS_REVIEW"
    }

def check_requirement_match(map_obj: dict, evidence_files: list) -> dict:
    """
    Level 3: LLM checks each specific requirement against evidence
    """
    deliverable = map_obj['deliverable']
    all_evidence_text = extract_text_from_all_files(evidence_files)
    
    prompt = f"""
    MAP requirement: {deliverable}
    Evidence submitted: {all_evidence_text[:4000]}
    
    For each specific sub-requirement in the deliverable, check if the evidence confirms it.
    List each requirement separately with: CONFIRMED / NOT_CONFIRMED / PARTIALLY_CONFIRMED
    Include the exact quote from evidence if CONFIRMED.
    
    Respond with JSON.
    """
    # Call LLM
    # Return structured result
    pass
```

**Task 3: Validation endpoint**

File: `app/api/validation.py`
```python
@router.post("/api/validation/validate/{map_id}")
async def validate_map_evidence(map_id: str):
    # 1. Get MAP details from backend API
    # 2. Get evidence files list from backend API
    # 3. Download evidence files
    # 4. Run 4-level validation
    # 5. Post result back to backend API
    # 6. Return result
    pass
```

**APIs YOU BUILD in Phase 4:**

| Method | URL | What it does |
|--------|-----|-------------|
| POST | `/api/validation/validate/:map_id` | Run full 4-level validation on evidence |
| GET | `/api/validation/script/:map_id` | Get/generate validation script for technical MAP |

---

### AYUSH — Backend: Evidence Handling + Validation Results

**Task 1: Evidence model in Prisma**

```prisma
model Evidence {
  id           String   @id @default(cuid())
  mapId        String
  fileName     String
  filePath     String
  fileSize     Int
  mimeType     String
  evidenceType String   // deployment_log, screenshot, report, policy_doc, attendance, other
  uploadedBy   String
  notes        String?
  createdAt    DateTime @default(now())
  map          Map      @relation(fields: [mapId], references: [id])
}
```
Run: `npx prisma migrate dev --name add_evidence`

**Task 2: Evidence upload endpoint**

```javascript
// POST /api/maps/:id/evidence — department uploads evidence files
const uploadEvidence = async (req, res) => {
    const { id: mapId } = req.params;
    const { evidenceType, notes } = req.body;
    const files = req.files;
    
    // Save each file to uploads/evidence/{mapId}/
    const savedFiles = [];
    for (const file of files) {
        const evidence = await prisma.evidence.create({
            data: {
                mapId,
                fileName: file.originalname,
                filePath: file.path,
                fileSize: file.size,
                mimeType: file.mimetype,
                evidenceType: evidenceType || 'other',
                uploadedBy: req.user.id,
                notes
            }
        });
        savedFiles.push(evidence);
    }
    
    // Update MAP status
    await prisma.map.update({
        where: { id: mapId },
        data: { status: 'EVIDENCE_SUBMITTED' }
    });
    
    // Trigger AI validation (call AI service)
    await triggerValidation(mapId);
    
    res.json({ uploaded: savedFiles.length, files: savedFiles });
};
```

**Task 3: Trigger validation + store result**

```javascript
const triggerValidation = async (mapId) => {
    // Call AI service
    const result = await axios.post(
        `${process.env.AI_SERVICE_URL}/api/validation/validate/${mapId}`
    );
    
    // Save result to MAP
    await prisma.map.update({
        where: { id: mapId },
        data: {
            status: 'VALIDATION_IN_PROGRESS',
            autoValidationResult: result.data.overall_result,
            autoValidationReason: result.data.reasoning,
        }
    });
    
    // If AI gives a clear verdict, update to final
    if (result.data.overall_result !== 'NEEDS_REVIEW') {
        await prisma.map.update({
            where: { id: mapId },
            data: {
                status: result.data.overall_result,
                finalVerdict: result.data.overall_result,
            }
        });
    }
    
    // Notify department of result via socket
    io.emit('validation:complete', { mapId, result: result.data.overall_result });
};
```

**Task 4: Officer override endpoint**

```javascript
// POST /api/maps/:id/override
const overrideValidation = async (req, res) => {
    const { overrideVerdict, overrideReason, officerId } = req.body;
    
    if (!overrideReason || overrideReason.trim() === '') {
        return res.status(400).json({ error: 'Override reason is required' });
    }
    
    const map = await prisma.map.update({
        where: { id: req.params.id },
        data: {
            officerOverride: overrideVerdict,
            finalVerdict: overrideVerdict,
            status: overrideVerdict === 'PASSED' ? 'PASSED' : overrideVerdict,
            closedAt: ['PASSED', 'PARTIALLY_COMPLIANT'].includes(overrideVerdict) ? new Date() : null
        }
    });
    
    await createAuditLog({
        mapId: map.id,
        eventType: 'VALIDATION_OVERRIDDEN',
        actor: `user:${officerId}`,
        description: overrideReason,
        inputData: { aiVerdict: map.autoValidationResult },
        outputData: { officerVerdict: overrideVerdict }
    });
    
    res.json(map);
};
```

**APIs AYUSH BUILDS in Phase 4:**

| Method | URL | What it does |
|--------|-----|-------------|
| POST | `/api/maps/:id/evidence` | Upload evidence files |
| GET | `/api/maps/:id/evidence` | List evidence for a MAP |
| GET | `/api/maps/:id/validation-result` | Get validation details |
| POST | `/api/maps/:id/override` | Officer overrides AI verdict |
| GET | `/api/maps/:id/validation-script` | Download AI validation script |

---

### PHASE 4 DONE WHEN:
- [ ] Department can upload evidence files via API
- [ ] AI service runs 4-level validation on submitted evidence
- [ ] Validation result (PASSED/FAILED/PARTIALLY_COMPLIANT/NEEDS_REVIEW) is stored
- [ ] Compliance officer can override the verdict with a mandatory reason
- [ ] Technical MAPs have a downloadable Python validation script
- [ ] Audit trail records every validation event

---

---

# PHASE 5 — Risk Scoring + Alerting + WebSockets
## Goal: The system proactively calculates compliance scores for each department and sends alerts for approaching deadlines. Real-time updates via WebSockets.

**Time estimate: 2 days**

---

### YOU — AI Service: Risk Scoring + Pattern Detection

**Task 1: Regulatory cluster detection**

File: `app/agents/risk_agent.py`
```python
def detect_regulatory_clusters():
    """
    Check if a regulator is publishing unusual number of circulars
    on the same topic — signals a major regulation is incoming.
    """
    from collections import defaultdict
    from datetime import datetime, timedelta
    
    cutoff = datetime.now() - timedelta(days=30)
    recent_docs = get_recent_documents(since=cutoff)
    
    cluster_counts = defaultdict(lambda: defaultdict(int))
    for doc in recent_docs:
        cluster_counts[doc['regulator']][doc['regulatory_domain']] += 1
    
    alerts = []
    for regulator, domains in cluster_counts.items():
        for domain, count in domains.items():
            if count >= 3:
                alerts.append({
                    "type": "REGULATORY_CLUSTER",
                    "regulator": regulator,
                    "domain": domain,
                    "count": count,
                    "message": f"{regulator} has published {count} documents on '{domain}' in 30 days. Major regulation may be incoming.",
                    "severity": "ADVISORY"
                })
    
    return alerts
```

**Task 2: Cross-MAP conflict detection**

```python
def detect_map_conflicts(new_map: dict, existing_maps: list) -> list:
    """
    Check if a new MAP conflicts with any existing active MAP.
    Example: MAP-A requires data storage in India, MAP-B requires AWS US-East.
    """
    conflicts = []
    for existing in existing_maps:
        if maps_conflict(new_map, existing):
            conflicts.append({
                "conflicting_map_id": existing['id'],
                "conflict_description": explain_conflict(new_map, existing)
            })
    return conflicts
```

**APIs YOU BUILD in Phase 5:**

| Method | URL | What it does |
|--------|-----|-------------|
| GET | `/api/risk/scores` | Get compliance scores for all departments |
| GET | `/api/risk/clusters` | Get detected regulatory clusters |

---

### AYUSH — Backend: Compliance Scoring + Alert System + WebSockets

**Task 1: Compliance score calculator**

File: `src/services/complianceScoreService.js`
```javascript
const PRIORITY_WEIGHTS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const REGULATOR_WEIGHTS = { RBI: 1.5, 'CERT-In': 1.3, SEBI: 1.2, OTHER: 1.0 };

const calculateDepartmentScore = async (departmentId) => {
    const maps = await prisma.map.findMany({
        where: {
            departmentId,
            status: { notIn: ['REJECTED', 'SUPERSEDED', 'PENDING_REVIEW'] }
        },
        include: { document: true }
    });
    
    let totalWeight = 0;
    let achievedWeight = 0;
    
    for (const map of maps) {
        const pw = PRIORITY_WEIGHTS[map.priority] || 2;
        const rw = REGULATOR_WEIGHTS[map.document?.regulator] || 1.0;
        const weight = pw * rw;
        totalWeight += weight;
        
        if (['PASSED', 'OVERRIDDEN_COMPLETE'].includes(map.finalVerdict)) {
            achievedWeight += weight;
        } else if (map.finalVerdict === 'PARTIALLY_COMPLIANT') {
            achievedWeight += weight * 0.5;
        }
        // Overdue MAPs get 0 credit
    }
    
    const score = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 100;
    
    return {
        departmentId,
        score,
        riskLevel: score < 70 ? 'HIGH' : score < 85 ? 'MEDIUM' : 'LOW',
        overdueCount: maps.filter(m => new Date(m.deadline) < new Date() && m.finalVerdict !== 'PASSED').length,
        atRiskCount: maps.filter(m => {
            const daysLeft = Math.ceil((new Date(m.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 14 && daysLeft > 0 && m.finalVerdict !== 'PASSED';
        }).length
    };
};
```

**Task 2: Alert engine**

File: `src/services/alertService.js`
```javascript
const checkAndCreateAlerts = async () => {
    const today = new Date();
    const activeMaps = await prisma.map.findMany({
        where: { status: { notIn: ['PASSED', 'FAILED', 'CLOSED', 'REJECTED'] } },
        include: { department: true }
    });
    
    for (const map of activeMaps) {
        if (!map.deadline) continue;
        const daysRemaining = Math.ceil((new Date(map.deadline) - today) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 0) {
            await createAlert(map, 'DEADLINE_MISSED', 'CRITICAL',
                `MAP ${map.mapCode} deadline has passed. Escalating to senior management.`);
            await prisma.map.update({ where: { id: map.id }, data: { status: 'ESCALATED' } });
        } else if (daysRemaining <= 3) {
            await createAlert(map, 'DEADLINE_APPROACHING_3', 'HIGH',
                `MAP ${map.mapCode} deadline in ${daysRemaining} days. Urgent action required.`);
        } else if (daysRemaining <= 7) {
            await createAlert(map, 'DEADLINE_APPROACHING_7', 'MEDIUM',
                `MAP ${map.mapCode} deadline in ${daysRemaining} days.`);
        }
    }
};

// Run this every hour
const schedule = require('node-cron');
schedule.schedule('0 * * * *', checkAndCreateAlerts);
```

**Task 3: WebSocket (Socket.io) setup**

Install: `npm install socket.io`

File: `src/sockets/index.js`
```javascript
const setupSockets = (io) => {
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        
        socket.on('join:dashboard', () => {
            socket.join('compliance-dashboard');
        });
        
        socket.on('join:department', (deptId) => {
            socket.join(`department:${deptId}`);
        });
        
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });
};

// Events emitted from controllers:
// io.to('compliance-dashboard').emit('map:approved', { mapId, mapCode })
// io.to('compliance-dashboard').emit('alert:new', alertData)
// io.to(`department:${deptId}`).emit('map:assigned', mapData)
// io.to('compliance-dashboard').emit('score:updated', { deptId, score })

module.exports = setupSockets;
```

**Task 4: Add Alert model to Prisma**

```prisma
model Alert {
  id          String   @id @default(cuid())
  mapId       String?
  alertType   String   // DEADLINE_MISSED, DEADLINE_APPROACHING_7, etc.
  severity    String   // CRITICAL, HIGH, MEDIUM, ADVISORY
  message     String
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

**APIs AYUSH BUILDS in Phase 5:**

| Method | URL | What it does |
|--------|-----|-------------|
| GET | `/api/risk/dashboard` | All department scores + summary |
| GET | `/api/alerts` | List active alerts |
| PUT | `/api/alerts/:id/read` | Mark alert as read |
| GET | `/api/audit-log` | Full audit trail |
| GET | `/api/audit-log/map/:id` | Audit trail for one MAP |

---

### PHASE 5 DONE WHEN:
- [ ] Department compliance scores are calculated correctly
- [ ] Alerts fire automatically when deadlines approach
- [ ] Overdue MAPs are automatically escalated
- [ ] WebSocket events fire when MAPs are approved, dispatched, validated
- [ ] Full audit trail is accessible via API
- [ ] Regulatory cluster detection works

---

---

# PHASE 6 — Basic Frontend + Full Integration Test
## Goal: A working browser UI that shows the compliance dashboard, MAP review screen, and evidence upload. Then run a full end-to-end test with a real RBI circular.

**Time estimate: 3–4 days**

---

### BOTH OF YOU — Basic Frontend

**Setup:**
```bash
cd arca_frontend
npx create-react-app . --template typescript
npm install axios react-query socket.io-client
```

**Page 1: Compliance Dashboard** (YOU build this — data from `/api/risk/dashboard`)
- Department score cards (score % + risk color: red/yellow/green)
- Active alerts panel
- Recent activity log

**Page 2: MAP Review Queue** (AYUSH builds this — data from `/api/maps/pending-review`)
- List of MAPs waiting for officer approval
- Each MAP shows: title, regulation source, confidence, deadline, department
- Approve / Edit / Reject buttons

**Page 3: Department View** (AYUSH builds this — data from `/api/departments/:id/maps`)
- All MAPs assigned to a department
- Kanban-style columns: DISPATCHED → IN_PROGRESS → EVIDENCE_SUBMITTED → VALIDATED
- Evidence upload form

**Page 4: MAP Detail** (YOU build this — data from `/api/maps/:id`)
- Full MAP details
- Chain-of-thought reasoning visible
- Validation result with level-by-level breakdown
- Audit trail timeline

---

### Full End-to-End Test (BOTH)

Run this complete flow:
1. Trigger scraper manually: `POST /api/scraper/trigger` — should fetch latest RBI circulars
2. Check documents: `GET /api/documents` — should show newly ingested circulars
3. Run pipeline on one document: `POST /api/pipeline/run` — should generate MAPs
4. Check pending MAPs: `GET /api/maps/pending-review` — should show generated MAPs
5. Approve a MAP: `PUT /api/maps/:id/approve` — should trigger routing
6. Check Jira: verify ticket was created (for technical MAP)
7. Check email: verify notification was sent
8. Upload evidence: `POST /api/maps/:id/evidence` — should trigger validation
9. Check validation result: `GET /api/maps/:id/validation-result`
10. Check audit trail: `GET /api/audit-log/map/:id` — should show every step

---

---

## Complete API Contract Reference

This is the master list. Both of you must use these exact URLs, methods, and response shapes.

### Documents API (AYUSH owns these endpoints)

| Method | URL | Owner | Phase |
|--------|-----|-------|-------|
| GET | `/api/documents` | Ayush | 1 |
| GET | `/api/documents/:id` | Ayush | 1 |
| POST | `/api/documents` | Ayush | 1 |
| PUT | `/api/documents/:id/status` | Ayush | 1 |
| POST | `/api/documents/upload` | Ayush | 1 |

### MAPs API (AYUSH owns these endpoints)

| Method | URL | Owner | Phase |
|--------|-----|-------|-------|
| GET | `/api/maps` | Ayush | 2 |
| GET | `/api/maps/:id` | Ayush | 2 |
| POST | `/api/maps` | Ayush | 2 |
| GET | `/api/maps/pending-review` | Ayush | 2 |
| PUT | `/api/maps/:id/approve` | Ayush | 2 |
| PUT | `/api/maps/:id/edit` | Ayush | 2 |
| PUT | `/api/maps/:id/reject` | Ayush | 2 |
| POST | `/api/maps/approve-bulk` | Ayush | 2 |
| POST | `/api/maps/:id/dispatch` | Ayush | 3 |
| POST | `/api/maps/:id/evidence` | Ayush | 4 |
| GET | `/api/maps/:id/evidence` | Ayush | 4 |
| GET | `/api/maps/:id/validation-result` | Ayush | 4 |
| POST | `/api/maps/:id/override` | Ayush | 4 |
| GET | `/api/maps/:id/validation-script` | Ayush | 4 |
| GET | `/api/maps/:id/audit-trail` | Ayush | 5 |

### Departments API (AYUSH owns these endpoints)

| Method | URL | Owner | Phase |
|--------|-----|-------|-------|
| GET | `/api/departments` | Ayush | 3 |
| GET | `/api/departments/:id` | Ayush | 3 |
| GET | `/api/departments/:id/maps` | Ayush | 3 |

### Risk & Alerts API (AYUSH owns these endpoints)

| Method | URL | Owner | Phase |
|--------|-----|-------|-------|
| GET | `/api/risk/dashboard` | Ayush | 5 |
| GET | `/api/alerts` | Ayush | 5 |
| PUT | `/api/alerts/:id/read` | Ayush | 5 |
| GET | `/api/audit-log` | Ayush | 5 |

### AI Service Internal APIs (YOU own these — called by Ayush's backend)

| Method | URL | Owner | Phase |
|--------|-----|-------|-------|
| POST | `/api/documents/process` | You | 1 |
| POST | `/api/scraper/trigger` | You | 1 |
| GET | `/api/scraper/status` | You | 1 |
| POST | `/api/pipeline/run` | You | 2 |
| GET | `/api/pipeline/status/:job_id` | You | 2 |
| POST | `/api/maps/generate` | You | 2 |
| POST | `/api/routing/route-map/:map_id` | You | 3 |
| POST | `/api/routing/classify` | You | 3 |
| POST | `/api/validation/validate/:map_id` | You | 4 |
| GET | `/api/validation/script/:map_id` | You | 4 |
| GET | `/api/risk/scores` | You | 5 |
| GET | `/api/risk/clusters` | You | 5 |

---

## Communication Rule Between AI Service and Backend

The AI service **never directly talks to the database**. All database reads and writes go through the backend APIs.

```
AI Service                    Backend
──────────                    ───────
1. Processes document    →    2. Calls POST /api/documents to store result
3. Generates MAPs        →    4. Calls POST /api/maps to store each MAP
5. Routes a MAP          →    6. Backend calls GET /api/routing/route-map/:id
7. Validates evidence    →    8. Backend calls POST /api/validation/validate/:id
                         ←    9. AI returns result, backend stores it
```

---

## Final Checklist — Knowing the MVP is Complete

| Feature | Works | Tested |
|---------|-------|--------|
| Auto-scrape RBI website | | |
| Manual PDF upload | | |
| Document text extraction (digital + OCR) | | |
| Document Understanding Agent (structured analysis) | | |
| Duplicate detection | | |
| Amendment detection + diff | | |
| MAP generation with chain-of-thought | | |
| Confidence scoring + flagging | | |
| Human-in-the-loop approval | | |
| Self-improving feedback storage | | |
| Intelligent routing (RAG-based) | | |
| Jira ticket creation | | |
| Email notification | | |
| Technical MAP validation scripts | | |
| 4-level evidence validation | | |
| Officer override | | |
| Compliance health scores | | |
| Deadline alerting | | |
| Regulatory cluster detection | | |
| Real-time WebSocket updates | | |
| Tamper-evident audit trail | | |
| Basic frontend dashboard | | |

---

*End of Implementation Plan v1.0*
*Built for ARCA — SuRaksha Hackathon, Canara Bank*
