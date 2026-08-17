import re

# Simple secret pattern: looking for passwords, tokens, API keys, or embedded creds
SECRET_PATTERN = re.compile(r'(?i)(secret|token|password|api[_-]?key|://[^:]+:[^@]+@)')

def redact_token(token: str) -> str:
    if not token:
        return token
    if SECRET_PATTERN.search(token):
        return "[REDACTED]"
    return token

def create_redacted_signature(
    error_class: str,
    framework: str,
    deployment_type: str,
    service: str,
    extracted_token: str,
    exit_code: int,
    attempt_number: int
) -> dict:
    
    return {
        "error_class": error_class,
        "framework": framework,
        "deployment_type": deployment_type,
        "service": service,
        "extracted_token": redact_token(extracted_token),
        "exit_code": exit_code,
        "attempt_number": attempt_number
    }
