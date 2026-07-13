"""
ARCA-001 — RBI Collection Engine (Metadata Crawler)
====================================================

Pure metadata collection service for the RBI Circular Index.

This module is the FIRST stage of the ARCA ingestion pipeline.
It crawls the RBI Circular Index page and returns structured metadata objects.

Responsibilities:
  ✓ Fetch the RBI Circular Index HTML page
  ✓ Parse every circular row from the index table
  ✓ Extract and normalize metadata (circular number, title, date, department, etc.)
  ✓ Return a deterministic list of metadata dicts

Non-Responsibilities (handled by downstream stages):
  ✗ Downloading PDFs
  ✗ Visiting detail pages
  ✗ Parsing document contents
  ✗ Calling any LLM
  ✗ Deciding applicability or filtering circulars
  ✗ Classifying circulars by type

Pipeline Position:
  RBI Website → [Collection Engine] → Intake Agent → Download Manager → Document Parser
"""

import datetime
import logging
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Callable

import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

RBI_BASE_URL = "https://rbi.org.in/Scripts/"
RBI_INDEX_URL = "https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": RBI_INDEX_URL,
}

# HTTP Configuration
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [1.0, 3.0, 7.0]
REQUEST_TIMEOUT_SECONDS = 30.0

# Logger
logger = logging.getLogger("arca.collection_engine")


# ─────────────────────────────────────────────
# Data Model
# ─────────────────────────────────────────────

@dataclass
class CircularMetadata:
    """
    Structured metadata for a single RBI circular.
    This is a pure data object — no business logic, no side effects.
    """
    circular_number: str
    title: str
    publication_date: str          # ISO format: YYYY-MM-DD
    department: str
    meant_for: str
    detail_url: str

    def to_dict(self) -> dict:
        return asdict(self)


# ─────────────────────────────────────────────
# Date Normalizer
# ─────────────────────────────────────────────

# RBI uses multiple date formats across their pages.
# Known formats observed:
#   "17.6.2026"           → DD.M.YYYY
#   "17.06.2026"          → DD.MM.YYYY
#   "June 17, 2026"       → Month DD, YYYY
#   "17 June 2026"        → DD Month YYYY
#   "2026-06-17"          → Already ISO (passthrough)

DATE_FORMATS = [
    "%d.%m.%Y",       # 17.06.2026
    "%d.%m.%y",        # 17.06.26
    "%B %d, %Y",       # June 17, 2026
    "%d %B %Y",        # 17 June 2026
    "%b %d, %Y",       # Jun 17, 2026
    "%d %b %Y",        # 17 Jun 2026
    "%Y-%m-%d",        # 2026-06-17 (already ISO)
]


def normalize_date(raw_date: str) -> str:
    """
    Attempts to parse and normalize an RBI date string to ISO format (YYYY-MM-DD).
    
    The RBI website uses inconsistent date formatting. This function tries every
    known format before falling back to today's date. The fallback ensures the
    pipeline never crashes due to a date parsing edge case.
    
    Args:
        raw_date: Raw date string from the RBI webpage.
    
    Returns:
        ISO-formatted date string (YYYY-MM-DD).
    """
    cleaned = raw_date.strip()
    
    if not cleaned:
        logger.warning("[Date] Empty date string received. Falling back to today.")
        return datetime.date.today().isoformat()
    
    # Try each known format
    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.datetime.strptime(cleaned, fmt)
            return parsed.date().isoformat()
        except ValueError:
            continue
    
    # Handle the DD.M.YYYY case where month is single digit (e.g., "17.6.2026")
    # This is not handled by strptime directly because %m expects zero-padded months
    try:
        parts = cleaned.split(".")
        if len(parts) == 3:
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            if year < 100:
                year += 2000
            return datetime.date(year, month, day).isoformat()
    except (ValueError, IndexError):
        pass
    
    logger.warning(f"[Date] Could not parse date '{raw_date}'. Falling back to today.")
    return datetime.date.today().isoformat()


# ─────────────────────────────────────────────
# HTML Table Parser
# ─────────────────────────────────────────────

