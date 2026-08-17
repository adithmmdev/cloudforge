import os
import json
import re
from ..registry import Adapter, registry

class UnsupportedStackError(Exception):
    pass

def detect_express(project_path: str) -> bool:
    pkg_json_path = os.path.join(project_path, "package.json")
    if not os.path.exists(pkg_json_path):
        return False
    if os.path.exists(os.path.join(project_path, "client")) and os.path.exists(os.path.join(project_path, "server")):
        return False
    try:
        with open(pkg_json_path, "r") as f:
            data = json.load(f)
            deps = data.get("dependencies", {})
            if "express" in deps:
                if os.path.exists(os.path.join(project_path, "tsconfig.json")):
                    raise UnsupportedStackError("TypeScript Express is a known limitation this semester.")
                return True
    except UnsupportedStackError:
        raise
    except Exception:
        pass
    return False

def extract_express(project_path: str) -> dict:
    entry = "index.js"
    pkg_json_path = os.path.join(project_path, "package.json")
    try:
        with open(pkg_json_path, "r") as f:
            data = json.load(f)
            scripts = data.get("scripts", {})
            if "start" in scripts:
                match = re.search(r'node\s+([^\s]+)', scripts["start"])
                if match:
                    entry = match.group(1)
            elif "main" in data:
                entry = data["main"]
    except Exception:
        pass
    return {"entry_file": entry}

registry.register(Adapter("express", detect_express, extract_express))
