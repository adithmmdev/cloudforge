import pytest
from app.remediation.redactor import create_redacted_signature, redact_token

def test_redact_token():
    assert redact_token("requests") == "requests"
    assert redact_token("aws_secret_key") == "[REDACTED]"
    assert redact_token("DB_PASSWORD") == "[REDACTED]"
    assert redact_token("MY_API_KEY") == "[REDACTED]"
    assert redact_token("postgres://user:pass@host/db") == "[REDACTED]"

def test_create_redacted_signature():
    sig = create_redacted_signature(
        error_class="missing_env_var",
        framework="fastapi",
        deployment_type="single_container",
        service="app",
        extracted_token="API_KEY",
        exit_code=1,
        attempt_number=1
    )
    
    assert sig["error_class"] == "missing_env_var"
    assert sig["framework"] == "fastapi"
    assert sig["deployment_type"] == "single_container"
    assert sig["service"] == "app"
    assert sig["extracted_token"] == "[REDACTED]"
    assert sig["exit_code"] == 1
    assert sig["attempt_number"] == 1
