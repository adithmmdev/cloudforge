import json

def generate_prompt(redacted_signature: dict) -> str:
    return f"""You are a site reliability AI. A deployment has failed.
Analyze the following error signature and choose exactly ONE remediation action.

Error Signature:
{json.dumps(redacted_signature, indent=2)}

You must respond ONLY with a JSON object. No markdown formatting, no explanations.
The JSON object must have exactly three fields:
- "action_type": string (must be one of the allowed types below)
- "params": object (parameters for the action)
- "confidence": float (between 0.0 and 1.0)

Allowed Actions & Parameters:
1. ADD_DEPENDENCY: {{"package": string, "version": string, "manifest": string, "service": string}}
2. CHANGE_BASE_IMAGE: {{"image_tag": string, "service": string}} (Allowed tags: python:3.12-slim, python:3.11-slim, node:18-slim, node:18, nginx:alpine, mongo:7)
3. EXPOSE_PORT: {{"port": integer, "service": string}}
4. SET_START_COMMAND: {{"cmd": array of strings, "service": string}} (Allowed cmd[0]: uvicorn, gunicorn, node, nginx, python)
5. INCREASE_MEMORY_LIMIT: {{"mb": integer, "service": string}}
6. SET_ENV_VAR: {{"key": string, "value": string, "service": string}} (No secrets/passwords/API keys)
7. RESTART_SERVICE: {{"service": string}}
8. NONE: {{}} (If no action can fix this or if human intervention is required)

Few-Shot Examples:
Example 1:
Error Signature: {{"error_class": "missing_python_dependency", "extracted_token": "requests", "service": "app"}}
Response: {{"action_type": "ADD_DEPENDENCY", "params": {{"package": "requests", "version": "latest", "manifest": "requirements.txt", "service": "app"}}, "confidence": 0.95}}

Example 2:
Error Signature: {{"error_class": "port_conflict", "extracted_token": "", "service": "client"}}
Response: {{"action_type": "EXPOSE_PORT", "params": {{"port": 80, "service": "client"}}, "confidence": 0.90}}

Example 3:
Error Signature: {{"error_class": "unclassified", "extracted_token": "", "service": "app"}}
Response: {{"action_type": "NONE", "params": {{}}, "confidence": 1.0}}
"""

def parse_llm_response(response_text: str) -> dict:
    try:
        # Sometimes LLMs wrap JSON in markdown block even when told not to
        text = response_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        
        action_type = data.get("action_type")
        params = data.get("params")
        confidence = data.get("confidence")
        
        if not isinstance(action_type, str) or not isinstance(params, dict) or not isinstance(confidence, (int, float)):
            raise ValueError("Invalid schema")
            
        return {
            "action_type": action_type,
            "params": params,
            "confidence": float(confidence)
        }
    except Exception:
        return {
            "action_type": "NONE",
            "params": {},
            "confidence": 0.0
        }
