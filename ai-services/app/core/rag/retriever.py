from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai         import OpenAIEmbeddings
from langchain_chroma        import Chroma
from loguru import logger
import os

from app.core.rag.chroma import get_chroma_client

_embeddings = None

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=os.getenv("OPENAI_API_KEY"),
        )
    return _embeddings


async def ingest_briefing(proxy_session_id, briefing_text, metadata={}):
    """Chunk, embed and store briefing text in ChromaDB (replaces existing)."""
    collection_name = f"briefing_{proxy_session_id}"
    logger.info(f"📥 Ingesting briefing | session={proxy_session_id} | chars={len(briefing_text)}")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=80,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(briefing_text)
    logger.debug(f"✂️  {len(chunks)} chunks created")

    chroma = get_chroma_client()

    # Drop old collection if re-briefing
    try:
        chroma.delete_collection(collection_name)
    except Exception:
        pass

    vectorstore = Chroma(
        client=chroma,
        collection_name=collection_name,
        embedding_function=get_embeddings(),
    )

    metadatas = [
        {**metadata, "chunk_index": i, "proxy_session_id": proxy_session_id}
        for i in range(len(chunks))
    ]

    vectorstore.add_texts(texts=chunks, metadatas=metadatas)
    logger.success(f"✅ Ingested {len(chunks)} chunks → '{collection_name}'")

    return {"collection_name": collection_name, "chunk_count": len(chunks)}


async def append_to_briefing(proxy_session_id, text, metadata={}, source="document"):
    """Append additional text to an existing briefing collection (does NOT delete existing data)."""
    collection_name = f"briefing_{proxy_session_id}"
    logger.info(f"📥 Appending to briefing | session={proxy_session_id} | source={source} | chars={len(text)}")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=80,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    logger.debug(f"✂️  {len(chunks)} chunks to append")

    chroma = get_chroma_client()

    vectorstore = Chroma(
        client=chroma,
        collection_name=collection_name,
        embedding_function=get_embeddings(),
    )

    metadatas = [
        {**metadata, "chunk_index": i, "proxy_session_id": proxy_session_id, "source": source}
        for i in range(len(chunks))
    ]

    vectorstore.add_texts(texts=chunks, metadatas=metadatas)
    logger.success(f"✅ Appended {len(chunks)} chunks → '{collection_name}'")

    # Get total count
    collection = chroma.get_collection(collection_name)
    total = collection.count()

    return {"collection_name": collection_name, "chunk_count": len(chunks), "total_chunks": total}


async def retrieve_context(query, collection_name, k=5):
    """Return top-k relevant chunks for a query."""
    chroma = get_chroma_client()
    try:
        vectorstore = Chroma(
            client=chroma,
            collection_name=collection_name,
            embedding_function=get_embeddings(),
        )
        docs = vectorstore.similarity_search(query, k=k)
        return [doc.page_content for doc in docs]
    except Exception as e:
        logger.warning(f"RAG retrieval failed for '{collection_name}': {e}")
        return []