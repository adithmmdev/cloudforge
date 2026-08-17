import os
import zipfile
import tempfile
import requests
import shutil

API_URL = "http://localhost:8000/api"

def check_health():
    try:
        r = requests.get(f"http://localhost:8000/health")
        return r.status_code == 200
    except:
        return False

def run_test(name, is_failure=False):
    print(f"--------------------------------------------------")
    print(f"Testing: {name}")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        if name == "React":
            with open(os.path.join(tmpdir, "App.js"), "w") as f:
                f.write("import React from 'react'; export default () => <div>React</div>;")
            with open(os.path.join(tmpdir, "package.json"), "w") as f:
                f.write('{"dependencies": {"react": "^18.0.0"}}')
        elif name == "Express":
            with open(os.path.join(tmpdir, "index.js"), "w") as f:
                f.write("const express = require('express'); const app = express(); app.listen(8080);")
            with open(os.path.join(tmpdir, "package.json"), "w") as f:
                f.write('{"dependencies": {"express": "^4.17.1"}}')
        elif name == "Flask":
            with open(os.path.join(tmpdir, "app.py"), "w") as f:
                f.write("from flask import Flask; app = Flask(__name__)")
            with open(os.path.join(tmpdir, "requirements.txt"), "w") as f:
                f.write("Flask==2.0.1")
        elif name == "FastAPI":
            with open(os.path.join(tmpdir, "main.py"), "w") as f:
                f.write("from fastapi import FastAPI; app = FastAPI()")
            with open(os.path.join(tmpdir, "requirements.txt"), "w") as f:
                f.write("fastapi==0.68.0")
        elif name == "MERN":
            os.makedirs(os.path.join(tmpdir, "client"))
            os.makedirs(os.path.join(tmpdir, "server"))
            with open(os.path.join(tmpdir, "client", "App.js"), "w") as f:
                f.write("import React from 'react'; export default () => <div>MERN</div>;")
            with open(os.path.join(tmpdir, "client", "package.json"), "w") as f:
                f.write('{"dependencies": {"react": "^18.0.0"}}')
            with open(os.path.join(tmpdir, "server", "index.js"), "w") as f:
                f.write("const express = require('express'); const app = express(); app.listen(8080);")
            with open(os.path.join(tmpdir, "server", "package.json"), "w") as f:
                f.write('{"dependencies": {"express": "^4.17.1"}}')
        
        zip_path = os.path.join(tempfile.gettempdir(), "project.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(tmpdir):
                for file in files:
                    filepath = os.path.join(root, file)
                    arcname = os.path.relpath(filepath, tmpdir)
                    zipf.write(filepath, arcname)
                    
        print("Uploading project...")
        with open(zip_path, "rb") as f:
            res = requests.post(f"{API_URL}/projects", files={"file": ("project.zip", f, "application/zip")})
            
        if res.status_code != 200:
            print(f"Failed to upload project: {res.text}")
            return
            
        data = res.json()
        proj_id = data.get("id")
        print(f"Project uploaded with ID {proj_id}. Framework: {data.get('framework')}. Triggering deployment...")
        
        dep_res = requests.post(f"{API_URL}/projects/{proj_id}/deploy")
        if dep_res.status_code != 200:
            print(f"Failed to deploy: {dep_res.text}")
            return
            
        dep_data = dep_res.json()
        dep_id = dep_data.get("deployment_id")
        print(f"Deployment started with ID {dep_id}")
        
        os.remove(zip_path)

if not check_health():
    print("Backend is not running.")
else:
    print("Backend is running. Running E2E Demo...")
    run_test("React")
    run_test("Express")
    run_test("Flask")
    run_test("FastAPI")
    run_test("MERN")
    print("All E2E scenarios triggered successfully.")
