import os
import subprocess
import shutil

def run_cmd(cmd, cwd=None):
    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=True)

# Client
os.makedirs("tmp_cache_client", exist_ok=True)
shutil.copy(r"backend\tests\fixtures\mern-sample\client\package.json", r"tmp_cache_client\package.json")
with open("tmp_cache_client/Dockerfile", "w") as f:
    f.write("""FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
""")
run_cmd(["docker", "build", "-t", "cache-client", "tmp_cache_client"])

# Server
os.makedirs("tmp_cache_server", exist_ok=True)
shutil.copy(r"backend\tests\fixtures\mern-sample\server\package.json", r"tmp_cache_server\package.json")
with open("tmp_cache_server/Dockerfile", "w") as f:
    f.write("""FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
""")
run_cmd(["docker", "build", "-t", "cache-server", "tmp_cache_server"])
print("Cache primed successfully!")
