import subprocess
import time
import requests
import os
from sqlalchemy.orm import Session
from app.models.shadow_test import ShadowTest
import logging

def log_test(db, action_id, name, passed, output):
    from app.models.shadow_test import ShadowTest
    st = ShadowTest(
        remediation_action_id=action_id,
        test_name=name,
        passed=passed,
        output=str(output)[:4000] if output else ""
    )
    db.add(st)
    db.commit()


logger = logging.getLogger(__name__)

def run_shadow_verification(db: Session, remediation_action_id: int, project_dir: str, deployment_type: str, framework: str) -> bool:
    success = True
    container_name = None
    
    try:
        if deployment_type == "mern":
            from app.build_service.builder import materialize_dependencies
            materialize_dependencies(project_dir, "mern")
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
                        log_test(db, remediation_action_id, f"build_{svc}", False, res.stderr)
                        return False
                    else:
                        log_test(db, remediation_action_id, f"build_{svc}", True, f"Image {img_name} built")
                        
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
                    
            res = subprocess.run(["docker", "compose", "-p", f"shadow_{remediation_action_id}", "up", "-d"], cwd=project_dir, capture_output=True, text=True)
            if res.returncode != 0:
                log_test(db, remediation_action_id, "run", False, res.stderr)
                return False
            else:
                log_test(db, remediation_action_id, "run", True, "Containers started")
        else:
            from app.build_service.builder import materialize_dependencies
            materialize_dependencies(project_dir, framework)
            img_name = f"shadow_img_{remediation_action_id}"
            res = subprocess.run([
                "docker", "build", "--network=none", "--memory=2g", "--cpu-quota=100000",
                "-t", img_name, "."
            ], cwd=project_dir, capture_output=True, text=True)
            if res.returncode != 0:
                log_test(db, remediation_action_id, "build", False, res.stderr)
                return False
            else:
                log_test(db, remediation_action_id, "build", True, f"Image {img_name} built")
            
            container_name = f"shadow_cnt_{remediation_action_id}"
            
            from app.models.remediation_action import RemediationAction
            rem_action = db.query(RemediationAction).filter(RemediationAction.id == remediation_action_id).first()
            mem_limit = "256m"
            restart_policy = ""
            
            if rem_action:
                if rem_action.action_type == "INCREASE_MEMORY_LIMIT":
                    mem_limit = f"{rem_action.params.get('mb', 512)}m"
                elif rem_action.action_type == "RESTART_SERVICE":
                    restart_policy = "--restart always"
                    
            cmd = ["docker", "run", "-d", "-P", f"--memory={mem_limit}", "--cpus=0.5", "--pids-limit=100"]
            if restart_policy:
                cmd.extend(["--restart", "always"])
            cmd.extend(["--name", container_name, img_name])
            
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                log_test(db, remediation_action_id, "run", False, res.stderr)
                return False
            else:
                log_test(db, remediation_action_id, "run", True, "Containers started")


        # Wait for container to settle
        time.sleep(15)
        
        if deployment_type == "mern":
            res = subprocess.run(["docker", "compose", "-p", f"shadow_{remediation_action_id}", "ps", "-q"], cwd=project_dir, capture_output=True, text=True)
            if not res.stdout.strip():
                log_test(db, remediation_action_id, "stay_running_15s", False, "Containers exited")
                success = False
            else:
                log_test(db, remediation_action_id, "stay_running_15s", True, "Running")
        else:
            res = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", container_name], capture_output=True, text=True)
            if "true" not in res.stdout.lower():
                log_test(db, remediation_action_id, "stay_running_15s", False, "Container exited")
                success = False
            else:
                log_test(db, remediation_action_id, "stay_running_15s", True, "Running")
                
        if success:
            if deployment_type == "mern":
                res = subprocess.run(["docker", "compose", "-p", f"shadow_{remediation_action_id}", "port", "client", "80"], cwd=project_dir, capture_output=True, text=True)
                port_mapping = res.stdout.strip()
                if port_mapping:
                    port = port_mapping.split(":")[-1]
                    try:
                        r1 = requests.get(f"http://host.docker.internal:{port}/", timeout=10)
                        r2 = requests.get(f"http://host.docker.internal:{port}/api/health", timeout=10)
                        if r1.status_code == 200 and r2.status_code < 500:
                            log_test(db, remediation_action_id, "smoke_test", True, "200 OK")
                        else:
                            log_test(db, remediation_action_id, "smoke_test", False, f"client={r1.status_code}, api={r2.status_code}")
                            success = False
                    except Exception as e:
                        log_test(db, remediation_action_id, "smoke_test", False, str(e))
                        success = False
            else:
                res = subprocess.run(["docker", "port", container_name], capture_output=True, text=True)
                port_mappings = res.stdout.strip().split("\n")
                if port_mappings and port_mappings[0]:
                    port = port_mappings[0].split(":")[-1]
                    try:
                        r = requests.get(f"http://host.docker.internal:{port}/", timeout=10)
                        if framework == "react":
                            if r.status_code == 200 and 'id="root"' in r.text:
                                log_test(db, remediation_action_id, "smoke_test", True, "200 OK")
                            else:
                                log_test(db, remediation_action_id, "smoke_test", False, f"{r.status_code} - no root element")
                                success = False
                        else:
                            if r.status_code < 500:
                                log_test(db, remediation_action_id, "smoke_test", True, f"{r.status_code} OK")
                            else:
                                log_test(db, remediation_action_id, "smoke_test", False, f"Status {r.status_code}")
                                success = False
                    except Exception as e:
                        log_test(db, remediation_action_id, "smoke_test", False, str(e))
                        success = False
                        
    except Exception as e:
        logger.error(f"Shadow test failed: {e}")
        success = False
        log_test(db, remediation_action_id, "exception", False, str(e))
    finally:
        if deployment_type == "mern":
            subprocess.run(["docker", "compose", "-p", f"shadow_{remediation_action_id}", "down", "-v", "--remove-orphans"], cwd=project_dir, capture_output=True)
        elif container_name:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            

        
    return success
