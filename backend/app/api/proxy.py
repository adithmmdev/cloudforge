from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import httpx

router = APIRouter(prefix="/proxy", tags=["proxy"])

NVIDIA_TARGET = "https://integrate.api.nvidia.com/v1/chat/completions"


@router.post("/chat/completions")
async def proxy_nvidia(request: Request):
    """
    Transparent streaming proxy to NVIDIA NIM.
    Deployed on Render to bypass ISP-level DPI blocks on integrate.api.nvidia.com.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    forward_headers = {
        "Authorization": request.headers.get("Authorization", ""),
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    async def stream_generator(client: httpx.AsyncClient):
        async with client.stream(
            "POST",
            NVIDIA_TARGET,
            headers=forward_headers,
            json=body,
            timeout=httpx.Timeout(connect=10.0, read=90.0, write=10.0, pool=10.0),
        ) as resp:
            if resp.status_code != 200:
                content = await resp.aread()
                yield content
                return
            async for chunk in resp.aiter_bytes(chunk_size=256):
                if chunk:
                    yield chunk

    async def make_stream():
        async with httpx.AsyncClient() as client:
            async for chunk in stream_generator(client):
                yield chunk

    return StreamingResponse(
        make_stream(),
        status_code=200,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
