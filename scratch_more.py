import os, zipfile, tempfile, requests, time, websocket, json

def build_zip(source_dir):
    fd, path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(source_dir):
            if '.pytest_cache' in root or '__pycache__' in root:
                continue
            for file in files:
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, source_dir)
                zipf.write(filepath, arcname)
    return path

def deploy_project(project_name, source_dir):
    zip_path = build_zip(source_dir)
    print(f"Zip created: {zip_path}")
    
    with open(zip_path, 'rb') as f:
        upload_res = requests.post("http://localhost:8000/api/projects/upload", files={'file': (f'{project_name}.zip', f, 'application/zip')})
    os.remove(zip_path)
    
    if upload_res.status_code != 200:
        print(f"Failed to upload {project_name}: {upload_res.text}")
        return False
        
    project_id = upload_res.json()['id']
    print(f"Project '{project_name}' uploaded. ID: {project_id}")
    
    requests.post(f"http://localhost:8000/api/projects/{project_id}/autonomy", json={'mode': 'full_auto'})
    
    deploy_res = requests.post(f"http://localhost:8000/api/projects/{project_id}/deploy")
    deployment_id = deploy_res.json()['deployment_id']
    print(f"Deployment initiated. ID: {deployment_id}")
    
    ws = websocket.WebSocket()
    ws.connect(f"ws://localhost:8000/api/ws/deployments/{deployment_id}")
    
    while True:
        try:
            msg = ws.recv()
            data = json.loads(msg)
            print(f"WS: {data}")
            if data.get('event') == 'status':
                if data['status'] == 'live':
                    print(f"Project {project_name} successfully reached LIVE state.")
                    return True
                elif data['status'] == 'failed':
                    print(f"Project {project_name} failed deployment.")
                    return False
        except Exception as e:
            print(f"WS error: {e}")
            break

for fixture in ["flask-sample", "react-sample"]:
    source_dir = os.path.join("backend", "tests", "fixtures", fixture)
    deploy_project(fixture, source_dir)
