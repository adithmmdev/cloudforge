import subprocess
import os

def test_docker_network_none_isolation():
    """Proves that a docker build with --network=none physically cannot access the internet."""
    
    dockerfile_content = """
FROM alpine:latest
# Attempt DNS resolution and HTTP request. Should fail.
RUN ping -c 1 google.com || exit 0
RUN wget -qO- https://google.com || exit 0
"""
    
    os.makedirs("/tmp/cf_isolation_test", exist_ok=True)
    with open("/tmp/cf_isolation_test/Dockerfile", "w") as f:
        f.write(dockerfile_content)
        
    res = subprocess.run([
        "docker", "build", "--network=none", "-t", "cf-isolation-test", "."
    ], cwd="/tmp/cf_isolation_test", capture_output=True, text=True)
    
    # Wait, if they return exit 0, the build succeeds. We just want to check they failed inside.
    # Actually, let's make it fail if it succeeds.
    
    dockerfile_content_fail_if_online = """
FROM alpine:latest
RUN ping -c 1 google.com && exit 1 || exit 0
RUN wget --timeout=2 -qO- https://google.com && exit 1 || exit 0
"""
    with open("/tmp/cf_isolation_test/Dockerfile", "w") as f:
        f.write(dockerfile_content_fail_if_online)
        
    res = subprocess.run([
        "docker", "build", "--network=none", "-t", "cf-isolation-test", "."
    ], cwd="/tmp/cf_isolation_test", capture_output=True, text=True)
    
    assert res.returncode == 0, f"Isolation test failed! Build output:\n{res.stdout}\n{res.stderr}"
