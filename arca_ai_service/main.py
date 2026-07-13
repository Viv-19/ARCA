from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.documents import router as documents_router
from app.api.pipeline import router as pipeline_router
from app.api.routing import router as routing_router
from app.api.validation import router as validation_router
from app.api.risk import router as risk_router
from app.api.scraper import router as scraper_router
from app.api.collector import router as collector_router
from app.api.registry import router as registry_router
from app.api.intake import router as intake_router

app = FastAPI(
    title="ARCA AI Service",
    description="Multi-agent compliance intelligence agentic service",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(pipeline_router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(routing_router, prefix="/api/routing", tags=["Routing"])
app.include_router(validation_router, prefix="/api/validation", tags=["Validation"])
app.include_router(risk_router, prefix="/api/risk", tags=["Risk"])
app.include_router(scraper_router, prefix="/api/scraper", tags=["Scraper"])
app.include_router(collector_router, prefix="/api/collector", tags=["Collection Engine"])
app.include_router(registry_router, prefix="/api/registry", tags=["Document Registry"])
app.include_router(intake_router, prefix="/api/intake", tags=["Intake Pipeline"])

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "arca-ai-service"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
