import os, subprocess, json

def test_npm():
    test_dir = "/app/uploads/npm-test"
    os.makedirs(test_dir, exist_ok=True)
    with open(os.path.join(test_dir, "package.json"), "w") as f:
        json.dump({"dependencies": {"express": "^4.17.1"}}, f)
    
    # 1. Materialize Step (Network ON)
    print("Running materialize step (network ON)...")
    res1 = subprocess.run([
        "docker", "run", "--rm", "--network=default", 
        "-v", "cloud_forge_uploads:/app/uploads", "-w", "/app/uploads/npm-test", 
        "node:18-slim", "sh", "-c", "npm install --cache /app/uploads/npm-test/.cf_npm_cache && rm -rf node_modules"
    ], capture_output=True, text=True)
    print("MAT RETURN:", res1.returncode)
    if res1.returncode != 0:
        print("MAT ERR:", res1.stderr)
        return

    # 2. Real Install Step (Network OFF)
    print("Running offline install step (network OFF)...")
    res2 = subprocess.run([
        "docker", "run", "--rm", "--network=none", 
        "-v", "cloud_forge_uploads:/app/uploads", "-w", "/app/uploads/npm-test", 
        "node:18-slim", "npm", "install", "--cache", "/app/uploads/npm-test/.cf_npm_cache", "--prefer-offline", "--no-audit", "--offline"
    ], capture_output=True, text=True)
    print("OFFLINE RETURN:", res2.returncode)
    print("OFFLINE STDOUT:", res2.stdout)
    print("OFFLINE STDERR:", res2.stderr)
    
    # Check if node_modules/express exists
    print("EXPRESS EXISTS:", os.path.exists(os.path.join(test_dir, "node_modules", "express")))

if __name__ == "__main__":
    test_npm()
