import os
import json
import re
from ..registry import Adapter, registry, UnsupportedStackError

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

def _find_express_port(project_path: str) -> str:
    # 1. Dockerfile EXPOSE
    dockerfile_path = os.path.join(project_path, "Dockerfile")
    if os.path.exists(dockerfile_path):
        with open(dockerfile_path, "r", encoding="utf-8") as f:
            content = f.read()
            if ".cf_npm_cache" not in content:
                for line in content.splitlines():
                    m = re.match(r'^\s*EXPOSE\s+(\d+)', line, re.IGNORECASE)
                    if m:
                        return m.group(1)

    # 2. Search JS files
    # Prioritize main entry files
    priority_files = ["server.js", "app.js", "index.js", "main.js"]
    for file in priority_files:
        filepath = os.path.join(project_path, file)
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    m = re.search(r'process\.env\.PORT\s*\|\|\s*(\d+)', content)
                    if m and int(m.group(1)) > 0: return m.group(1)
                    m = re.search(r'PORT\s*\|\|\s*(\d+)', content)
                    if m and int(m.group(1)) > 0: return m.group(1)
                    m = re.search(r'app\.listen\s*\(\s*(\d+)', content)
                    if m and int(m.group(1)) > 0: return m.group(1)
                    m = re.search(r'(?:const|let|var)\s+PORT\s*=\s*(\d+)', content)
                    if m and int(m.group(1)) > 0: return m.group(1)
            except:
                pass

    for root, dirs, files in os.walk(project_path):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if 'test' in dirs: dirs.remove('test')
        if 'tests' in dirs: dirs.remove('tests')
        for file in files:
            if file.endswith('.js') or file.endswith('.ts'):
                if 'test' in file.lower() or 'spec' in file.lower():
                    continue
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                        m = re.search(r'process\.env\.PORT\s*\|\|\s*(\d+)', content)
                        if m and int(m.group(1)) > 0: return m.group(1)
                        m = re.search(r'PORT\s*\|\|\s*(\d+)', content)
                        if m and int(m.group(1)) > 0: return m.group(1)
                        m = re.search(r'app\.listen\s*\(\s*(\d+)', content)
                        if m and int(m.group(1)) > 0: return m.group(1)
                        m = re.search(r'(?:const|let|var)\s+PORT\s*=\s*(\d+)', content)
                        if m and int(m.group(1)) > 0: return m.group(1)
                except:
                    pass
    return "5000"

def _discover_mongo_config(project_path: str) -> dict:
    env_vars = {}
    for env_file in [".env", ".env.example", ".env.local"]:
        env_path = os.path.join(project_path, env_file)
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            parts = line.split("=", 1)
                            if len(parts) == 2:
                                key = parts[0].strip()
                                val = parts[1].strip()
                                if "mongo" in key.lower() or "mongo" in val.lower() or "db" in key.lower():
                                    env_vars[key] = val
            except Exception:
                pass

    process_env_refs = set()
    for root, dirs, files in os.walk(project_path):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        for file in files:
            if file.endswith('.js') or file.endswith('.ts'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                        matches = re.findall(r'process\.env\.([A-Z0-9_]+)', content)
                        for m in matches:
                            if "MONGO" in m.upper() or "DB" in m.upper():
                                process_env_refs.add(m)
                except:
                    pass

    best_var = "MONGO_URI"
    best_val = ""
    for k, v in env_vars.items():
        if v.startswith("mongodb://") or v.startswith("mongodb+srv://"):
            best_var = k
            best_val = v
            break
    
    if not best_val and process_env_refs:
        for ref in process_env_refs:
            if "MONGO" in ref:
                best_var = ref
                break
        if best_var == "MONGO_URI" and len(process_env_refs) > 0:
             # Just pick the first DB one if no MONGO found
             best_var = list(process_env_refs)[0]

    db_name = "app"
    options = ""
    if best_val:
        import urllib.parse
        try:
            parsed = urllib.parse.urlparse(best_val)
            if parsed.path and parsed.path != "/":
                db_name = parsed.path.lstrip("/")
            if parsed.query:
                options = parsed.query
        except:
            pass

    return {"env_var": best_var, "db_name": db_name, "options": options}

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
    port = _find_express_port(project_path)
    mongo_config = _discover_mongo_config(project_path)
    return {"entry_file": entry, "backend_internal_port": port, "mongo_config": mongo_config}

registry.register(Adapter("express", detect_express, extract_express))
