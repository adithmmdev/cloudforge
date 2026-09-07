import re

PATTERNS = [
    (r"ModuleNotFoundError: No module named '(\w+)'", "missing_python_dependency"),
    (r"Cannot find module '((?:\.|\/).*)'", "missing_build_step"),
    (r"Cannot find module '([^']+)'", "missing_node_dependency"),
    (r"EADDRINUSE", "port_conflict"),
    (r"(exec format error|no matching manifest for)", "wrong_base_image_arch"),
    (r"OOMKilled: true", "out_of_memory"),
    (r"(?:KeyError:\s*|undefined variable\s*|KeyError\s+)'?([A-Z_][A-Z0-9_]*)'?", "missing_env_var"),
    (r"(MongoNetworkError|ECONNREFUSED .*27017)", "db_connection_failed"),
    (r"npm ERR! code ERR_SOCKET_TIMEOUT", "build_network_error"),
    (r"npm error notarget No matching version found for (@?[a-zA-Z0-9_\-\.\/]+)", "invalid_package_version"),
    (r"container exits within 2s, no matching CMD found", "missing_or_wrong_start_command")
]

def classify_error(logs_or_status: str) -> dict:
    if not logs_or_status:
        return {
            "error_class": "unclassified",
            "extracted_token": ""
        }
        
    for pattern, error_class in PATTERNS:
        match = re.search(pattern, logs_or_status)
        if match:
            if error_class in ["missing_python_dependency", "missing_node_dependency", "missing_build_step", "missing_env_var", "invalid_package_version"]:
                extracted_token = match.group(1) if match.groups() else ""
            elif error_class == "db_connection_failed":
                extracted_token = "mongo"
            else:
                extracted_token = ""
                
            return {
                "error_class": error_class,
                "extracted_token": extracted_token
            }

         
    import requests
    from app.remediation.local_llm import OLLAMA_HOST, OLLAMA_MODEL
    import json
    
Analyze the following deployment error log and classify it.
Output ONLY a JSON object with two keys:
- error_class: A short snake_case string classifying the error. (If you cannot classify it, you MUST output exactly "unclassified" for error_class).
- error_class: A short snake_case string classifying the error.
- extracted_token: The specific missing file, module, env var, or package name if applicable (else empty string).

Log:
{log_text}
"""
    try:
        res = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "format": "json"},
            timeout=120
        )
        if res.status_code == 200:
            data = res.json().get("response", "{}")
            parsed = json.loads(data)
            return {
                "error_class": parsed.get("error_class", "unclassified_by_llm"),
                "extracted_token": parsed.get("extracted_token", "")
            }
    except Exception:
        pass

    return {
        "error_class": "unclassified",
        "extracted_token": ""
    }
