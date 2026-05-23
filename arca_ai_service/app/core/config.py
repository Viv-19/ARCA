import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str = "your_openai_api_key_here"
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    MODEL_NAME: str = "gpt-4o"
    LANGSMITH_API_KEY: str = "your_langsmith_api_key_here"
    LANGCHAIN_TRACING_V2: str = "true"
    LANGCHAIN_PROJECT: str = "arca-compliance"
    DATABASE_URL: str = "postgresql://arca_user:arca_pass@localhost:5543/arca?schema=public"
    REDIS_URL: str = "redis://localhost:6380/0"
    BACKEND_URL: str = "http://localhost:3001"
    CHROMA_PERSIST_PATH: str = "./data/chroma_db"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Enable LangSmith tracing automatically if configured
os.environ["LANGCHAIN_TRACING_V2"] = settings.LANGCHAIN_TRACING_V2
os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT

# Dynamic Groq API detection
if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("gsk_"):
    print("[Config] Groq API Key detected. Routing all LLM operations to Groq Endpoint.")
    settings.OPENAI_API_BASE = "https://api.groq.com/openai/v1"
    settings.MODEL_NAME = "llama-3.3-70b-versatile"

if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your_openai_api_key_here":
    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    os.environ["OPENAI_API_BASE"] = settings.OPENAI_API_BASE

