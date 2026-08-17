import os
import re
from ..registry import Adapter, registry

def detect_fastapi(project_path: str) -> bool:
    req_txt = os.path.join(project_path, "requirements.txt")
    pyproject = os.path.join(project_path, "pyproject.toml")
    try:
        if os.path.exists(req_txt):
            with open(req_txt, "r") as f:
                if re.search(r'(?i)^fastapi\b', f.read(), re.MULTILINE):
                    return True
        if os.path.exists(pyproject):
            with open(pyproject, "r") as f:
                if re.search(r'(?i)fastapi', f.read(), re.MULTILINE):
                    return True
    except Exception:
        pass
    return False

def extract_fastapi(project_path: str) -> dict:
    targets = ["main.py", "app/main.py", "app.py", "src/main.py"]
    for t in targets:
        t_path = os.path.join(project_path, t)
        if os.path.exists(t_path):
            try:
                with open(t_path, "r") as f:
                    content = f.read()
                    match = re.search(r'^([a-zA-Z0-9_]+)\s*=\s*FastAPI\(', content, re.MULTILINE)
                    if match:
                        app_var = match.group(1)
                        mod = t.replace(".py", "").replace("/", ".")
                        return {"module_path": mod, "app_var": app_var}
            except Exception:
                pass
    return {"module_path": "app.main", "app_var": "app"}

registry.register(Adapter("fastapi", detect_fastapi, extract_fastapi))
