import os
import subprocess
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
    
    time.sleep(1)
    
    prev_deployment = db.query(Deployment).filter(
        Deployment.project_id == failed_deployment.project_id,
        Deployment.id < deployment_id,
        Deployment.status.in_(['live', 'deployed'])
    ).order_by(Deployment.id.desc()).first()
    
    if not prev_deployment:
        logger.warning(f"No previous deployment to rollback to for project {project.id}")
        return False
        
    instance = db.query(Instance).filter(Instance.id == failed_deployment.instance_id).first()
    if not instance or not instance.public_ip:
        raise RuntimeError("Instance IP not found")
        
    setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
    key_path = setup_state.ssh_key_path if setup_state else os.getenv("EC2_SSH_KEY_PATH", "keys/cloudforge-key.pem")
    
    def run_ssh(cmd):
        return subprocess.run(["ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", f"ubuntu@{instance.public_ip}", cmd], capture_output=True, text=True)
    
    try:
        is_local = os.getenv("LOCAL_MODE", "false").lower() == "true"
        if failed_deployment.deployment_type == 'mern':
            logger.info("Rolling back MERN deployment")
            
            if is_local:
                cwd = f"/app/uploads/{project.name}"
                subprocess.run(["docker", "compose", "-p", f"cloudforge-{project.id}-{deployment_id}", "down"], cwd=cwd)
            else:
                res = run_ssh(f"cd proj_{project.id}_{deployment_id} && docker compose down")
                if res.returncode != 0:
                    logger.warning(f"Failed to rollback deployment {deployment_id} containers: {res.stderr}")
                
                prev_dir = f"proj_{project.id}_{prev_deployment.id}"
                res = run_ssh(f"cd {prev_dir} && docker compose up -d")
                if res.returncode != 0:
                    raise RuntimeError(f"Rollback compose up failed: {res.stderr}")
                
        else:
            logger.info("Rolling back single container deployment")
            if is_local:
                subprocess.run(["docker", "stop", f"proj_{project.id}_{deployment_id}"])
                subprocess.run(["docker", "rm", "-f", f"proj_{project.id}_{deployment_id}"])
            else:
                run_ssh(f"docker stop proj_{project.id}_{deployment_id}")
                run_ssh(f"docker rm -f proj_{project.id}_{deployment_id}")
            
            if not prev_deployment.containers:
                raise RuntimeError("Previous deployment has no containers")
                
            prev_container = prev_deployment.containers[0]
            tag = prev_container.image_tag
            port = prev_container.host_port if prev_container.host_port else 80
            
            run_command = f"docker run -d -p {port}:8000 --memory=256m --cpus=0.5 --pids-limit=100 --name proj_{project.id}_{prev_deployment.id}_rollback {tag}"
            if is_local:
                subprocess.run(run_command.split())
            else:
                res = run_ssh(run_command)
                if res.returncode != 0:
                    raise RuntimeError(f"Rollback run failed: {res.stderr}")
                
        failed_deployment.status = 'rolled_back'
        db.commit()
        return True
    except Exception as e:
        import traceback
        logger.error(f"Error during rollback of {deployment_id}: {e}\n{traceback.format_exc()}")
        return False
