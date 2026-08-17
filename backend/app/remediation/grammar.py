import re

ALLOWED_IMAGE_TAGS = {
    "python:3.12-slim", "python:3.11-slim", "node:18-slim", "node:18", "nginx:alpine", "mongo:7"
}
ALLOWED_START_COMMANDS = {"uvicorn", "gunicorn", "node", "nginx", "python"}
SECRET_PATTERN = re.compile(r'(?i)(secret|token|password|api[_-]?key)')
URI_CREDENTIALS_PATTERN = re.compile(r'://[^:]+:[^@]+@')
PACKAGE_PATTERN = re.compile(r'^[a-zA-Z0-9_\-\.]+$')

def validate_action(deployment_type: str, container_services: list[str], action_type: str, params: dict) -> bool:
    if action_type not in [
        "ADD_DEPENDENCY", "CHANGE_BASE_IMAGE", "EXPOSE_PORT",
        "SET_START_COMMAND", "INCREASE_MEMORY_LIMIT", "SET_ENV_VAR",
        "RESTART_SERVICE", "NONE"
    ]:
        return False

    if action_type == "NONE":
        return True

    service = params.get("service", "app" if deployment_type == "single_container" else "")
    if not service:
        return False
        
    if action_type == "ADD_DEPENDENCY":
        if deployment_type == "mern" and service not in ["client", "server"]:
            return False
        package = params.get("package", "")
        if not PACKAGE_PATTERN.match(package):
            return False
            
    elif action_type == "CHANGE_BASE_IMAGE":
        image_tag = params.get("image_tag", "")
        if image_tag not in ALLOWED_IMAGE_TAGS:
            return False
            
    elif action_type == "EXPOSE_PORT":
        port = params.get("port")
        if not isinstance(port, int) or not (1 <= port <= 65535):
            return False
        if deployment_type == "mern" and service != "client":
            return False
            
    elif action_type == "SET_START_COMMAND":
        cmd = params.get("cmd")
        if not isinstance(cmd, list) or not all(isinstance(c, str) for c in cmd):
            return False
        if not cmd or cmd[0] not in ALLOWED_START_COMMANDS:
            return False
            
    elif action_type == "INCREASE_MEMORY_LIMIT":
        mb = params.get("mb")
        if not isinstance(mb, int) or not (128 <= mb <= 1024):
            return False
            
    elif action_type == "SET_ENV_VAR":
        key = params.get("key", "")
        value = params.get("value", "")
        if not isinstance(value, str):
            # The value could be int, but spec implies env var values are strings
            value = str(value)
        if SECRET_PATTERN.search(key):
            return False
        if URI_CREDENTIALS_PATTERN.search(value):
            return False
        if len(value) > 500:
            return False
            
    elif action_type == "RESTART_SERVICE":
        if service not in container_services:
            return False

    return True

def apply_add_dependency(repo_path: str, params: dict):
    pass

def apply_change_base_image(repo_path: str, params: dict):
    pass

def apply_expose_port(repo_path: str, params: dict):
    pass

def apply_set_start_command(repo_path: str, params: dict):
    pass

def apply_increase_memory_limit(repo_path: str, params: dict):
    pass

def apply_set_env_var(repo_path: str, params: dict):
    pass

def apply_restart_service(repo_path: str, params: dict):
    pass

def apply_none(repo_path: str, params: dict):
    pass

