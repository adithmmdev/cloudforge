import os
from ..registry import Adapter, registry

def detect_python(project_path: str) -> bool:
    req_txt = os.path.join(project_path, "requirements.txt")
    if os.path.exists(req_txt):
        return True
    return False

def extract_python(project_path: str) -> dict:
    return {"entry_file": "app.py"}

registry.register(Adapter("python", detect_python, extract_python))
