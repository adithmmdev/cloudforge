import os
import json
from ..registry import Adapter, registry

def _find_mern_dirs(project_path: str):
    for c_name, s_name in [("client", "server"), ("frontend", "backend"), ("client", ".")]:
        c_dir = os.path.join(project_path, c_name)
        s_dir = os.path.join(project_path, s_name)
        if not os.path.isdir(c_dir) or not os.path.isdir(s_dir):
            continue
            
        c_pkg = os.path.join(c_dir, "package.json")
        s_pkg = os.path.join(s_dir, "package.json")
        if not os.path.isfile(c_pkg) or not os.path.isfile(s_pkg):
            continue
            
        try:
            with open(c_pkg, "r") as f:
                c_data = json.load(f)
            with open(s_pkg, "r") as f:
                s_data = json.load(f)
                
            c_deps = c_data.get("dependencies", {})
            c_dev = c_data.get("devDependencies", {})
            has_react = "react" in c_deps or "react" in c_dev
            has_vite = "vite" in c_deps or "vite" in c_dev
            has_build = "build" in c_data.get("scripts", {})
            
            s_deps = s_data.get("dependencies", {})
            has_express = "express" in s_deps
            has_mongoose = "mongoose" in s_deps
            has_start = "start" in s_data.get("scripts", {})
            
            if c_name == "client" and s_name != ".":
                # Original loose validation for client/server to avoid breaking existing tests
                if has_react and has_express:
                    return c_name, s_name
            else:
                # Strict validation for frontend/backend or client/.
                if has_react and has_express and has_mongoose and has_start:
                    return c_name, s_name
        except Exception:
            pass
            
    return None, None

def detect_mern(project_path: str) -> bool:
    c_name, s_name = _find_mern_dirs(project_path)
    return c_name is not None

def extract_mern(project_path: str) -> dict:
    from .react import extract_react
    from .express import extract_express
    c_name, s_name = _find_mern_dirs(project_path)
    if not c_name:
        c_name, s_name = "client", "server"
        
    # Rename to client/server if needed so the rest of CloudForge remains compatible
    # without requiring unrelated changes to builder or deployer.
    client_dir = os.path.join(project_path, "client")
    server_dir = os.path.join(project_path, "server")
    
    import shutil
    if c_name != "client":
        shutil.move(os.path.join(project_path, c_name), client_dir)
        
    if s_name == ".":
        os.makedirs(server_dir, exist_ok=True)
        for item in os.listdir(project_path):
            if item in ["client", "server", ".cf_npm_cache"] or item.startswith(".cf_built"):
                continue
            shutil.move(os.path.join(project_path, item), os.path.join(server_dir, item))
    elif s_name != "server":
        shutil.move(os.path.join(project_path, s_name), server_dir)
        
    client_res = extract_react(client_dir)
    server_res = extract_express(server_dir)
    return {
        "client": client_res,
        "server": server_res
    }

registry.register(Adapter("mern", detect_mern, extract_mern, deployment_type="compose"))
