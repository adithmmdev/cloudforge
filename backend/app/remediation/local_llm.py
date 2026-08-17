import os
import requests
from app.remediation.prompt import generate_prompt, parse_llm_response

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

def get_remediation_action(redacted_signature: dict) -> dict:
    prompt = generate_prompt(redacted_signature)
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=30)
        response.raise_for_status()
        
        response_text = response.json().get("response", "")
        return parse_llm_response(response_text)
    except Exception as e:
        return {
            "action_type": "NONE",
            "params": {},
            "confidence": 0.0
        }
