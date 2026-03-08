import chromadb
import os
import asyncio
from loguru import logger

_chroma_client = None

async def init_chroma_client():
    global _chroma_client
    host  = os.getenv("CHROMA_HOST", "chromadb")
    port  = int(os.getenv("CHROMA_PORT", "8000"))

    # Use local persistent storage when CHROMA_HOST=local (no server needed)
    if host == "local":
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
        _chroma_client = chromadb.PersistentClient(path=persist_dir)
        logger.info(f"🧠 ChromaDB using local persistent storage at {persist_dir}")
        return

    for attempt in range(1, 11):
        try:
            _chroma_client = chromadb.HttpClient(host=host, port=port)
            logger.info(f"🧠 ChromaDB connected at {host}:{port}")
            return
        except Exception as e:
            logger.warning(f"ChromaDB not ready (attempt {attempt}/10): {e}")
            await asyncio.sleep(3)
    raise RuntimeError(f"Could not connect to ChromaDB at {host}:{port} after 10 attempts")

def get_chroma_client():
    if _chroma_client is None:
        raise RuntimeError("ChromaDB not initialized")
    return _chroma_client