import os
import json
import logging
import asyncio
from typing import Generator, AsyncGenerator

logger = logging.getLogger(__name__)

NVIDIA_NIM_BASE_URL = os.getenv('NVIDIA_NIM_BASE_URL', 'https://integrate.api.nvidia.com/v1')
NVIDIA_NIM_API_KEY = os.getenv('NVIDIA_NIM_API_KEY', '')
MODEL = os.getenv('CLOUD_LLM_MODEL_NVIDIA', 'moonshotai/kimi-k3')
MAX_OUTPUT_TOKENS = int(os.getenv('COPILOT_MAX_OUTPUT_TOKENS', '1200'))
# 45s for direct NVIDIA, 90s for proxy (Render cold start + forwarding)
REQUEST_TIMEOUT = int(os.getenv('COPILOT_REQUEST_TIMEOUT', '90'))

# If the base URL is a Render proxy, we still need to send the auth header
# so the proxy can forward it to NVIDIA
_IS_PROXY = 'render.com' in NVIDIA_NIM_BASE_URL or 'onrender.com' in NVIDIA_NIM_BASE_URL

logger.info(f"Kimi client configured: url={NVIDIA_NIM_BASE_URL}, proxy_mode={_IS_PROXY}")


def _sync_stream(system_prompt: str, messages: list) -> Generator[str, None, None]:
    """
    Synchronous Kimi streaming call (runs in a thread pool).
    Yields string token chunks.
    Works in both direct-NVIDIA mode and Render-proxy mode.
    """
    import requests

    if not NVIDIA_NIM_API_KEY:
        yield '[Cloud AI key not configured. Showing local evidence only.]\n'
        return

    # Always send Auth — proxy forwards it, direct call needs it
    headers = {
        'Authorization': f'Bearer {NVIDIA_NIM_API_KEY}',
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
    }

    payload = {
        'model': MODEL,
        'messages': [{'role': 'system', 'content': system_prompt}] + messages,
        'temperature': 0.35,
        'max_tokens': MAX_OUTPUT_TOKENS,
        'stream': True,
    }

    endpoint = f'{NVIDIA_NIM_BASE_URL}/chat/completions'
    logger.info(f"Kimi request to: {endpoint}")

    try:
        response = requests.post(
            endpoint,
            headers=headers,
            json=payload,
            stream=True,
            timeout=REQUEST_TIMEOUT,
        )
        logger.info(f"Kimi response status: {response.status_code}")
        if response.status_code == 429:
            yield '\n\n[Rate limit reached. Please wait a moment.]\n'
            return
        if response.status_code in (401, 403):
            yield '\n\n[Cloud AI auth error — check NVIDIA_NIM_API_KEY.]\n'
            return
        if response.status_code != 200:
            body = response.text[:300]
            logger.error(f"Kimi bad status {response.status_code}: {body}")
            yield f'\n\n[Cloud AI unavailable (HTTP {response.status_code}). Details: {body[:100]}]\n'
            return

        got_tokens = False
        for line in response.iter_lines():
            if not line:
                continue
            decoded = line.decode('utf-8') if isinstance(line, bytes) else line
            if not decoded.startswith('data: '):
                continue
            data = decoded[6:]
            if data == '[DONE]':
                break
            try:
                chunk = json.loads(data)
                content = chunk['choices'][0]['delta'].get('content', '')
                if content:
                    got_tokens = True
                    yield content
            except (json.JSONDecodeError, KeyError, IndexError):
                continue

        if not got_tokens:
            logger.warning("Kimi returned 200 but no tokens — possible empty/truncated stream")

    except requests.exceptions.Timeout:
        logger.error(f"Kimi timed out after {REQUEST_TIMEOUT}s — ISP block or network issue")
        # Don't yield anything — caller will trigger fallback
        return
    except Exception as exc:
        logger.warning(f'Kimi stream error ({type(exc).__name__}): {exc}')
        return


async def stream_copilot_async(system_prompt: str, messages: list) -> AsyncGenerator[str, None]:
    """
    Async wrapper: runs the blocking requests call in a thread pool
    so it never blocks the FastAPI event loop.
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    SENTINEL = object()

    def _producer():
        try:
            for token in _sync_stream(system_prompt, messages):
                loop.call_soon_threadsafe(queue.put_nowait, token)
        except Exception as e:
            logger.warning(f"Kimi producer error: {e}")
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, SENTINEL)

    loop.run_in_executor(None, _producer)

    total_timeout = REQUEST_TIMEOUT + 10
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=total_timeout)
            if item is SENTINEL:
                break
            yield item
        except asyncio.TimeoutError:
            logger.warning('Kimi token queue timed out — assuming stream ended')
            break


def get_token_estimate(text: str) -> int:
    return max(1, len(text) // 4)
