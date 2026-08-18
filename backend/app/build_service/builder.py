import os
import subprocess
import threading
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "detector", "templates")
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def render_template_to_file(template_name, dest_path, **kwargs):
    template = env.get_template(template_name)
    content = template.render(**kwargs)
    with open(dest_path, "w") as f:
        f.write(content)

def build_project(project_path: str, project_id: str, deployment_id: str, adapter_name: str, extracted_info: dict, log_callback=None):
    marker_file = os.path.join(project_path, f".cf_built_{deployment_id}")
    if not os.path.exists(marker_file):
        # 1. Write .dockerignore
        render_template_to_file("dockerignore.j2", os.path.join(project_path, ".dockerignore"))
        
        # 2. Write Dockerfile(s) and cf_entrypoint.sh
        if adapter_name == "mern":
            # Client
            client_info = extracted_info.get("client", {})
            render_template_to_file("mern_client.Dockerfile.j2", os.path.join(project_path, "client", "Dockerfile"), **client_info)
            render_template_to_file("mern_nginx.conf.j2", os.path.join(project_path, "client", "nginx.conf"))
            render_template_to_file("cf_entrypoint.sh.j2", os.path.join(project_path, "client", "cf_entrypoint.sh"), is_react_build="true")
            # Server
            server_info = extracted_info.get("server", {})
            render_template_to_file("mern_server.Dockerfile.j2", os.path.join(project_path, "server", "Dockerfile"), **server_info)
            render_template_to_file("cf_entrypoint.sh.j2", os.path.join(project_path, "server", "cf_entrypoint.sh"))
            # Compose
            render_template_to_file("mern_compose.yml.j2", os.path.join(project_path, "docker-compose.yml"), project_id=project_id, deployment_id=deployment_id, host_port=extracted_info.get("host_port", "80"))
            
            # Write .dockerignore for subdirectories too
            render_template_to_file("dockerignore.j2", os.path.join(project_path, "client", ".dockerignore"))
            render_template_to_file("dockerignore.j2", os.path.join(project_path, "server", ".dockerignore"))
        else:
            template_map = {
                "fastapi": "fastapi.Dockerfile.j2",
                "react": "react.Dockerfile.j2",
                "express": "express.Dockerfile.j2",
                "flask": "flask.Dockerfile.j2",
            }
            template_name = template_map.get(adapter_name)
            if not template_name:
                raise ValueError(f"Unknown adapter {adapter_name}")
            
            is_react_build = "true" if adapter_name == "react" else "false"
            is_python = "true" if adapter_name in ["fastapi", "flask"] else "false"
            
            render_template_to_file(template_name, os.path.join(project_path, "Dockerfile"), **extracted_info)
            render_template_to_file("cf_entrypoint.sh.j2", os.path.join(project_path, "cf_entrypoint.sh"), is_react_build=is_react_build, is_python=is_python)
            
        with open(marker_file, "w") as f:
            f.write("built")
            
    # 3. Build images
    if adapter_name == "mern":
        # Build client
        client_image = f"cloudforge-{project_id}-client:{deployment_id}"
        _run_docker_build(os.path.join(project_path, "client"), client_image, log_callback, service="client")
        # Build server
        server_image = f"cloudforge-{project_id}-server:{deployment_id}"
        _run_docker_build(os.path.join(project_path, "server"), server_image, log_callback, service="server")
        return {"status": "success", "images": [client_image, server_image]}
    else:
        image_name = f"cloudforge-{project_id}:{deployment_id}"
        _run_docker_build(project_path, image_name, log_callback)
        return {"status": "success", "images": [image_name]}

def _stream_logs(process, callback, service):
    for line in process.stdout:
        if callback:
            callback(line.strip(), service) if service else callback(line.strip())

def _run_docker_build(build_ctx: str, image_name: str, log_callback, service: str = None):
    cmd = [
        "docker", "build",
        "--network=none",
        "--memory=2g",
        "--cpu-quota=100000",
        "-t", image_name,
        "."
    ]

    process = subprocess.Popen(
        cmd,
        cwd=build_ctx,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    log_thread = threading.Thread(
        target=_stream_logs,
        args=(process, log_callback, service),
        daemon=True,
    )
    log_thread.start()
    try:
        process.wait(timeout=600)
    except subprocess.TimeoutExpired:
        process.kill()
        raise RuntimeError("build_timeout")
    finally:
        log_thread.join(timeout=5)

    if process.returncode != 0:
        raise RuntimeError(f"Docker build failed with code {process.returncode}")
