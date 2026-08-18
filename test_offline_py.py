import os, subprocess

def test_pip():
    test_dir = "/app/uploads/pip-test"
    os.makedirs(test_dir, exist_ok=True)
    with open(os.path.join(test_dir, "requirements.txt"), "w") as f:
        f.write("Flask==2.0.1\n")
    
    # 1. Materialize Step (Network ON)
    print("Running materialize step (network ON)...")
    res1 = subprocess.run([
        "docker", "run", "--rm", "--network=default", 
        "-v", "cloud_forge_uploads:/app/uploads", "-w", "/app/uploads/pip-test", 
        "python:3.12-slim", "sh", "-c", "pip download -r requirements.txt -d .cf_deps"
    ], capture_output=True, text=True)
    print("MAT RETURN:", res1.returncode)
    if res1.returncode != 0:
        print("MAT ERR:", res1.stderr)
        return

    # 2. Real Install Step (Network OFF)
    print("Running offline install step (network OFF)...")
    res2 = subprocess.run([
        "docker", "run", "--rm", "--network=none", 
        "-v", "cloud_forge_uploads:/app/uploads", "-w", "/app/uploads/pip-test", 
        "python:3.12-slim", "pip", "install", "--no-index", "--find-links=./.cf_deps", "-r", "requirements.txt"
    ], capture_output=True, text=True)
    print("OFFLINE RETURN:", res2.returncode)
    print("OFFLINE STDOUT:", res2.stdout)
    print("OFFLINE STDERR:", res2.stderr)

if __name__ == "__main__":
    test_pip()
