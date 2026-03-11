"""
MeetWala LangGraph Bot Pipeline
================================
State machine that drives all bot decisions in a live meeting.

Flow:
  classify → rag_lookup → decide → rag_respond   (high confidence)
                                 → escalate       (low confidence → WhatsApp)
"""

import json, re
from typing import TypedDict, Optional, Literal
from langgraph.graph import StateGraph, END
from loguru import logger

from app.core.rag.retriever import retrieve_context
from app.core.llm.gemini    import get_llm
from app.core.llm.prompts   import (
    CLASSIFY_PROMPT,
    CONFIDENCE_CHECK_PROMPT,
    RAG_RESPOND_PROMPT,
)
from app.services.redis_service import redis_client


# ── State definition ──────────────────────────────────
class BotState(TypedDict):
    proxy_session_id:    str
    meeting_id:          str
    collection_name:     str
    transcript:          str
    speaker:             str
    bot_name:            str
    is_directed_at_bot:  bool
    retrieved_chunks:    list
    confidence_score:    float
    bot_response:        Optional[str]
    should_escalate:     bool
    escalation_question: Optional[str]


# ── Node: Classify ────────────────────────────────────
async def classify_node(state: BotState) -> dict:
    llm    = get_llm(temperature=0.0)
    bot_name = state.get("bot_name", "AI Proxy")

    prompt = CLASSIFY_PROMPT.format(
        speaker=state["speaker"],
        transcript=state["transcript"],
        bot_name=bot_name,
    )
    result     = await llm.ainvoke(prompt)
    text       = result.content.strip().lower()
    is_directed = "yes" in text
    logger.debug(f"🎯 Classify: directed={is_directed} (bot_name='{bot_name}')")
    return {"is_directed_at_bot": is_directed}


# ── Node: RAG Lookup ──────────────────────────────────
async def rag_lookup_node(state: BotState) -> dict:
    chunks = await retrieve_context(
        query=state["transcript"],
        collection_name=state["collection_name"],
        k=5,
    )
    logger.debug(f"📚 Retrieved {len(chunks)} chunks")
    return {"retrieved_chunks": chunks}


# ── Node: Decide or Escalate ──────────────────────────
async def decide_node(state: BotState) -> dict:
    llm          = get_llm(temperature=0.0)
    context_text = "\n\n".join(state["retrieved_chunks"]) if state["retrieved_chunks"] else "No context."

    prompt = CONFIDENCE_CHECK_PROMPT.format(
        question=state["transcript"],
        context=context_text,
    )
    result = await llm.ainvoke(prompt)
    text   = result.content.strip()

    match = re.search(r"\{.*\}", text, re.DOTALL)
    data  = json.loads(match.group()) if match else {"confidence": 0.5}

    confidence   = float(data.get("confidence", 0.5))
    escalation_q = data.get("escalation_question")
    should_escalate = confidence < 0.65

    logger.info(f"🧠 Confidence={confidence:.2f} | Escalate={should_escalate}")
    return {
        "confidence_score":    confidence,
        "should_escalate":     should_escalate,
        "escalation_question": escalation_q,
    }


# ── Node: RAG Respond ─────────────────────────────────
async def rag_respond_node(state: BotState) -> dict:
    llm          = get_llm(temperature=0.7)
    context_text = "\n\n".join(state["retrieved_chunks"])

    prompt = RAG_RESPOND_PROMPT.format(
        question=state["transcript"],
        context=context_text,
        speaker=state["speaker"],
    )
    result   = await llm.ainvoke(prompt)
    response = result.content.strip()
    logger.info(f"💬 Bot response: '{response[:80]}...'")
    return {"bot_response": response, "should_escalate": False}


# ── Node: Escalate ────────────────────────────────────
async def escalate_node(state: BotState) -> dict:
    # Generate a polite interim response to speak in the meeting
    escalation_reply = (
        "I don't have the details on this right now. "
        "Let me check with my team and I'll get back to you shortly. "
        "Please feel free to move on to the next point."
    )

    if redis_client:
        await redis_client.setex(
            f"escalation:{state['proxy_session_id']}",
            300,
            json.dumps({
                "question":   state["escalation_question"] or state["transcript"],
                "meeting_id": state["meeting_id"],
            }),
        )
        logger.info(f"📱 Escalation stored for session {state['proxy_session_id']}")
    else:
        logger.warning(f"📱 Redis unavailable — cannot store escalation for {state['proxy_session_id']}")
    return {"bot_response": escalation_reply, "should_escalate": True}


# ── No-op skip node ───────────────────────────────────
async def skip_node(state: BotState) -> dict:
    return state


# ── Routing functions ─────────────────────────────────
def should_respond(state: BotState) -> Literal["rag_lookup", "skip"]:
    return "rag_lookup" if state["is_directed_at_bot"] else "skip"

def rag_or_escalate(state: BotState) -> Literal["rag_respond", "escalate"]:
    return "escalate" if state["should_escalate"] else "rag_respond"


# ── Build and compile the graph ───────────────────────
def build_bot_graph():
    graph = StateGraph(BotState)

    graph.add_node("classify",    classify_node)
    graph.add_node("rag_lookup",  rag_lookup_node)
    graph.add_node("decide",      decide_node)
    graph.add_node("rag_respond", rag_respond_node)
    graph.add_node("escalate",    escalate_node)
    graph.add_node("skip",        skip_node)

    graph.set_entry_point("classify")

    graph.add_conditional_edges("classify", should_respond, {
        "rag_lookup": "rag_lookup",
        "skip":       "skip",
    })
    graph.add_edge("rag_lookup", "decide")
    graph.add_conditional_edges("decide", rag_or_escalate, {
        "rag_respond": "rag_respond",
        "escalate":    "escalate",
    })
    graph.add_edge("rag_respond", END)
    graph.add_edge("escalate",    END)
    graph.add_edge("skip",        END)

    return graph.compile()


_bot_graph = None

def get_bot_graph():
    global _bot_graph
    if _bot_graph is None:
        _bot_graph = build_bot_graph()
    return _bot_graph