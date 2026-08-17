import os
import subprocess
import paramiko
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.aws_setup_state import AWSSetupState
from app.deployer.ec2_provisioner import provision_instance
from app.build_service.builder import build_project
import logging

logger = logging.getLogger(__name__)

def run_deployment_pipeline(db: Session, deployment_id: int):
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise ValueError(f"Deployment {deployment_id} not found")
        
    project = db.query(Project).filter(Project.id == deployment.project_id).first()
    if not project:
        raise ValueError(f"Project not found for deployment {deployment_id}")
        
    try:
        # Step 1: Provision EC2
        logger.info(f"Deployment {deployment_id}: Provisioning EC2 instance")
        instance = provision_instance(db)
        deployment.instance_id = instance.id
        db.commit()
        
        # Step 2: Build Image
        logger.info(f"Deployment {deployment_id}: Building project image")
        project_path = os.path.join(os.getenv("FIXTURES_DIR", "tests/fixtures"), project.name)
        if not os.path.exists(project_path):
            project_path = os.path.join("/tmp", project.name)
            
        build_result = build_project(project_path, deployment_id)
        if build_result.get("status") == "failed":
            raise RuntimeError(f"Build failed: {build_result.get('error')}")
            
        image_tags = build_result.get("images", [])
        if not image_tags:
            raise RuntimeError("Build succeeded but no images returned")
            
        # Step 3: Transfer Image
        setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
        key_path = setup_state.ssh_key_path if setup_state else os.getenv("EC2_SSH_KEY_PATH", "keys/cloudforge-key.pem")
        
        for image_tag in image_tags:
            logger.info(f"Deployment {deployment_id}: Transferring image {image_tag}")
            ssh_cmd = [
                "ssh", "-o", "StrictHostKeyChecking=no", "-i", key_path, 
                f"ubuntu@{instance.public_ip}", "docker", "load"
            ]
            save_cmd = ["docker", "save", image_tag]
            
            save_proc = subprocess.Popen(save_cmd, stdout=subprocess.PIPE)
            ssh_proc = subprocess.Popen(ssh_cmd, stdin=save_proc.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            save_proc.stdout.close()
            
            stdout, stderr = ssh_proc.communicate()
            if ssh_proc.returncode != 0:
                raise RuntimeError(f"Image transfer failed for {image_tag}: {stderr.decode()}")
            
        # Step 4: Launch Container
        logger.info(f"Deployment {deployment_id}: Launching container")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(instance.public_ip, username='ubuntu', key_filename=key_path)
        
        if deployment.deployment_type == 'mern':
            run_command = "docker compose up -d"
        else:
            main_image = image_tags[0]
            run_command = f"docker run -d -p 80:8000 --name proj_{project.id}_{deployment_id} {main_image}"
            
        stdin, stdout, stderr = ssh.exec_command(run_command)
        
        if stdout.channel.recv_exit_status() != 0:
            err_msg = stderr.read().decode()
            ssh.close()
            raise RuntimeError(f"Failed to launch container: {err_msg}")
            
        ssh.close()
        
        logger.info(f"Deployment {deployment_id} completed successfully")
        deployment.status = "success"
        db.commit()
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Deployment {deployment_id} failed: {str(e)}")
        deployment.status = "failed"
        db.commit()
        raise e
