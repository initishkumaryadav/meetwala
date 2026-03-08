import os
from langchain_openai import ChatOpenAI
from loguru import logger

_llm_cache = {}

def init_llm():
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("OPENAI_API_KEY not set")
    logger.info("🤖 OpenAI GPT-4o-mini ready")

def get_llm(temperature=0.7):
    key = f"openai_{temperature}"
    if key not in _llm_cache:
        _llm_cache[key] = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=temperature,
            max_tokens=1024,
        )
    return _llm_cache[key]