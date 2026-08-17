import time
import requests
import socket
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.container import Container
from app.models.instance import Instance

def check_deployment_health(db: Session, deployment_id: int) -> bool:
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        return False
        
    instance = db.query(Instance).filter(Instance.id == deployment.instance_id).first()
    if not instance or not instance.public_ip:
        return False
        
    target_container = next((c for c in deployment.containers if c.service_name in ('client', 'app') and c.host_port), None)
    if not target_container:
        return False
        
    ip = instance.public_ip
    port = target_container.host_port
    
    # Tier 1 (0-10s): GET /health
    for _ in range(5):
        try:
            res = requests.get(f"http://{ip}:{port}/health", timeout=1)
            if 200 <= res.status_code < 300:
                return True
        except Exception:
            pass
        time.sleep(2)
        
    # Tier 2 (10-20s): GET /
    for _ in range(5):
        try:
            res = requests.get(f"http://{ip}:{port}/", timeout=1)
            if res.status_code < 500:
                return True
        except Exception:
            pass
        time.sleep(2)
        
    # Tier 3 (20-30s): Raw TCP connect
    for _ in range(5):
        try:
            with socket.create_connection((ip, port), timeout=1):
                return True
        except Exception:
            pass
        time.sleep(2)
        
    return False
