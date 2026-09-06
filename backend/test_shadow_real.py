import os
import sys
from app.build_service.builder import build_project

def test():
    project_path = "/app/uploads/smart-ai-proctorin"
    if not os.path.exists(project_path):
        print("smart-ai-proctorin not found!")
        sys.exit(1)
        
    def log_cb(msg, service=None):
        if service:
            print(f"[{service}] {msg}")
        else:
            print(msg)
            
    extracted_info = {
        "client": {"build_output_dir": "dist"},
        "server": {"entry_file": "server.js", "backend_internal_port": "5000"},
        "host_port": "8000"
    }
        
    try:
        build_project(project_path, "144", "testdep1", "mern", extracted_info, log_cb)
        print("Build succeeded!")
    except Exception as e:
        print(f"Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test()
