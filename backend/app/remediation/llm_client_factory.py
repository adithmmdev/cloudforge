import os
import json
import requests
from sqlalchemy.orm import Session
from app.models.disclosure import Disclosure
from app.remediation.prompt import generate_prompt, parse_llm_response

CLOUD_LLM_PROVIDER = os.getenv("CLOUD_LLM_PROVIDER", "anthropic")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GLM_BASE_URL = os.getenv("GLM_BASE_URL", "https://api.z.ai/api/paas/v4")
GLM_API_KEY = os.getenv("GLM_API_KEY")
NVIDIA_NIM_BASE_URL = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_NIM_API_KEY = os.getenv("NVIDIA_NIM_API_KEY")

def call_anthropic(prompt: str) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    model_name = os.getenv("CLOUD_LLM_MODEL_ANTHROPIC", "claude-haiku-4-5-20251001")
    payload = {
        "model": model_name,
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    res = requests.post(url, json=payload, headers=headers, timeout=10)
    res.raise_for_status()
    return res.json()["content"][0]["text"]

def call_openai_compatible(base_url: str, api_key: str, model: str, prompt: str) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "content-type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }
    res = requests.post(url, json=payload, headers=headers, timeout=60)
    res.raise_for_status()
    return res.json()["choices"][0]["message"]["content"]

def get_cloud_remediation_action(db: Session, failure_id: int, redacted_signature: dict, past_actions: list = None) -> dict:
    prompt = generate_prompt(redacted_signature, past_actions)
    
    # Enforce NVIDIA NIM Kimi K3 as the ONLY cloud fallback per requirements
    destination = "nvidia_nim_api"
    disclosure = Disclosure(
        failure_id=failure_id,
        content_sent=json.dumps(redacted_signature),
        destination=destination
    )
    db.add(disclosure)
    db.commit()
    
    try:
        if not NVIDIA_NIM_API_KEY: raise ValueError("NVIDIA_NIM_API_KEY missing")
        model_name = os.getenv("CLOUD_LLM_MODEL_NVIDIA", "moonshotai/kimi-k3")
        response_text = call_openai_compatible(NVIDIA_NIM_BASE_URL, NVIDIA_NIM_API_KEY, model_name, prompt)
            
        return parse_llm_response(response_text)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "action_type": "NONE",
            "params": {},
            "confidence": 0.0
        }