def _locate_circulars_table(soup: BeautifulSoup) -> Optional[object]:
    """
    Locates the circulars data table in the RBI index page HTML.
    
    The RBI page structure uses a <table class="tablebg"> to display circulars.
    If the primary selector fails (e.g., after a website redesign), a fallback
    strategy scans all tables for those containing <a class="link2"> elements,
    which are the known pattern for circular detail page links.
    
    Args:
        soup: Parsed BeautifulSoup object of the index page.
        
    Returns:
        The BeautifulSoup Tag object for the table, or None if not found.
    """
    # Primary selector
    table = soup.find("table", class_="tablebg")
    if table:
        return table
    
    # Fallback: scan all tables for those containing circular links
    logger.warning("[Parser] Primary table selector failed. Trying fallback scan...")
    for t in soup.find_all("table"):
        if t.find("a", class_="link2"):
            logger.info("[Parser] Fallback found a table with circular links.")
            return t
    
    return None


def _parse_circular_row(cells, row_index: int) -> Optional[CircularMetadata]:
    """
    Parses a single <tr> row from the circulars table into a CircularMetadata object.
    
    Expected cell structure (observed as of June 2026):
      Cell 0: Circular Number (contains <a class="link2"> with the detail page href)
      Cell 1: Date of Issue
      Cell 2: Department
      Cell 3: Subject / Title
      Cell 4: Meant For (may be empty)
    
    Args:
        cells: List of <td> elements from the row.
        row_index: The row's position in the table (for logging).
        
    Returns:
        A CircularMetadata object, or None if the row is malformed or a header row.
    """
    if len(cells) < 4:
        return None  # Header row or malformed row
    
    # Cell 0: Circular Number + detail page link
    link_tag = cells[0].find("a", class_="link2")
    if not link_tag:
        # Try fallback: any anchor tag in the first cell
        link_tag = cells[0].find("a", href=True)
        if not link_tag:
            return None
    
    circular_number = link_tag.get_text(separator=" ").strip()
    detail_href = link_tag.get("href", "")
    
    if not circular_number or not detail_href:
        logger.debug(f"[Parser] Row {row_index}: Empty circular number or href. Skipping.")
        return None
    
    # Cell 1: Publication Date
    raw_date = cells[1].get_text().strip()
    publication_date = normalize_date(raw_date)
    
    # Cell 2: Department
    department = cells[2].get_text().strip()
    
    # Cell 3: Subject / Title
    title = cells[3].get_text().strip()
    
    # Cell 4: Meant For (optional)
    meant_for = ""
    if len(cells) > 4:
        meant_for = cells[4].get_text().strip()
    
    # Build absolute URL for the detail page
    detail_url = urljoin(RBI_BASE_URL, detail_href)
    
    return CircularMetadata(
        circular_number=circular_number,
        title=title,
        publication_date=publication_date,
        department=department,
        meant_for=meant_for,
        detail_url=detail_url,
    )


def parse_index_html(html: str) -> List[CircularMetadata]:
    """
    Parses the full RBI Circular Index HTML and extracts metadata for every circular.
    
    This function is pure: it takes HTML text as input and returns a list of
    CircularMetadata objects. It has no side effects, makes no network requests,
    and does not filter or classify results.
    
    Args:
        html: Raw HTML string of the RBI Circular Index page.
        
    Returns:
        List of CircularMetadata objects (may be empty if parsing fails).
    """
    soup = BeautifulSoup(html, "html.parser")
    
    table = _locate_circulars_table(soup)
    if not table:
        logger.error("[Parser] No circulars table found in the HTML. Page structure may have changed.")
        return []
    
    rows = table.find_all("tr")
    logger.info(f"[Parser] Found {len(rows)} table rows (including headers)")
    
    results: List[CircularMetadata] = []
    
    for idx, row in enumerate(rows):
        cells = row.find_all("td")
        metadata = _parse_circular_row(cells, idx)
        if metadata:
            results.append(metadata)
    
    logger.info(f"[Parser] Successfully extracted {len(results)} circular metadata records.")
    return results


# ─────────────────────────────────────────────
# HTTP Fetcher (with retry logic)
# ─────────────────────────────────────────────

