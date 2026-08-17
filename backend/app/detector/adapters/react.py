import os
import json
from ..registry import Adapter, registry

def detect_react(project_path: str) -> bool:
    pkg_json_path = os.path.join(project_path, "package.json")
    if not os.path.exists(pkg_json_path):
        return False
    # Check if it's standalone, not part of MERN client/server split
    if os.path.exists(os.path.join(project_path, "client")) and os.path.exists(os.path.join(project_path, "server")):
        return False
    try:
        with open(pkg_json_path, "r") as f:
            data = json.load(f)
            deps = data.get("dependencies", {})
            dev_deps = data.get("devDependencies", {})
            if "react-scripts" in deps or "react-scripts" in dev_deps:
                return True
            if "vite" in deps or "vite" in dev_deps:
                if "react" in deps or "react" in dev_deps:
                    return True
    except Exception:
        pass
    return False

def extract_react(project_path: str) -> dict:
    build_dir = "dist"
    pkg_json_path = os.path.join(project_path, "package.json")
    try:
        with open(pkg_json_path, "r") as f:
            data = json.load(f)
            deps = data.get("dependencies", {})
            dev_deps = data.get("devDependencies", {})
            if "react-scripts" in deps or "react-scripts" in dev_deps:
                build_dir = "build"
            elif "vite" in deps or "vite" in dev_deps:
                build_dir = "dist"
    except Exception:
        pass
    return {"build_output_dir": build_dir}

registry.register(Adapter("react", detect_react, extract_react))
