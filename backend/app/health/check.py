import time
import requests
import socket
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.container import Container
from app.models.instance import Instance

def check_deployment_health(db: Session, deployment_id: int) -> dict:
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        return {"passed": False, "method": "none", "ms": 0, "error": "deployment_not_found"}
        
    instance = db.query(Instance).filter(Instance.id == deployment.instance_id).first()
    if not instance or not instance.public_ip:
        return {"passed": False, "method": "none", "ms": 0, "error": "instance_ip_not_found"}
        
    target_container = next((c for c in deployment.containers if ("client" in c.service_name or "app" in c.service_name or c.service_name == deployment.project.name) and c.host_port), None)
    if not target_container:
        target_container = next((c for c in deployment.containers if c.host_port), None)
    if not target_container:
        return {"passed": False, "method": "none", "ms": 0, "error": "no_target_container"}
        
    ip = instance.public_ip
    port = target_container.host_port
    
    # Tier 1 (0-10s): GET /health
    for _ in range(5):
        try:
            start = time.time()
            res = requests.get(f"http://{ip}:{port}/health", timeout=1)
            ms = int((time.time() - start) * 1000)
            if 200 <= res.status_code < 300:
                deployment.health_check_result = "passed"
                deployment.health_check_method = "HTTP GET /health"
                deployment.health_check_ms = ms
                db.commit()
                return {"passed": True, "method": "HTTP GET /health", "ms": ms}
        except Exception:
            pass
        time.sleep(2)
        
    # Tier 2 (10-20s): GET /
    for _ in range(5):
        try:
            start = time.time()
            res = requests.get(f"http://{ip}:{port}/", timeout=1)
            ms = int((time.time() - start) * 1000)
            if res.status_code < 500:
                deployment.health_check_result = "passed"
                deployment.health_check_method = "HTTP GET /"
                deployment.health_check_ms = ms
                db.commit()
                return {"passed": True, "method": "HTTP GET /", "ms": ms}
        except Exception:
            pass
        time.sleep(2)
        
    # Tier 3 (20-30s): Raw TCP connect
    for _ in range(5):
        try:
            start = time.time()
            with socket.create_connection((ip, port), timeout=1):
                ms = int((time.time() - start) * 1000)
                deployment.health_check_result = "passed"
                deployment.health_check_method = "TCP"
                deployment.health_check_ms = ms
                db.commit()
                return {"passed": True, "method": "TCP", "ms": ms}
        except Exception:
            pass
        time.sleep(2)
        
    deployment.health_check_result = "failed"
    deployment.health_check_method = "TCP/HTTP"
    deployment.health_check_ms = 0
    db.commit()
    return {"passed": False, "method": "none", "ms": 0, "error": "timeout_or_unreachable"}
