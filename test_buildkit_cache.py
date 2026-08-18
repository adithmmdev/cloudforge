import os
import subprocess
import time

def run_cmd(cmd, env_update=None):
    print(f"\n>> {' '.join(cmd)}")
    env = os.environ.copy()
    if env_update:
        env.update(env_update)
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    print("STDOUT:")
    print(result.stdout)
    if result.stderr:
        print("STDERR:")
        print(result.stderr)
    return result

print("=== Setting up test Dockerfile ===")
with open("Dockerfile.test", "w") as f:
    f.write("FROM alpine:latest\nRUN echo 'hello from RUN'\n")

print("\n=== Experiment 1: BuildKit with network enabled ===")
run_cmd(["docker", "build", "-t", "bk-net-1", "-f", "Dockerfile.test", "."], {"DOCKER_BUILDKIT": "1"})

print("\n=== Experiment 2: BuildKit with network enabled (checking cache) ===")
res2 = run_cmd(["docker", "build", "-t", "bk-net-2", "-f", "Dockerfile.test", "."], {"DOCKER_BUILDKIT": "1"})
if "CACHED" in res2.stderr or "CACHED" in res2.stdout or "DONE" in res2.stderr:
    print("-> Result: BuildKit SUCCESSFULLY cached the layer with same network mode.")

print("\n=== Experiment 3: BuildKit with --network=none (testing if cache is hit) ===")
res3 = run_cmd(["docker", "build", "--network=none", "-t", "bk-nonet-1", "-f", "Dockerfile.test", "."], {"DOCKER_BUILDKIT": "1"})
if "CACHED" not in res3.stderr and "CACHED" not in res3.stdout:
    print("-> Result: BuildKit MISSED the cache when --network=none was used!")
else:
    print("-> Result: BuildKit HIT the cache.")

print("\n=== Experiment 4: Legacy Builder with network enabled ===")
run_cmd(["docker", "build", "-t", "leg-net-1", "-f", "Dockerfile.test", "."], {"DOCKER_BUILDKIT": "0"})

print("\n=== Experiment 5: Legacy Builder with --network=none ===")
res5 = run_cmd(["docker", "build", "--network=none", "-t", "leg-nonet-1", "-f", "Dockerfile.test", "."], {"DOCKER_BUILDKIT": "0"})
if "Using cache" in res5.stdout or "Using cache" in res5.stderr:
    print("-> Result: Legacy builder HIT the cache despite --network=none.")
else:
    print("-> Result: Legacy builder MISSED the cache.")

print("\n=== Cleanup ===")
os.remove("Dockerfile.test")
