import os
import re
import hashlib
import httpx
import datetime
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from app.utils.hash_utils import compute_source_hash

# Ensure download raw directory exists
RAW_DIR = "./data/raw"
os.makedirs(RAW_DIR, exist_ok=True)

BASE_URL = "https://rbi.org.in/Scripts/"
INDEX_URL = "https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx",
}


async def download_file(client: httpx.AsyncClient, url: str, path: str, log_callback = None) -> bool:
    """
    Downloads file from URL and saves it to local path.
    Returns True on success, False on failure.
    """
    def log(msg):
        print(msg)
        if log_callback:
            log_callback(msg)
            
    try:
        response = await client.get(url, timeout=30.0)
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            # Verify we actually got a PDF, not an HTML error page
            if len(response.content) > 500 and (
                "application/pdf" in content_type
                or response.content[:5] == b"%PDF-"
            ):
                with open(path, "wb") as f:
                    f.write(response.content)
                log(f"[Scraper] [OK] Downloaded {len(response.content)} bytes -> {path}")
                return True
            else:
                log(f"[Scraper] [X] Response from {url} is not a valid PDF (content-type: {content_type}, size: {len(response.content)})")
                return False
        else:
            log(f"[Scraper] [X] HTTP {response.status_code} when downloading {url}")
            return False
    except Exception as e:
        log(f"[Scraper] [X] Exception downloading {url}: {e}")
        return False


def parse_rbi_date(date_str: str) -> str:
    """
    Converts RBI date format (e.g., '17.6.2026') to ISO format '2026-06-17'.
    Falls back to today's date if parsing fails.
    """
    try:
        parts = date_str.strip().split(".")
        if len(parts) == 3:
            day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
            return datetime.date(year, month, day).isoformat()
    except (ValueError, IndexError):
        pass
    return datetime.date.today().isoformat()


