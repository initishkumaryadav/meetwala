import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from loguru import logger
from app.core.rag.retriever import ingest_briefing, append_to_briefing
from app.core.llm.gemini import get_llm

router = APIRouter()

class IngestRequest(BaseModel):
    proxy_session_id: str
    briefing_text:    str
    metadata:         dict = {}

class ChatRequest(BaseModel):
    proxy_session_id: str
    user_message:     str
    chat_history:     list = []  # [{"role": "user"/"bot", "text": "..."}]
    metadata:         dict = {}

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


@router.post("/upload")
async def upload_files(
    proxy_session_id: str = Form(...),
    files: list[UploadFile] = File(...),
):
    """Upload documents/images. Extract text and ingest into RAG."""
    total_chunks = 0
    processed = []

    for f in files:
        content = await f.read()
        filename = f.filename or "unknown"
        content_type = f.content_type or ""
        logger.info(f"📄 Processing upload: {filename} ({content_type}, {len(content)} bytes)")

        text = ""
        if content_type == "application/pdf":
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(stream=content, filetype="pdf")
                text = "\n\n".join(page.get_text() for page in doc)
                doc.close()
            except ImportError:
                # Fallback: try pdfminer
                from pdfminer.high_level import extract_text as pdf_extract
                text = pdf_extract(io.BytesIO(content))
        elif content_type in ("text/plain", "text/markdown", "text/csv", "application/json"):
            text = content.decode("utf-8", errors="ignore")
        elif content_type.startswith("image/"):
            # Use OpenAI vision to describe the image
            try:
                import base64 as b64mod
                import os
                from openai import OpenAI
                oai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                b64_image = b64mod.b64encode(content).decode("utf-8")
                mime = content_type or "image/png"
                response = oai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Extract ALL text, data, diagrams, and information from this image. If it's a document, transcribe it fully. If it's a diagram or chart, describe it in detail. If it contains meeting notes, agendas, or any relevant information, include everything."},
                            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_image}"}},
                        ],
                    }],
                    max_tokens=1024,
                )
                text = response.choices[0].message.content
            except Exception as e:
                logger.warning(f"Image processing failed for {filename}: {e}")
                text = f"[Image: {filename} - could not extract content]"
        elif content_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ):
            try:
                import docx
                doc = docx.Document(io.BytesIO(content))
                text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
            except ImportError:
                text = content.decode("utf-8", errors="ignore")
        else:
            # Try treating as text
            try:
                text = content.decode("utf-8", errors="ignore")
            except Exception:
                text = f"[Unsupported file: {filename}]"

        if text.strip():
            result = await append_to_briefing(
                proxy_session_id, text,
                metadata={"filename": filename, "content_type": content_type},
                source="upload",
            )
            total_chunks += result["chunk_count"]
            processed.append({"filename": filename, "chunks": result["chunk_count"]})
        else:
            processed.append({"filename": filename, "chunks": 0, "note": "No text extracted"})

    return {
        "collection_name": f"briefing_{proxy_session_id}",
        "total_new_chunks": total_chunks,
        "files": processed,
    }


BRIEFING_CHAT_PROMPT = """\
You are an AI assistant helping a user prepare for a meeting. Your job is to have a natural conversation \
to understand their position, opinions, key facts, decisions, and constraints so a bot can represent them.

Extract and remember ALL factual information the user shares: names, numbers, dates, decisions, opinions, \
project details, talking points, boundaries (what NOT to commit to), etc.

Previous conversation:
{history}

User says: "{message}"

Respond naturally — ask follow-up questions to dig deeper. If they mention something important, \
acknowledge it and ask for more detail. Keep responses concise (2-3 sentences max).

Also output a structured extraction of key information from this message that should be stored.
Format your response as:
RESPONSE: <your conversational reply>
EXTRACT: <key facts/info from the user's message to store, or NONE if nothing factual>
"""


@router.post("/chat")
async def chat_briefing(req: ChatRequest):
    """Conversational briefing — user chats naturally, we extract and store info in RAG."""
    llm = get_llm(temperature=0.7)

    history = "\n".join(
        f"{'User' if m.get('role') == 'user' else 'Bot'}: {m.get('text', '')}"
        for m in (req.chat_history or [])[-10:]  # last 10 messages for context
    ) or "No previous messages."

    prompt = BRIEFING_CHAT_PROMPT.format(history=history, message=req.user_message)
    result = await llm.ainvoke(prompt)
    text = result.content.strip()

    # Parse response and extraction
    bot_reply = text
    extracted = ""
    if "RESPONSE:" in text and "EXTRACT:" in text:
        parts = text.split("EXTRACT:")
        bot_reply = parts[0].replace("RESPONSE:", "").strip()
        extracted = parts[1].strip()
    elif "RESPONSE:" in text:
        bot_reply = text.split("RESPONSE:", 1)[1].strip()

    # If there's extracted info, store it in RAG
    chunks_added = 0
    if extracted and extracted.upper() != "NONE":
        store_text = f"User briefing info: {extracted}\nOriginal message: {req.user_message}"
        result = await append_to_briefing(
            req.proxy_session_id, store_text,
            metadata=req.metadata,
            source="chat",
        )
        chunks_added = result["chunk_count"]
        logger.info(f"💬 Chat extraction stored: {chunks_added} chunks")

    return {
        "reply": bot_reply,
        "chunks_added": chunks_added,
        "collection_name": f"briefing_{req.proxy_session_id}",
    }