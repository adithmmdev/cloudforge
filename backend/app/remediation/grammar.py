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
    if not service or service not in container_services:
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

import os
import json
import re

def apply_add_dependency(repo_path: str, params: dict):
    service = params.get("service", "")
    target_dir = os.path.join(repo_path, service) if service and service != "app" else repo_path
    package = params.get("package")
    dockerfile = os.path.join(target_dir, "Dockerfile")
    
    if os.path.exists(dockerfile):
        with open(dockerfile, "r") as f:
            lines = f.readlines()
            
        pkg_env = f"ENV CF_ADD_DEP_{package}=1\n"
        
        for i, line in enumerate(lines):
            if line.startswith("CMD ") or line.startswith("ENTRYPOINT "):
                lines.insert(i, pkg_env)
                break
        else:
            lines.append(pkg_env)
            
        with open(dockerfile, "w") as f:
            f.writelines(lines)

def apply_change_base_image(repo_path: str, params: dict):
    service = params.get("service", "")
    target_dir = os.path.join(repo_path, service) if service and service != "app" else repo_path
    image_tag = params.get("image_tag")
    dockerfile = os.path.join(target_dir, "Dockerfile")
    
    if os.path.exists(dockerfile):
        with open(dockerfile, "r") as f:
            lines = f.readlines()
        with open(dockerfile, "w") as f:
            for line in lines:
                if line.startswith("FROM "):
                    f.write(f"FROM {image_tag}\n")
                else:
                    f.write(line)

def apply_expose_port(repo_path: str, params: dict):
    service = params.get("service", "")
    target_dir = os.path.join(repo_path, service) if service and service != "app" else repo_path
    port = params.get("port")
    dockerfile = os.path.join(target_dir, "Dockerfile")
    
    if os.path.exists(dockerfile):
        with open(dockerfile, "r") as f:
            content = f.read()
        if f"EXPOSE {port}" not in content:
            # Insert before CMD or at the end
            lines = content.splitlines()
            for i, line in enumerate(lines):
                if line.startswith("CMD ") or line.startswith("ENTRYPOINT "):
                    lines.insert(i, f"EXPOSE {port}")
                    break
            else:
                lines.append(f"EXPOSE {port}")
            with open(dockerfile, "w") as f:
                f.write("\n".join(lines) + "\n")

def apply_set_start_command(repo_path: str, params: dict):
    service = params.get("service", "")
    target_dir = os.path.join(repo_path, service) if service and service != "app" else repo_path
    cmd = params.get("cmd")
    dockerfile = os.path.join(target_dir, "Dockerfile")
    
    if os.path.exists(dockerfile):
        with open(dockerfile, "r") as f:
            lines = f.readlines()
        with open(dockerfile, "w") as f:
            for line in lines:
                if line.startswith("CMD "):
                    f.write(f"CMD {json.dumps(cmd)}\n")
                else:
                    f.write(line)

def apply_set_env_var(repo_path: str, params: dict):
    service = params.get("service", "")
    target_dir = os.path.join(repo_path, service) if service and service != "app" else repo_path
    key = params.get("key")
    val = params.get("value")
    dockerfile = os.path.join(target_dir, "Dockerfile")
    
    if os.path.exists(dockerfile):
        with open(dockerfile, "r") as f:
            lines = f.readlines()
        
        # Insert before CMD or at the end
        for i, line in enumerate(lines):
            if line.startswith("CMD ") or line.startswith("ENTRYPOINT "):
                lines.insert(i, f"ENV {key}={val}\n")
                break
        else:
            lines.append(f"ENV {key}={val}\n")
        
        with open(dockerfile, "w") as f:
            f.writelines(lines)

def apply_increase_memory_limit(repo_path: str, params: dict):
    service = params.get("service", "app")
    mb = params.get("mb", 512)
    compose_file = os.path.join(repo_path, "docker-compose.yml")
    if os.path.exists(compose_file):
        with open(compose_file, "r") as f:
            content = f.read()
        import re
        # Look for limits: { memory: 256M... } under the specific service
        # This is a bit tricky with regex, but we know the structure from template:
        #   service_name:
        #     ...
        #     deploy:
        #       resources:
        #         limits: { memory: 256M, cpus: "0.5" }
        # We can just replace all instances of memory: 256M if we aren't strict, 
        # but to be safe we should try to replace it only for the target service.
        # However, our template uses exact spacing.
        pattern = re.compile(rf"(\s+{service}:\s*.*?limits:\s*{{.*?memory:\s*)\d+[MmGg](.*}})", re.DOTALL)
        if pattern.search(content):
            content = pattern.sub(rf"\g<1>{mb}M\g<2>", content)
        else:
            # Fallback if specific regex fails, just replace globally (not ideal but works for our simple template)
            content = re.sub(r'(memory:\s*)\d+[mM]', rf'\g<1>{mb}M', content)
        
        with open(compose_file, "w") as f:
            f.write(content)

def apply_restart_service(repo_path: str, params: dict):
    service = params.get("service", "app")
    compose_file = os.path.join(repo_path, "docker-compose.yml")
    if os.path.exists(compose_file):
        with open(compose_file, "r") as f:
            lines = f.readlines()
        
        out_lines = []
        in_service = False
        for line in lines:
            out_lines.append(line)
            if line.startswith(f"  {service}:"):
                in_service = True
            elif in_service and line.startswith("  ") and not line.startswith("    "):
                in_service = False
                
            if in_service and line.startswith(f"  {service}:"):
                out_lines.append("    restart: always\n")
                
        with open(compose_file, "w") as f:
            f.writelines(out_lines)

def apply_none(repo_path: str, params: dict):
    pass

def apply_action(repo_path: str, action_type: str, params: dict):
    if action_type == "ADD_DEPENDENCY":
        apply_add_dependency(repo_path, params)
    elif action_type == "CHANGE_BASE_IMAGE":
        apply_change_base_image(repo_path, params)
    elif action_type == "EXPOSE_PORT":
        apply_expose_port(repo_path, params)
    elif action_type == "SET_START_COMMAND":
        apply_set_start_command(repo_path, params)
    elif action_type == "INCREASE_MEMORY_LIMIT":
        apply_increase_memory_limit(repo_path, params)
    elif action_type == "SET_ENV_VAR":
        apply_set_env_var(repo_path, params)
    elif action_type == "RESTART_SERVICE":
        apply_restart_service(repo_path, params)
