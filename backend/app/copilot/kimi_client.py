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
# On Render (cloud), use 45s. Locally blocked networks will still fall back via the thread timeout.
REQUEST_TIMEOUT = int(os.getenv('COPILOT_REQUEST_TIMEOUT', '45'))


def _sync_stream(system_prompt: str, messages: list) -> Generator[str, None, None]:
    """
    Synchronous Kimi streaming call (runs in a thread pool).
    Yields string token chunks.
    """
    import requests

    if not NVIDIA_NIM_API_KEY:
        yield '[Cloud AI key not configured. Showing local evidence only.]\n'
        return

    headers = {
        'Authorization': f'Bearer {NVIDIA_NIM_API_KEY}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': MODEL,
        'messages': [{'role': 'system', 'content': system_prompt}] + messages,
        'temperature': 0.35,
        'max_tokens': MAX_OUTPUT_TOKENS,
        'stream': True,
    }

    try:
        response = requests.post(
            f'{NVIDIA_NIM_BASE_URL}/chat/completions',
            headers=headers,
            json=payload,
            stream=True,
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code == 429:
            yield '\n\n[Rate limit reached. Please wait a moment.]\n'
            return
        if response.status_code in (401, 403):
            yield '\n\n[Cloud AI auth error — check NVIDIA_NIM_API_KEY.]\n'
            return
        if response.status_code != 200:
            yield f'\n\n[Cloud AI unavailable (HTTP {response.status_code}).]\n'
            return

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
                    yield content
            except (json.JSONDecodeError, KeyError, IndexError):
                continue

    except Exception as exc:
        logger.warning(f'Kimi stream error ({type(exc).__name__}): {exc}')
        # Signal to caller that Kimi failed — empty generator
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

    # Run blocking I/O in a thread
    loop.run_in_executor(None, _producer)

    # Drain queue — timeout is REQUEST_TIMEOUT + buffer
    total_timeout = REQUEST_TIMEOUT + 5
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
