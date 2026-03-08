import chromadb
import os
from loguru import logger

_chroma_client = None

async def init_chroma_client():
    global _chroma_client
    host = os.getenv("CHROMA_HOST", "chromadb")
    port = int(os.getenv("CHROMA_PORT", "8001"))

    _chroma_client = chromadb.HttpClient(host=host, port=port)
    logger.info(f"🧠 ChromaDB connected at {host}:{port}")

def get_chroma_client():
    if _chroma_client is None:
        raise RuntimeError("ChromaDB not initialized. Call init_chroma_client() first.")
    return _chroma_client