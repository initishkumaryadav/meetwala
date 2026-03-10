import time
import io
import base64
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from loguru import logger

from app.core.langgraph.bot_graph import get_bot_graph
from app.core.llm.gemini          import get_llm
from app.core.llm.prompts         import WA_REPLY_PROMPT

router = APIRouter()


class RespondRequest(BaseModel):
    proxy_session_id: str
    meeting_id:       str
    collection_name:  str
    transcript:       str
    speaker:          str
    bot_name:         str = "AI Proxy"


class WaReplyRequest(BaseModel):
    proxy_session_id:  str
    original_question: str
    user_reply:        str


@router.post("/meeting")
async def respond_to_transcript(req: RespondRequest):
    """
    Main endpoint — called by Node backend for every final transcript line.
    Runs the full LangGraph pipeline.
    """
    start = time.time()
    graph = get_bot_graph()

    state = {
        "proxy_session_id":    req.proxy_session_id,
        "meeting_id":          req.meeting_id,
        "collection_name":     req.collection_name,
        "transcript":          req.transcript,
        "speaker":             req.speaker,
        "bot_name":            req.bot_name,
        "is_directed_at_bot":  False,
        "retrieved_chunks":    [],
        "confidence_score":    0.0,
        "bot_response":        None,
        "should_escalate":     False,
        "escalation_question": None,
    }

    try:
        final = await graph.ainvoke(state)
        latency = int((time.time() - start) * 1000)

        logger.info(
            f"⚡ Pipeline done | directed={final['is_directed_at_bot']} | "
            f"confidence={final['confidence_score']:.2f} | "
            f"escalate={final['should_escalate']} | {latency}ms"
        )

        return {
            "bot_response":   final.get("bot_response"),
            "should_escalate": final.get("should_escalate", False),
            "confidence":     final.get("confidence_score", 0.0),
            "latency_ms":     latency,
        }
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        raise HTTPException(500, str(e))


@router.post("/whatsapp-reply")
async def formulate_wa_reply(req: WaReplyRequest):
    """Turn a WhatsApp reply into a polished meeting response."""
    llm    = get_llm(temperature=0.7)
    prompt = WA_REPLY_PROMPT.format(
        original_question=req.original_question,
        user_reply=req.user_reply,
    )
    result = await llm.ainvoke(prompt)
    return {"text": result.content.strip(), "audioUrl": None}


class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text to speech using edge-tts (free Microsoft TTS)."""
    import edge_tts

    try:
        communicate = edge_tts.Communicate(req.text, req.voice)
        audio_buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])

        audio_bytes = audio_buffer.getvalue()
        if not audio_bytes:
            raise HTTPException(500, "TTS produced no audio")

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        return {"audioBase64": audio_b64, "format": "audio/mpeg"}
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(500, str(e))