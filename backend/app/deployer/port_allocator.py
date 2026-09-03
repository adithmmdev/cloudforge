import os
from sqlalchemy.orm import Session
from app.models.container import Container
from app.models.deployment import Deployment
from app.models.instance import Instance

from sqlalchemy import text

PORT_POOL_START = int(os.getenv("PORT_POOL_START", 8000))
PORT_POOL_END = int(os.getenv("PORT_POOL_END", 9000))

def allocate_port(db: Session, instance_id: int) -> int:
    """Finds the next available port for a given instance."""
    # Serialize port allocation to prevent race conditions
    db.execute(text("SELECT pg_advisory_xact_lock(54321)"))
    
    # Find all ports currently in use on this instance
    used_ports = db.query(Container.host_port).join(
        Deployment, Container.deployment_id == Deployment.id
    ).filter(
        Deployment.instance_id == instance_id,
        Deployment.status != 'failed',
        Container.host_port.isnot(None)
    ).all()
    
    used_ports_set = {p[0] for p in used_ports}
    
    for port in range(PORT_POOL_START, PORT_POOL_END + 1):
        if port not in used_ports_set:
            return port
            
    raise RuntimeError(f"No available ports on instance {instance_id}")

def assign_ports_to_deployment(db: Session, deployment: Deployment):
    if deployment.deployment_type == 'mern':
        port = allocate_port(db, deployment.instance_id)
        for container in deployment.containers:
            if container.service_name == 'client':
                container.host_port = port
            else:
                container.host_port = None
    else:
        port = allocate_port(db, deployment.instance_id)
        for container in deployment.containers:
            container.host_port = port
            
    db.commit()
