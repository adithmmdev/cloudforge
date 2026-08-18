import os, subprocess, json

def test_npm():
    os.makedirs("/tmp/npm-test", exist_ok=True)
    with open("/tmp/npm-test/package.json", "w") as f:
        json.dump({"dependencies": {"express": "^4.17.1"}}, f)
    
    # 1. Materialize Step (Network ON)
    print("Running materialize step (network ON)...")
    res1 = subprocess.run([
        "docker", "run", "--rm", "--network=default", 
        "-v", "/tmp/npm-test:/app", "-w", "/app", 
        "node:18-slim", "sh", "-c", "npm install --cache /app/.cf_npm_cache && rm -rf /app/node_modules"
    ], capture_output=True, text=True)
    print("MAT RETURN:", res1.returncode)
    if res1.returncode != 0:
        print("MAT ERR:", res1.stderr)
        return

    # 2. Real Install Step (Network OFF)
    print("Running offline install step (network OFF)...")
    res2 = subprocess.run([
        "docker", "run", "--rm", "--network=none", 
        "-v", "/tmp/npm-test:/app", "-w", "/app", 
        "node:18-slim", "npm", "install", "--cache", "/app/.cf_npm_cache", "--prefer-offline", "--no-audit", "--offline"
    ], capture_output=True, text=True)
    print("OFFLINE RETURN:", res2.returncode)
    print("OFFLINE STDOUT:", res2.stdout)
    print("OFFLINE STDERR:", res2.stderr)

if __name__ == "__main__":
    test_npm()
