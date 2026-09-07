import os
import subprocess
import paramiko
import time
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.aws_setup_state import AWSSetupState
from app.models.stage_event import StageEvent
from app.deployer.ec2_provisioner import provision_instance
from app.build_service.builder import build_project
import logging

logger = logging.getLogger(__name__)

class DeploymentError(Exception):
    def __init__(self, message, exit_code=1):
        super().__init__(message)
        self.exit_code = exit_code

def _record_stage(db: Session, deployment: Deployment, stage: str, detail: str) -> None:
    db.add(StageEvent(deployment_id=deployment.id, stage=stage, detail=detail))
    db.commit()

def run_deployment_pipeline(db: Session, deployment_id: int):
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        raise ValueError(f"Deployment {deployment_id} not found")
        
    project = db.query(Project).filter(Project.id == deployment.project_id).first()
    if not project:
        raise ValueError(f"Project not found for deployment {deployment_id}")
        
    try:
        is_local = os.getenv("LOCAL_MODE", "false").lower() == "true"
        
        # Step 1: Provision EC2
        _record_stage(db, deployment, "provisioning", "Resolving a CloudForge-managed EC2 instance")
        logger.info(f"Deployment {deployment_id}: Provisioning EC2 instance")
        if not is_local:
            instance = provision_instance(db, deployment_id=deployment.id)
            db.commit()
            
        # Step 2: Build Image
        deployment.status = "building"
        _record_stage(db, deployment, "detecting", "Detecting the uploaded project framework")
        logger.info(f"Deployment {deployment_id}: Building project image")
        project_path = os.path.join("/app/uploads", project.name)
        if not os.path.exists(project_path):
            project_path = os.path.join(os.getenv("FIXTURES_DIR", "tests/fixtures"), project.name)
            
        from app.detector.registry import registry
        adapter, extracted_info = registry.detect(project_path)
        if not adapter:
            raise RuntimeError("Framework detection failed before build")

        from app.models.container import Container
        existing_ports = [
            c.host_port for d in db.query(Deployment).filter(Deployment.instance_id == deployment.instance_id, Deployment.status.in_(['live', 'building', 'deploying', 'health_check', 'healing'])).all()
            for c in d.containers if c.host_port is not None
        ]
        assigned_port = 8000
        while assigned_port in existing_ports and assigned_port < 8100:
            assigned_port += 1

        extracted_info['host_port'] = assigned_port

        log_lines = []
        def build_logger(msg, service=None):
            line = f"[{service}] {msg}" if service else msg
            logger.info(f"BUILD LOG: {line}")
            log_lines.append(line)
            if len(log_lines) > 100:
                log_lines.pop(0)
            try:
                detail = f"{service}:{msg}" if service else msg
                db.add(StageEvent(deployment_id=deployment_id, stage='log', detail=detail))
                db.commit()
            except Exception:
                pass

        _record_stage(db, deployment, "building", f"Building {adapter.name} deployment image(s)")
        build_result = build_project(
            project_path=project_path,
            project_id=str(project.id),
            deployment_id=str(deployment_id),
            adapter_name=adapter.name,
            extracted_info=extracted_info,
            log_callback=build_logger
        )
        if build_result.get("status") == "failed":
            raise RuntimeError(f"Build failed: {build_result.get('error')}")
            
        image_tags = build_result.get("images", [])
        if not image_tags:
            raise RuntimeError("Build succeeded but no images returned")
            
        # Step 3: Transfer Image (skip if local)
        _record_stage(db, deployment, "deploying", "Transferring and starting deployment containers")
        
        from app.models.container import Container
        for img in image_tags:
            c = Container(
                deployment_id=deployment.id,
                service_name=img.split(":")[0],
                image_tag=img,
                status="running"
            )
            if "client" in img or "react" in img or "express" in img or "fastapi" in img or "flask" in img:
                c.host_port = assigned_port
            db.add(c)
        db.commit()
        
        if not is_local:
            setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
            key_path = setup_state.ssh_key_path if setup_state else os.getenv("EC2_SSH_KEY_PATH", "keys/cloudforge-key.pem")
            
            for image_tag in image_tags:
                logger.info(f"Deployment {deployment_id}: Transferring image {image_tag}")
                # Use scp for reliable transfer instead of pipe over ssh (fixes Docker Desktop MTU stalls)
                tar_file = f"/tmp/{image_tag.replace(':', '_')}.tar"
                save_cmd = ["docker", "save", "-o", tar_file, image_tag]
                res = subprocess.run(save_cmd, capture_output=True)
                if res.returncode != 0:
                    raise DeploymentError(f"Docker save failed: {res.stderr.decode()}", res.returncode)
                
                scp_cmd = ["scp", "-O", "-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3", "-i", key_path, tar_file, f"ubuntu@{instance.public_ip}:/tmp/image.tar"]
                res = subprocess.run(scp_cmd, capture_output=True)
                if res.returncode != 0:
                    raise DeploymentError(f"SCP failed: {res.stderr.decode()}", res.returncode)
                
                ssh_load_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3", "-i", key_path, f"ubuntu@{instance.public_ip}", f"docker load -i /tmp/image.tar && rm -f /tmp/image.tar"]
                res = subprocess.run(ssh_load_cmd, capture_output=True)
                if res.returncode != 0:
                    raise DeploymentError(f"Docker load failed: {res.stderr.decode()}", res.returncode)
                
        # Step 4: Launch Container
        logger.info(f"Deployment {deployment_id}: Launching container")
        
        if deployment.deployment_type == 'mern':
            if is_local:
                run_cmd = ["docker", "compose", "-p", f"cloudforge-{project.id}-{deployment_id}", "up", "-d"]
                cwd = project_path
            else:
                run_command = f"docker compose -p cloudforge-{project.id}-{deployment_id} up -d"
        else:
            main_image = image_tags[0]
            from app.models.remediation_action import RemediationAction
            mem_limit = "256m"
            restart_policy = ""
            
            promoted_actions = db.query(RemediationAction).filter(
                RemediationAction.deployment_id == deployment_id,
                RemediationAction.status == 'promoted'
            ).all()
            
            for action in promoted_actions:
                if action.action_type == "INCREASE_MEMORY_LIMIT":
                    mem_limit = f"{action.params.get('mb', 512)}m"
                elif action.action_type == "RESTART_SERVICE":
                    restart_policy = "--restart always"
                    
            if is_local:
                subprocess.run(["docker", "rm", "-f", f"proj_{project.id}_{deployment_id}"], capture_output=True)
                run_cmd = ["docker", "run", "-d", "-p", "80:8000"]
                if restart_policy:
                    run_cmd.extend(["--restart", "always"])
                run_cmd.extend([f"--memory={mem_limit}", "--cpus=0.5", "--pids-limit=100", "--name", f"proj_{project.id}_{deployment_id}", main_image])
            else:
                ssh.exec_command(f"docker rm -f proj_{project.id}_{deployment_id}")
                run_command = f"docker run -d -p {assigned_port}:{extracted_info.get('backend_internal_port', 8000)} {restart_policy} --memory={mem_limit} --cpus=0.5 --pids-limit=100 --name proj_{project.id}_{deployment_id} {main_image}"
            
        if is_local:
            kwargs = {}
            if deployment.deployment_type == 'mern':
                kwargs['cwd'] = cwd
            res = subprocess.run(run_cmd, capture_output=True, text=True, **kwargs)
            if res.returncode != 0:
                raise DeploymentError(f"Failed to launch container locally: {res.stderr}", res.returncode)
                
            # Wait and check if it crashed immediately
            time.sleep(15)
            if deployment.deployment_type == 'mern':
                check_res = subprocess.run(["docker", "compose", "-p", f"cloudforge-{project.id}-{deployment_id}", "ps", "-q"], cwd=cwd, capture_output=True, text=True)
                if not check_res.stdout.strip():
                    logs = subprocess.run(["docker", "compose", "-p", f"cloudforge-{project.id}-{deployment_id}", "logs"], cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout
                    raise RuntimeError(f"Containers exited immediately after start. Logs:\n{logs}")
            else:
                container_name = f"proj_{project.id}_{deployment_id}"
                check_res = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", container_name], capture_output=True, text=True)
                if "true" not in check_res.stdout.lower():
                    logs = subprocess.run(["docker", "logs", container_name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout
                    subprocess.run(["docker", "rm", "-f", container_name])
                    raise RuntimeError(f"Container exited immediately after start. Logs:\n{logs}")
        else:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(instance.public_ip, username='ubuntu', key_filename=key_path)
            
            if deployment.deployment_type == 'mern':
                proj_dir = f"proj_{project.id}_{deployment_id}"
                ssh.exec_command(f"mkdir -p {proj_dir}")
                sftp = ssh.open_sftp()
                sftp.put(os.path.join(project_path, "docker-compose.yml"), f"{proj_dir}/docker-compose.yml")
                sftp.close()
                run_command = f"cd {proj_dir} && docker compose up -d"

            stdin, stdout, stderr = ssh.exec_command(run_command)
            exit_status = stdout.channel.recv_exit_status()
            if exit_status != 0:
                err_msg = stderr.read().decode()
                ssh.close()
                raise DeploymentError(f"Failed to launch container: {err_msg}", exit_status)
                
            # Clean up old unused images to prevent disk space exhaustion
            ssh.exec_command("docker image prune -a -f")
            ssh.close()
        
        logger.info(f"Deployment {deployment_id} completed successfully")
        deployment.status = "deployed"
        db.commit()
        return {"status": "deployed"}
        
    except Exception as e:
        import traceback
        full_err = str(e)
        if 'log_lines' in locals() and log_lines:
            full_err += "\n\nBuild Logs:\n" + "\n".join(log_lines)
            
        logger.error(f"Deployment {deployment_id} failed: {full_err}\n{traceback.format_exc()}")
        deployment.status = "failed"
        db.add(StageEvent(deployment_id=deployment.id, stage="failed", detail=full_err))
        db.commit()
        exit_code = getattr(e, 'exit_code', 1)
        raise DeploymentError(full_err, exit_code) from e
