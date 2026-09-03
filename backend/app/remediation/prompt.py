import json

def generate_prompt(redacted_signature: dict, past_actions: list = None) -> str:
    past_context = ""
    if past_actions:
        past_context = "\nPreviously Attempted Actions that FAILED Shadow Verification (DO NOT REPEAT THESE):\n"
        for a in past_actions:
            past_context += f"- Action: {a['action_type']}, Params: {a['params']}, Failed Reason: {a['failure_reason']}\n"

    return f"""You are a site reliability AI. A deployment has failed.
Analyze the following error signature and choose exactly ONE remediation action.

Error Signature:
{json.dumps(redacted_signature, indent=2)}
{past_context}
You must respond ONLY with a JSON object. No markdown formatting, no explanations.
The JSON object must have exactly four fields:
- "reasoning": string (A detailed step-by-step explanation of your thought process leading to this action. Format the output with clear labels like 'Root Cause:', 'Evidence:', 'Action:', etc. so it renders nicely in a terminal)
- "action_type": string (must be one of the allowed types below)
- "params": object (parameters for the action)
- "confidence": float (between 0.0 and 1.0)

Allowed Actions & Parameters:
1. ADD_DEPENDENCY: {{"package": string, "version": string, "manifest": string, "service": string}}
2. CHANGE_BASE_IMAGE: {{"image_tag": string, "service": string}} (Allowed tags: python:3.12-slim, python:3.11-slim, node:18-slim, node:18, nginx:alpine, mongo:7)
3. EXPOSE_PORT: {{"port": integer, "service": string}} (For public-facing ports only)
4. CHANGE_INTERNAL_PORT: {{"port": integer, "service": string}} (For adapting internal backend/proxy ports without public exposure)
5. SET_START_COMMAND: {{"cmd": array of strings, "service": string}} (Allowed cmd[0]: uvicorn, gunicorn, node, nginx, python)
6. INCREASE_MEMORY_LIMIT: {{"mb": integer, "service": string}}
7. SET_ENV_VAR: {{"key": string, "value": string, "service": string}} (No secrets/passwords/API keys)
8. RESTART_SERVICE: {{"service": string}}
9. ADD_RUN_COMMAND: {{"cmd": string, "service": string}} (For executing missing build steps like 'npm run build' inside the Dockerfile before CMD)
10. NONE: {{}} (If no action can fix this or if human intervention is required)

Few-Shot Examples:
Example 1:
Error Signature: {{"error_class": "missing_build_step", "extracted_token": "/app/dist/server.js", "service": "app"}}
Response: {{"reasoning": "Root Cause: The application failed to start because the compiled file '/app/dist/server.js' does not exist.\\nEvidence: Extracted token indicates a missing local build file rather than an npm dependency.\\nAction: Add a RUN command to execute 'npm run build' in the Dockerfile so the dist folder is generated.", "action_type": "ADD_RUN_COMMAND", "params": {{"cmd": "npm run build", "service": "app"}}, "confidence": 0.95}}

Example 2:
Error Signature: {{"error_class": "missing_python_dependency", "extracted_token": "requests", "service": "app"}}
Response: {{"reasoning": "Root Cause: A missing python dependency.\\nEvidence: Extracted token 'requests'.\\nAction: I will add the 'requests' package to requirements.txt to resolve the ModuleNotFoundError.", "action_type": "ADD_DEPENDENCY", "params": {{"package": "requests", "version": "latest", "manifest": "requirements.txt", "service": "app"}}, "confidence": 0.95}}

Example 2:
Error Signature: {{"error_class": "port_conflict", "extracted_token": "", "service": "client"}}
Response: {{"reasoning": "Root Cause: EADDRINUSE port conflict on the client container.\\nAction: The client container needs to expose the correct port to the host.", "action_type": "EXPOSE_PORT", "params": {{"port": 80, "service": "client"}}, "confidence": 0.90}}

Example 3:
Error Signature: {{"error_class": "invalid_package_version", "extracted_token": "some-package", "service": "client"}}
Response: {{"reasoning": "Root Cause: npm cannot resolve a matching version for 'some-package'.\\nEvidence: npm error code ETARGET.\\nAction: Use ADD_DEPENDENCY to override the package version to '*' in package.json to fetch the latest valid version.", "action_type": "ADD_DEPENDENCY", "params": {{"package": "some-package", "version": "*", "manifest": "package.json", "service": "client"}}, "confidence": 0.95}}

Example 4:
Error Signature: {{"error_class": "unclassified", "extracted_token": "", "service": "app"}}
Response: {{"reasoning": "Root Cause: Unknown.\\nEvidence: Error signature is unclassified with no extracted token.\\nAction: No safe remediation can be automatically applied. Escalating to NONE.", "action_type": "NONE", "params": {{}}, "confidence": 1.0}}
"""

import re

def parse_llm_response(response_text: str) -> dict:
    try:
        text = response_text.strip()
        # Find the first JSON block using regex if present
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if json_match:
            text = json_match.group(1)
        else:
            # Fallback to finding the first { and last }
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
        
        data = json.loads(text)
        
        action_type = data.get("action_type")
        params = data.get("params")
        confidence = data.get("confidence")
        reasoning = data.get("reasoning", "")
        
        if not isinstance(action_type, str) or not isinstance(params, dict) or not isinstance(confidence, (int, float)):
            raise ValueError("Invalid schema")
            
        return {
            "action_type": action_type,
            "params": params,
            "confidence": float(confidence),
            "reasoning": str(reasoning)
        }
    except Exception as e:
        import traceback
        print(f"Error parsing LLM response: {e}")
        traceback.print_exc()
        return {
            "action_type": "NONE",
            "params": {},
            "confidence": 0.0,
            "reasoning": "Failed to parse LLM JSON response."
        }
