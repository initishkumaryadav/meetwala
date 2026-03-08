import os
from redis.asyncio import from_url
from loguru import logger

redis_client = None

async def init_redis():
    global redis_client
    url = os.getenv("REDIS_URL", "redis://redis:6379")
    redis_client = from_url(url, decode_responses=True)
    logger.info("⚡ Redis connected (AI service)")