import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.services.collection_engine.document_registry import get_documents_by_status

async def run():
    print("Fetching documents by status...")
    docs = await get_documents_by_status("NEW")
    print(f"Found {len(docs)} documents.")

if __name__ == "__main__":
    asyncio.run(run())
