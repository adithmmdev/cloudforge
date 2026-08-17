import pytest
from app.remediation.grammar import validate_action

def test_validate_none():
    assert validate_action("single_container", ["app"], "NONE", {}) is True

def test_validate_add_dependency():
    assert validate_action("single_container", ["app"], "ADD_DEPENDENCY", {"package": "requests"}) is True
    # Invalid package name
    assert validate_action("single_container", ["app"], "ADD_DEPENDENCY", {"package": "requests; rm -rf /"}) is False
    # MERN invalid service
    assert validate_action("mern", ["client", "server", "mongo"], "ADD_DEPENDENCY", {"service": "mongo", "package": "mongoose"}) is False
    # MERN valid service
    assert validate_action("mern", ["client", "server", "mongo"], "ADD_DEPENDENCY", {"service": "server", "package": "mongoose"}) is True

def test_validate_change_base_image():
    assert validate_action("single_container", ["app"], "CHANGE_BASE_IMAGE", {"image_tag": "python:3.12-slim"}) is True
    # Not allowed
    assert validate_action("single_container", ["app"], "CHANGE_BASE_IMAGE", {"image_tag": "ubuntu:latest"}) is False

def test_validate_expose_port():
    assert validate_action("single_container", ["app"], "EXPOSE_PORT", {"port": 8000}) is True
    assert validate_action("single_container", ["app"], "EXPOSE_PORT", {"port": 70000}) is False
    assert validate_action("mern", ["client", "server", "mongo"], "EXPOSE_PORT", {"service": "client", "port": 80}) is True
    assert validate_action("mern", ["client", "server", "mongo"], "EXPOSE_PORT", {"service": "server", "port": 8000}) is False

def test_validate_set_start_command():
    assert validate_action("single_container", ["app"], "SET_START_COMMAND", {"cmd": ["uvicorn", "main:app"]}) is True
    assert validate_action("single_container", ["app"], "SET_START_COMMAND", {"cmd": "uvicorn main:app"}) is False
    assert validate_action("single_container", ["app"], "SET_START_COMMAND", {"cmd": ["bash", "script.sh"]}) is False

def test_validate_increase_memory():
    assert validate_action("single_container", ["app"], "INCREASE_MEMORY_LIMIT", {"mb": 512}) is True
    assert validate_action("single_container", ["app"], "INCREASE_MEMORY_LIMIT", {"mb": 64}) is False
    assert validate_action("single_container", ["app"], "INCREASE_MEMORY_LIMIT", {"mb": 2048}) is False

def test_validate_set_env_var():
    assert validate_action("single_container", ["app"], "SET_ENV_VAR", {"key": "NODE_ENV", "value": "production"}) is True
    # Secret key
    assert validate_action("single_container", ["app"], "SET_ENV_VAR", {"key": "AWS_SECRET_KEY", "value": "12345"}) is False
    assert validate_action("single_container", ["app"], "SET_ENV_VAR", {"key": "DB_PASSWORD", "value": "12345"}) is False
    # URI with credentials
    assert validate_action("single_container", ["app"], "SET_ENV_VAR", {"key": "DATABASE_URL", "value": "postgres://user:pass@host/db"}) is False
    # > 500 chars
    assert validate_action("single_container", ["app"], "SET_ENV_VAR", {"key": "DATA", "value": "a" * 501}) is False

def test_validate_restart_service():
    assert validate_action("mern", ["client", "server", "mongo"], "RESTART_SERVICE", {"service": "mongo"}) is True
    assert validate_action("mern", ["client", "server", "mongo"], "RESTART_SERVICE", {"service": "redis"}) is False
    
def test_invalid_action():
    assert validate_action("single_container", ["app"], "DROP_TABLE", {}) is False