async def fetch_index_page(
    log_callback: Optional[Callable[[str], None]] = None
) -> str:
    """
    Fetches the RBI Circular Index page HTML with retry logic.
    
    Implements exponential backoff retries to handle temporary HTTP failures,
    network timeouts, and transient 5xx server errors from the RBI website.
    
    Args:
        log_callback: Optional function to receive real-time log messages
                      (e.g., for streaming to the frontend dashboard).
    
    Returns:
        Raw HTML string of the RBI Circular Index page.
        
    Raises:
        RuntimeError: If all retry attempts are exhausted.
    """
    def log(msg: str):
        logger.info(msg)
        if log_callback:
            log_callback(msg)
    
    last_error = None
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log(f"[Collection Engine] Attempt {attempt}/{MAX_RETRIES}: Fetching {RBI_INDEX_URL}")
            
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                follow_redirects=True,
                timeout=REQUEST_TIMEOUT_SECONDS,
            ) as client:
                response = await client.get(RBI_INDEX_URL)
                
                if response.status_code == 200:
                    html = response.text
                    log(f"[Collection Engine] Successfully fetched index page ({len(html)} bytes)")
                    return html
                
                # Retriable server errors (5xx)
                if 500 <= response.status_code < 600:
                    log(f"[Collection Engine] Server error HTTP {response.status_code}. Will retry...")
                    last_error = f"HTTP {response.status_code}"
                else:
                    # Non-retriable client errors (4xx)
                    raise RuntimeError(
                        f"[Collection Engine] Non-retriable HTTP {response.status_code} "
                        f"from {RBI_INDEX_URL}"
                    )
        
        except httpx.TimeoutException as e:
            log(f"[Collection Engine] Request timed out after {REQUEST_TIMEOUT_SECONDS}s. Will retry...")
            last_error = str(e)
        
        except httpx.ConnectError as e:
            log(f"[Collection Engine] Connection failed: {e}. Will retry...")
            last_error = str(e)
        
        except RuntimeError:
            raise  # Don't retry non-retriable errors
        
        except Exception as e:
            log(f"[Collection Engine] Unexpected error: {e}. Will retry...")
            last_error = str(e)
        
        # Wait before retry (exponential backoff)
        if attempt < MAX_RETRIES:
            import asyncio
            wait_time = RETRY_BACKOFF_SECONDS[attempt - 1]
            log(f"[Collection Engine] Waiting {wait_time}s before retry...")
            await asyncio.sleep(wait_time)
    
    raise RuntimeError(
        f"[Collection Engine] All {MAX_RETRIES} attempts exhausted. Last error: {last_error}"
    )


# ─────────────────────────────────────────────
# Public API — The Collection Engine
# ─────────────────────────────────────────────

async def collect_rbi_metadata(
    log_callback: Optional[Callable[[str], None]] = None
) -> List[dict]:
    """
    Main entry point for the RBI Collection Engine.
    
    Crawls the RBI Circular Index page and returns structured metadata
    for every circular found. This function is completely deterministic:
    it does not download PDFs, visit detail pages, call any LLM, or apply
    any filtering logic.
    
    Pipeline Position:
        RBI Website → [THIS FUNCTION] → Intake Agent (future)
    
    Args:
        log_callback: Optional function to receive real-time log messages.
    
    Returns:
        List of metadata dicts, each containing:
            - circular_number (str)
            - title (str)
            - publication_date (str, ISO YYYY-MM-DD)
            - department (str)
            - meant_for (str)
            - detail_url (str, absolute URL)
    
    Example return value:
        [
            {
                "circular_number": "RBI/2026-27/155",
                "title": "Reserve Bank of India (Commercial Banks...) ...",
                "publication_date": "2026-06-24",
                "department": "Department of Regulation",
                "meant_for": "",
                "detail_url": "https://rbi.org.in/Scripts/..."
            }
        ]
    """
    def log(msg: str):
        logger.info(msg)
        if log_callback:
            log_callback(msg)
    
    log("[Collection Engine] ═══ Starting RBI Metadata Collection ═══")
    log(f"[Collection Engine] Target: {RBI_INDEX_URL}")
    
    # Step 1: Fetch the raw HTML
    html = await fetch_index_page(log_callback=log_callback)
    
    # Step 2: Parse metadata from the HTML
    metadata_list = parse_index_html(html)
    
    if not metadata_list:
        log("[Collection Engine] WARNING: Zero circulars extracted. The page structure may have changed.")
        return []
    
    # Step 3: Convert to plain dicts for downstream consumers
    results = [m.to_dict() for m in metadata_list]
    
    log(f"[Collection Engine] ═══ Collection Complete: {len(results)} circulars found ═══")
    for i, r in enumerate(results[:5]):
        log(f"  [{i+1}] {r['circular_number']} | {r['publication_date']} | {r['title'][:70]}...")
    if len(results) > 5:
        log(f"  ... and {len(results) - 5} more")
    
    return results
