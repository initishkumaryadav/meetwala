from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from loguru import logger
from app.core.rag.retriever import ingest_briefing

router = APIRouter()

class IngestRequest(BaseModel):
    proxy_session_id: str
    briefing_text: str
    metadata: dict = {}

@router.post("/ingest")
async def ingest(req: IngestRequest):
    if len(req.briefing_text.strip()) < 10:
        raise HTTPException(400, "Briefing text too short")
    try:
        result = await ingest_briefing(req.proxy_session_id, req.briefing_text, req.metadata)
        return result
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(500, str(e))