import os
import paramiko
import base64
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.container import Container
from app.models.instance import Instance
from app.models.aws_setup_state import AWSSetupState
from app.models.project import Project
import logging

logger = logging.getLogger(__name__)

def trigger_rollback(db: Session, deployment_id: int):
    failed_deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not failed_deployment:
        raise ValueError("Deployment not found")
        
    failed_deployment.status = 'failed'
    db.commit()
    
    project = db.query(Project).filter(Project.id == failed_deployment.project_id).first()
    if not project:
        raise ValueError("Project not found")
    
    # Find previous successful deployment
    prev_deployment = db.query(Deployment).filter(
        Deployment.project_id == failed_deployment.project_id,
        Deployment.id < deployment_id,
        Deployment.status == 'success'
    ).order_by(Deployment.id.desc()).first()
    
    if not prev_deployment:
        logger.warning(f"No previous deployment to rollback to for project {project.id}")
        return False
        
    instance = db.query(Instance).filter(Instance.id == failed_deployment.instance_id).first()
    if not instance or not instance.public_ip:
        raise RuntimeError("Instance IP not found")
        
    setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
    key_path = setup_state.ssh_key_path if setup_state else os.getenv("EC2_SSH_KEY_PATH", "keys/cloudforge-key.pem")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(instance.public_ip, username='ubuntu', key_filename=key_path)
    
    try:
        if failed_deployment.deployment_type == 'mern':
            logger.info("Rolling back MERN deployment")
            client_container = next((c for c in prev_deployment.containers if c.service_name == 'client'), None)
            server_container = next((c for c in prev_deployment.containers if c.service_name == 'server'), None)
            
            client_tag = client_container.image_tag if client_container else "client:latest"
            server_tag = server_container.image_tag if server_container else "server:latest"
            
            compose_content = f"""
version: '3.8'
services:
  client:
    image: {client_tag}
    ports:
      - "80:80"
  server:
    image: {server_tag}
  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
volumes:
  mongo_data:
"""
            # Preserve mongo volume by using 'down' without '-v'
            ssh.exec_command(f"docker compose -p cloudforge-{project.id} down")
            
            b64_compose = base64.b64encode(compose_content.encode()).decode()
            ssh.exec_command(f"echo {b64_compose} | base64 -d > docker-compose.yml")
            
            stdin, stdout, stderr = ssh.exec_command(f"docker compose -p cloudforge-{project.id} up -d")
            if stdout.channel.recv_exit_status() != 0:
                raise RuntimeError(f"Rollback compose up failed: {stderr.read().decode()}")
                
        else:
            logger.info("Rolling back single container deployment")
            ssh.exec_command(f"docker stop proj_{project.id}_{failed_deployment.id}")
            
            if not prev_deployment.containers:
                raise RuntimeError("Previous deployment has no containers")
                
            prev_container = prev_deployment.containers[0]
            tag = prev_container.image_tag
            
            run_command = f"docker run -d -p 80:8000 --name proj_{project.id}_{prev_deployment.id}_rollback {tag}"
            stdin, stdout, stderr = ssh.exec_command(run_command)
            if stdout.channel.recv_exit_status() != 0:
                raise RuntimeError(f"Rollback run failed: {stderr.read().decode()}")
                
        failed_deployment.status = 'rolled_back'
        db.commit()
        return True
    finally:
        ssh.close()
