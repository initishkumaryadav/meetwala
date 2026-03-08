from dotenv import load_dotenv
from pathlib import Path
# Load root .env in dev; Railway injects env vars in production
_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _env.exists():
    load_dotenv(_env)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from app.api.briefing          import router as briefing_router
from app.api.respond           import router as respond_router
from app.api.health            import router as health_router
from app.core.llm.gemini       import init_llm
from app.core.rag.chroma       import init_chroma_client
from app.services.redis_service import init_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 MeetWala AI Service starting...")
    await init_redis()
    init_llm()
    await init_chroma_client()
    logger.info("✅ All AI services ready")
    yield
    logger.info("🛑 AI Service shutting down")


app = FastAPI(
    title="MeetWala AI Service",
    description="LangChain + LangGraph bot pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router,   prefix="/health")
app.include_router(briefing_router, prefix="/briefing")
app.include_router(respond_router,  prefix="/respond")

@app.get("/")
async def root():
    return {"service": "MeetWala AI", "status": "running"}