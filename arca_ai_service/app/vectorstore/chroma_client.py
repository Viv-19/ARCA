import os
import chromadb
from app.core.config import settings

_client = None

# Custom Resilient Local Embedding Generator for offline sandbox execution
class ResilientLocalEmbeddingFunction:
    """
    Computes a deterministic text embedding vector based on word frequency hashing.
    Outputs a stable, normalized 1536-dimensional vector (compatible with OpenAI shape).
    """
    def __call__(self, input_texts):
        # input_texts can be a string or list of strings
        if isinstance(input_texts, str):
            input_texts = [input_texts]
            
        embeddings = []
        for text in input_texts:
            text = str(text).lower().strip()
            # Initialize empty 1536 float array
            vector = [0.0] * 1536
            
            # Simple term-hashing to distribute text features over 1536 dimensions
            words = re.findall(r'[a-z0-9]+', text)
            if not words:
                words = ["empty"]
                
            for word in words:
                # Deterministic hash mapping to a vector index [0, 1535]
                val = 0
                for char in word:
                    val = (val * 31 + ord(char)) % 1536
                # Add frequency occurrences weights
                vector[val] += 1.0
                
            # Normalize vector to ensure cosine similarity comparisons hold true
            magnitude = math.sqrt(sum(v * v for v in vector))
            if magnitude > 0:
                vector = [v / magnitude for v in vector]
                
            embeddings.append(vector)
        return embeddings

# Global regex and math imports needed inside local class
import re
import math

def get_chroma_client():
    global _client
    if _client is None:
        # Guarantee directories exist
        os.makedirs(settings.CHROMA_PERSIST_PATH, exist_ok=True)
        print(f"[ChromaDB] Initializing persistent vector store at: {settings.CHROMA_PERSIST_PATH}...")
        _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_PATH)
    return _client

def get_embedding_function():
    """
    Returns OpenAI Embeddings if configured with valid API keys,
    otherwise returns our custom resilient local hashing embedder.
    """
    is_dummy_key = (
        settings.OPENAI_API_KEY == "your_openai_api_key_here" 
        or not settings.OPENAI_API_KEY 
        or settings.OPENAI_API_KEY.startswith("gsk_")
    )
    if is_dummy_key:
        print("[ChromaDB] OpenAI API key missing, mock, or Groq key. Activating custom Local Term-Hashing Embedder (resilient)...")
        return ResilientLocalEmbeddingFunction()
        
    try:
        from chromadb.utils import embedding_functions
        print("[ChromaDB] OpenAI API key configured. Setting up standard OpenAI Embedding Function...")
        return embedding_functions.OpenAIEmbeddingFunction(
            api_key=settings.OPENAI_API_KEY,
            model_name="text-embedding-3-small"
        )
    except Exception as e:
        print(f"[ChromaDB Warning] Failed to import/initialize OpenAI Embeddings ({e}). Loading resilient local embedder.")
        return ResilientLocalEmbeddingFunction()

def get_regulations_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        "regulations_db",
        embedding_function=get_embedding_function(),
        metadata={"hnsw:space": "cosine"}
    )

def get_maps_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        "maps_db",
        embedding_function=get_embedding_function(),
        metadata={"hnsw:space": "cosine"}
    )

def get_departments_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        "departments_db",
        embedding_function=get_embedding_function(),
        metadata={"hnsw:space": "cosine"}
    )

def add_regulation_embedding(document_id: str, text: str, metadata: dict = None):
    try:
        collection = get_regulations_collection()
        collection.add(
            documents=[text],
            ids=[document_id],
            metadatas=[metadata] if metadata else None
        )
        print(f"[ChromaDB] Successfully stored document embedding for ID: {document_id}")
        return True
    except Exception as e:
        print(f"[ChromaDB Error] Failed to store regulation embedding: {e}")
        return False
