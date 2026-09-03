from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import httpx

router = APIRouter(prefix="/proxy", tags=["proxy"])

@router.post("/chat/completions")
async def proxy_nvidia(request: Request):
    """
    Proxy endpoint to forward LLM requests to NVIDIA NIM.
    This bypasses local ISP blocks by routing through the Render cloud.
    """
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    
    headers = {
        "Authorization": request.headers.get("Authorization", ""),
        "Content-Type": "application/json"
    }
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    client = httpx.AsyncClient(timeout=60.0)
    
    try:
        req = client.build_request("POST", url, headers=headers, json=body)
        r = await client.send(req, stream=True)
        
        async def stream_generator():
            async for chunk in r.aiter_bytes():
                yield chunk
                
        return StreamingResponse(
            stream_generator(), 
            status_code=r.status_code, 
            media_type=r.headers.get("content-type", "application/json")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
