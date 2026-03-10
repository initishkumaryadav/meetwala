import os
import asyncio
from loguru import logger

redis_client = None

async def init_redis():
    global redis_client
    try:
        from redis.asyncio import from_url
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        password = os.getenv("REDIS_PASSWORD", "")
        if password:
            parts = url.split("://")
            url = f"{parts[0]}://:{password}@{parts[1]}"
        redis_client = from_url(url, decode_responses=True, socket_timeout=5, socket_connect_timeout=5)
        await asyncio.wait_for(redis_client.ping(), timeout=8)
        logger.info("⚡ Redis connected (AI service)")
    except Exception as e:
        logger.warning(f"Redis unavailable: {e} — escalation features will be degraded")
        redis_client = None