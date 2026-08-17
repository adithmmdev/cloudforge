import os
import re
from ..registry import Adapter, registry

def detect_flask(project_path: str) -> bool:
    req_txt = os.path.join(project_path, "requirements.txt")
    pyproject = os.path.join(project_path, "pyproject.toml")
    try:
        if os.path.exists(req_txt):
            with open(req_txt, "r") as f:
                if re.search(r'(?i)^flask\b', f.read(), re.MULTILINE):
                    return True
        if os.path.exists(pyproject):
            with open(pyproject, "r") as f:
                if re.search(r'(?i)flask', f.read(), re.MULTILINE):
                    return True
    except Exception:
        pass
    return False

def extract_flask(project_path: str) -> dict:
    wsgi_module = "app:app"
    procfile = os.path.join(project_path, "Procfile")
    if os.path.exists(procfile):
        try:
            with open(procfile, "r") as f:
                content = f.read()
                match = re.search(r'web:\s*gunicorn\s+(?:[^\s]+\s+)*([^\s]+)', content)
                if match:
                    return {"wsgi_module": match.group(1)}
        except Exception:
            pass

    targets = ["app.py", "application.py", "wsgi.py", "run.py", "src/app.py"]
    for t in targets:
        t_path = os.path.join(project_path, t)
        if os.path.exists(t_path):
            try:
                with open(t_path, "r") as f:
                    content = f.read()
                    if "Flask(__name__)" in content or "Flask(" in content:
                        match = re.search(r'^([a-zA-Z0-9_]+)\s*=\s*Flask\(', content, re.MULTILINE)
                        app_var = match.group(1) if match else "app"
                        mod = t.replace(".py", "").replace("/", ".")
                        return {"wsgi_module": f"{mod}:{app_var}"}
            except Exception:
                pass
    return {"wsgi_module": wsgi_module}

registry.register(Adapter("flask", detect_flask, extract_flask))
