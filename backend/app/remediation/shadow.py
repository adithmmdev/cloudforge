import subprocess
import time
import requests
from sqlalchemy.orm import Session
from app.models.shadow_test import ShadowTest
import logging

logger = logging.getLogger(__name__)

def run_shadow_verification(db: Session, remediation_action_id: int, project_dir: str, deployment_type: str, framework: str) -> bool:
    tests = []
    success = True
    
    try:
        if deployment_type == "mern":
            # For MERN, we need to build client and server with limits, then update compose or just use compose build?
            # Actually, we can just run docker build manually for client and server.
            for svc in ["client", "server"]:
                svc_dir = os.path.join(project_dir, svc)
                img_name = f"shadow_{svc}_{remediation_action_id}"
                if os.path.exists(svc_dir):
                    res = subprocess.run([
                        "docker", "build", "--network=none", "--memory=2g", "--cpu-quota=100000",
                        "-t", img_name, "."
                    ], cwd=svc_dir, capture_output=True, text=True)
                    if res.returncode != 0:
                        tests.append({"name": f"build_{svc}", "passed": False, "output": res.stderr})
                        return False
                        
            # Now we need to start them. The easiest is to replace image names in docker-compose.yml
            compose_file = os.path.join(project_dir, "docker-compose.yml")
            if os.path.exists(compose_file):
                with open(compose_file, "r") as f:
                    content = f.read()
                # Replace image tags with shadow tags
                import re
                content = re.sub(r'image:\s*cloudforge-\d+-client:\d+', f'image: shadow_client_{remediation_action_id}', content)
                content = re.sub(r'image:\s*cloudforge-\d+-server:\d+', f'image: shadow_server_{remediation_action_id}', content)
                with open(compose_file, "w") as f:
                    f.write(content)
                    
            res = subprocess.run(["docker", "compose", "up", "-d"], cwd=project_dir, capture_output=True, text=True)
            if res.returncode != 0:
                tests.append({"name": "run", "passed": False, "output": res.stderr})
                return False
        else:
            img_name = f"shadow_img_{remediation_action_id}"
            res = subprocess.run([
                "docker", "build", "--network=none", "--memory=2g", "--cpu-quota=100000",
                "-t", img_name, "."
            ], cwd=project_dir, capture_output=True, text=True)
            if res.returncode != 0:
                tests.append({"name": "build", "passed": False, "output": res.stderr})
                return False
            
            container_name = f"shadow_cnt_{remediation_action_id}"
            res = subprocess.run(["docker", "run", "-d", "-P", "--name", container_name, img_name], capture_output=True, text=True)
            if res.returncode != 0:
                tests.append({"name": "run", "passed": False, "output": res.stderr})
                return False


        # Wait for container to settle
        time.sleep(15)
        
        if deployment_type == "mern":
            res = subprocess.run(["docker", "compose", "ps", "-q"], cwd=project_dir, capture_output=True, text=True)
            if not res.stdout.strip():
                tests.append({"name": "stay_running_15s", "passed": False, "output": "Containers exited"})
                success = False
            else:
                tests.append({"name": "stay_running_15s", "passed": True, "output": "Running"})
        else:
            res = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", container_name], capture_output=True, text=True)
            if "true" not in res.stdout.lower():
                tests.append({"name": "stay_running_15s", "passed": False, "output": "Container exited"})
                success = False
            else:
                tests.append({"name": "stay_running_15s", "passed": True, "output": "Running"})
                
        if success:
            if deployment_type == "mern":
                res = subprocess.run(["docker", "compose", "port", "client", "80"], cwd=project_dir, capture_output=True, text=True)
                port_mapping = res.stdout.strip()
                if port_mapping:
                    port = port_mapping.split(":")[-1]
                    try:
                        r1 = requests.get(f"http://localhost:{port}/", timeout=10)
                        r2 = requests.get(f"http://localhost:{port}/api/health", timeout=10)
                        if r1.status_code == 200 and r2.status_code < 500:
                            tests.append({"name": "smoke_test", "passed": True, "output": "200 OK"})
                        else:
                            tests.append({"name": "smoke_test", "passed": False, "output": f"client={r1.status_code}, api={r2.status_code}"})
                            success = False
                    except Exception as e:
                        tests.append({"name": "smoke_test", "passed": False, "output": str(e)})
                        success = False
            else:
                res = subprocess.run(["docker", "port", container_name], capture_output=True, text=True)
                port_mappings = res.stdout.strip().split("\n")
                if port_mappings and port_mappings[0]:
                    port = port_mappings[0].split(":")[-1]
                    try:
                        r = requests.get(f"http://localhost:{port}/", timeout=10)
                        if framework == "react":
                            if r.status_code == 200 and 'id="root"' in r.text:
                                tests.append({"name": "smoke_test", "passed": True, "output": "200 OK"})
                            else:
                                tests.append({"name": "smoke_test", "passed": False, "output": f"{r.status_code} - no root element"})
                                success = False
                        else:
                            if r.status_code < 500:
                                tests.append({"name": "smoke_test", "passed": True, "output": f"{r.status_code} OK"})
                            else:
                                tests.append({"name": "smoke_test", "passed": False, "output": f"Status {r.status_code}"})
                                success = False
                    except Exception as e:
                        tests.append({"name": "smoke_test", "passed": False, "output": str(e)})
                        success = False
                        
    except Exception as e:
        logger.error(f"Shadow test failed: {e}")
        success = False
        tests.append({"name": "exception", "passed": False, "output": str(e)})
    finally:
        if deployment_type == "mern":
            subprocess.run(["docker", "compose", "down"], cwd=project_dir, capture_output=True)
        else:
            container_name = f"shadow_cnt_{remediation_action_id}"
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            
        for t in tests:
            st = ShadowTest(
                remediation_action_id=remediation_action_id,
                test_name=t["name"],
                passed=t["passed"],
                output=t["output"]
            )
            db.add(st)
        db.commit()
        
    return success