async def scrape_rbi_circulars(limit: int = 10, log_callback = None):
    """
    Production-grade scraper for the RBI Circulars Index page.

    Strategy:
    1. Fetch the index page at BS_CircularIndexDisplay.aspx
    2. Parse the <table class="tablebg"> to extract structured row data
    3. For each circular, visit its detail page to find the PDF link
    4. Download the actual PDF
    5. Also extract the inline HTML text from the detail page as fallback content

    Returns a list of circular metadata dicts ready for ARCA ingestion.
    """
    def log(msg):
        print(msg)
        if log_callback:
            log_callback(msg)

    log(f"[RBI Scraper] ---- Starting RBI Circulars Index Scraper (limit={limit}) ----")
    log(f"[RBI Scraper] Target: {INDEX_URL}")

    circulars = []

    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20.0) as client:
            # == Step 1: Fetch the index page ==
            log("[RBI Scraper] Step 1: Fetching circulars index page...")
            res = await client.get(INDEX_URL)

            if res.status_code != 200:
                log(f"[RBI Scraper] [X] Index page returned HTTP {res.status_code}")
                return []

            soup = BeautifulSoup(res.text, "html.parser")

            # == Step 2: Find the circulars table ==
            # The table has class "tablebg" and contains all the circular rows
            table = soup.find("table", class_="tablebg")
            if not table:
                log("[RBI Scraper] [X] Could not locate <table class='tablebg'> on the index page.")
                # Fallback: try finding any table with circular data
                tables = soup.find_all("table")
                for t in tables:
                    if t.find("a", class_="link2"):
                        table = t
                        break

            if not table:
                log("[RBI Scraper] [X] No circular data table found. Page structure may have changed.")
                return []

            # == Step 3: Parse table rows ==
            rows = table.find_all("tr")
            log(f"[RBI Scraper] Found {len(rows)} table rows (including headers)")

            parsed_circulars = []
            for row in rows:
                cells = row.find_all("td")
                if len(cells) < 4:
                    continue  # Skip header rows or malformed rows

                # Cell 0: Circular Number (contains <a class="link2"> with the detail page link)
                link_tag = cells[0].find("a", class_="link2")
                if not link_tag:
                    continue

                circular_number = link_tag.get_text(separator=" ").strip()
                detail_href = link_tag.get("href", "")

                # Cell 1: Date of Issue
                date_text = cells[1].get_text().strip()
                date_iso = parse_rbi_date(date_text)

                # Cell 2: Department
                department = cells[2].get_text().strip()

                # Cell 3: Subject (this is the actual compliance title)
                subject = cells[3].get_text().strip()

                # Cell 4: Meant For (may be empty)
                meant_for = cells[4].get_text().strip() if len(cells) > 4 else ""

                # Build the full detail page URL
                detail_url = urljoin(BASE_URL, detail_href)

                parsed_circulars.append({
                    "circular_number": circular_number,
                    "date": date_iso,
                    "department": department,
                    "subject": subject,
                    "meant_for": meant_for,
                    "detail_url": detail_url,
                })

            log(f"[RBI Scraper] Step 2: Parsed {len(parsed_circulars)} circulars from the index table")

            # Apply limit
            parsed_circulars = parsed_circulars[:limit]

            # == Step 4: Visit each circular's detail page ==
            for idx, circ in enumerate(parsed_circulars):
                log(f"[RBI Scraper] Step 3.{idx+1}: Processing circular {circ['circular_number']}")
                log(f"  Subject: {circ['subject'][:80]}...")
                log(f"  Detail URL: {circ['detail_url']}")

                # Compute unique source hash for deduplication
                source_hash = compute_source_hash("RBI", circ["subject"], circ["date"])

                try:
                    detail_res = await client.get(circ["detail_url"], timeout=15.0)
                    if detail_res.status_code != 200:
                        log(f"  [X] Detail page returned HTTP {detail_res.status_code}. Skipping.")
                        continue

                    detail_soup = BeautifulSoup(detail_res.text, "html.parser")

                    # == Step 4a: Find PDF download link ==
                    pdf_url = None
                    for a_tag in detail_soup.find_all("a", href=True):
                        href = a_tag["href"]
                        if href.lower().endswith(".pdf"):
                            pdf_url = urljoin(circ["detail_url"], href)
                            log(f"  [OK] Found PDF link: {pdf_url}")
                            break

                    # == Step 4b: Extract inline HTML text as fallback ==
                    inline_text = ""
                    # The main content is in <div id="pnlDetails"> or <div class="content_area">
                    content_div = detail_soup.find("div", id="pnlDetails")
                    if not content_div:
                        content_div = detail_soup.find("div", class_="content_area")
                    if content_div:
                        # Remove script/style tags
                        for tag in content_div.find_all(["script", "style", "nav"]):
                            tag.decompose()
                        inline_text = content_div.get_text(separator="\n").strip()
                        # Clean excessive whitespace
                        inline_text = re.sub(r"\n{3,}", "\n\n", inline_text)
                        inline_text = re.sub(r" {2,}", " ", inline_text)

                    # == Step 4c: Download PDF ==
                    local_path = None
                    if pdf_url:
                        filename = f"rbi_{source_hash[:12]}.pdf"
                        local_path = os.path.join(RAW_DIR, filename)

                        # Skip if already downloaded
                        if os.path.exists(local_path) and os.path.getsize(local_path) > 500:
                            log(f"  [OK] PDF already cached at {local_path}")
                        else:
                            success = await download_file(client, pdf_url, local_path, log_callback=log_callback)
                            if not success:
                                local_path = None

                    # == Step 4d: If no PDF, save inline text to a .txt file ==
                    if not local_path and inline_text and len(inline_text) > 100:
                        txt_filename = f"rbi_{source_hash[:12]}.txt"
                        txt_path = os.path.join(RAW_DIR, txt_filename)
                        with open(txt_path, "w", encoding="utf-8") as f:
                            f.write(f"CIRCULAR NUMBER: {circ['circular_number']}\n")
                            f.write(f"DATE: {circ['date']}\n")
                            f.write(f"DEPARTMENT: {circ['department']}\n")
                            f.write(f"SUBJECT: {circ['subject']}\n")
                            f.write(f"MEANT FOR: {circ['meant_for']}\n")
                            f.write(f"SOURCE URL: {circ['detail_url']}\n")
                            f.write("=" * 80 + "\n\n")
                            f.write(inline_text)
                        local_path = txt_path
                        log(f"  [OK] Saved inline text ({len(inline_text)} chars) -> {txt_path}")

                    if not local_path:
                        log(f"  [X] No PDF and no meaningful inline text. Skipping.")
                        continue

                    # == Step 5: Build the output record ==
                    circulars.append({
                        "title": circ["subject"],
                        "circular_number": circ["circular_number"],
                        "url": pdf_url or circ["detail_url"],
                        "date": circ["date"],
                        "department": circ["department"],
                        "meant_for": circ["meant_for"],
                        "local_path": local_path,
                        "source_hash": source_hash,
                        "has_pdf": pdf_url is not None,
                        "extracted_text_length": len(inline_text),
                    })

                except Exception as detail_err:
                    log(f"  [X] Error processing detail page: {detail_err}")
                    continue

    except Exception as e:
        log(f"[RBI Scraper] [X] Fatal scraper error: {e}")
        import traceback
        traceback.print_exc()
        return []

    log(f"[RBI Scraper] ---- Scraping complete. {len(circulars)} circulars ingested. ====")
    for c in circulars:
        log(f"  -> [{c['date']}] {c['circular_number']}: {c['title'][:60]}... (PDF: {c['has_pdf']})")

    return circulars
