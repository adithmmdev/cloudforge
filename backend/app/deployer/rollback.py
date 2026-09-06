import os
import subprocess
import paramiko
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.container import Container
from app.models.instance import Instance
from app.models.aws_setup_state import AWSSetupState
from app.models.project import Project
import logging
import time

logger = logging.getLogger(__name__)

def trigger_rollback(db: Session, deployment_id: int):
    failed_deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not failed_deployment:
        raise ValueError("Deployment not found")
        
    project = db.query(Project).filter(Project.id == failed_deployment.project_id).first()
    if not project:
        raise ValueError("Project not found")
    
    # Wait for the status to be set properly before fetching prev
    time.sleep(1)
    
    # Find previous successful deployment
    prev_deployment = db.query(Deployment).filter(
        Deployment.project_id == failed_deployment.project_id,
        Deployment.id < deployment_id,
        Deployment.status == 'live'
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
        is_local = os.getenv("LOCAL_MODE", "false").lower() == "true"
        if failed_deployment.deployment_type == 'mern':
            logger.info("Rolling back MERN deployment")
            
            if is_local:
                cwd = f"/app/uploads/{project.name}"

                subprocess.run(["docker", "compose", "-p", f"cloudforge-{project.id}-{deployment_id}", "down"], cwd=cwd)
                # We can't easily jump to a previous directory in local mode unless it was backed up
                # We will attempt to use the previous deployment id if we stored it
            else:
                ssh.exec_command(f"cd proj_{project.id}_{deployment_id} && docker compose down")
                
                prev_dir = f"proj_{project.id}_{prev_deployment.id}"
                stdin, stdout, stderr = ssh.exec_command(f"cd {prev_dir} && docker compose up -d")
                if stdout.channel.recv_exit_status() != 0:
                    raise RuntimeError(f"Rollback compose up failed: {stderr.read().decode()}")
                
        else:
            logger.info("Rolling back single container deployment")
            if is_local:

                subprocess.run(["docker", "stop", f"proj_{project.id}_{deployment_id}"])
                subprocess.run(["docker", "rm", "-f", f"proj_{project.id}_{deployment_id}"])
            else:
                ssh.exec_command(f"docker stop proj_{project.id}_{deployment_id}")
                ssh.exec_command(f"docker rm -f proj_{project.id}_{deployment_id}")
            
            if not prev_deployment.containers:
                raise RuntimeError("Previous deployment has no containers")
                
            prev_container = prev_deployment.containers[0]
            tag = prev_container.image_tag
            port = prev_container.host_port if prev_container.host_port else 80
            
            run_command = f"docker run -d -p {port}:8000 --memory=256m --cpus=0.5 --pids-limit=100 --name proj_{project.id}_{prev_deployment.id}_rollback {tag}"
            if is_local:

                subprocess.run(run_command.split())
            else:
                stdin, stdout, stderr = ssh.exec_command(run_command)
                if stdout.channel.recv_exit_status() != 0:
                    raise RuntimeError(f"Rollback run failed: {stderr.read().decode()}")
                
        failed_deployment.status = 'rolled_back'
        db.commit()
        return True
    finally:
        ssh.close()
