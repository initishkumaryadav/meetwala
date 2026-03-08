from fastapi import APIRouter
from app.services.redis_service import redis_client

router = APIRouter()

@router.get("/")
async def health():
    redis_ok = False
    try:
        await redis_client.ping()
        redis_ok = True
    except Exception:
        pass
    return {"status": "ok", "redis": redis_ok}