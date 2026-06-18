"""Quick test for the rewritten RBI scraper."""
import asyncio
import json
from app.services.scrapers.rbi_scraper import scrape_rbi_circulars

async def main():
    print("=" * 80)
    print("ARCA — RBI Scraper Integration Test")
    print("=" * 80)
    
    # Fetch 3 circulars to test
    results = await scrape_rbi_circulars(limit=3)
    
    print("\n" + "=" * 80)
    print(f"RESULTS: {len(results)} circulars ingested")
    print("=" * 80)
    
    for i, circ in enumerate(results):
        print(f"\n-- Circular {i+1} --")
        print(f"  Title:     {circ['title']}")
        print(f"  Number:    {circ['circular_number']}")
        print(f"  Date:      {circ['date']}")
        print(f"  Dept:      {circ['department']}")
        print(f"  URL:       {circ['url']}")
        print(f"  Local:     {circ['local_path']}")
        print(f"  Has PDF:   {circ['has_pdf']}")
        print(f"  Text Len:  {circ['extracted_text_length']}")
        print(f"  Hash:      {circ['source_hash'][:16]}...")

if __name__ == "__main__":
    asyncio.run(main())
