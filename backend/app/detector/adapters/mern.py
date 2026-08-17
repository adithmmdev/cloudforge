import os
import json
from ..registry import Adapter, registry

def detect_mern(project_path: str) -> bool:
    client_dir = os.path.join(project_path, "client")
    server_dir = os.path.join(project_path, "server")
    if not os.path.exists(client_dir) or not os.path.exists(server_dir):
        return False
        
    c_pkg = os.path.join(client_dir, "package.json")
    s_pkg = os.path.join(server_dir, "package.json")
    if not os.path.exists(c_pkg) or not os.path.exists(s_pkg):
        return False
        
    try:
        with open(c_pkg, "r") as f:
            c_data = json.load(f)
            c_deps = c_data.get("dependencies", {})
            c_dev = c_data.get("devDependencies", {})
            has_react = "react" in c_deps or "react" in c_dev
            if not has_react:
                return False
                
        with open(s_pkg, "r") as f:
            s_data = json.load(f)
            s_deps = s_data.get("dependencies", {})
            if "express" not in s_deps:
                return False
                
        return True
    except Exception:
        pass
    return False

def extract_mern(project_path: str) -> dict:
    from .react import extract_react
    from .express import extract_express
    client_res = extract_react(os.path.join(project_path, "client"))
    server_res = extract_express(os.path.join(project_path, "server"))
    return {
        "client": client_res,
        "server": server_res
    }

registry.register(Adapter("mern", detect_mern, extract_mern, deployment_type="compose"))
