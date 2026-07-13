import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.services.collection_engine.document_registry import _ensure_db, get_registry_stats

async def run():
    await _ensure_db()
    print("DB Initialized")
    stats = await get_registry_stats()
    print("Stats:", stats)

if __name__ == "__main__":
    asyncio.run(run())
