import time
import json
import paramiko
import os
from sqlalchemy.orm import Session
from app.models.container import Container
from app.models.deployment import Deployment
from app.models.instance import Instance
from app.models.metric import Metric
from app.models.aws_setup_state import AWSSetupState
import logging

logger = logging.getLogger(__name__)

def parse_memory(mem_str: str) -> float:
    # Example: 15.2MiB / 2GiB, we just want the 15.2MiB part
    usage_str = mem_str.split('/')[0].strip()
    if 'GiB' in usage_str:
        return float(usage_str.replace('GiB', '')) * 1024
    if 'MiB' in usage_str:
        return float(usage_str.replace('MiB', ''))
    if 'KiB' in usage_str:
        return float(usage_str.replace('KiB', '')) / 1024
    if 'B' in usage_str:
        return float(usage_str.replace('B', '')) / (1024*1024)
    return 0.0

def parse_network(net_str: str):
    # Example: 1.5kB / 2.0kB
    parts = net_str.split('/')
    if len(parts) != 2:
        return 0, 0
        
    def to_bytes(s: str) -> int:
        s = s.strip()
        if 'GB' in s or 'GiB' in s:
            return int(float(s[:-3] if s.endswith('iB') else s[:-2]) * 1024 * 1024 * 1024)
        if 'MB' in s or 'MiB' in s:
            return int(float(s[:-3] if s.endswith('iB') else s[:-2]) * 1024 * 1024)
        if 'kB' in s or 'KiB' in s:
            return int(float(s[:-3] if s.endswith('iB') else s[:-2]) * 1024)
        if 'B' in s:
            return int(float(s[:-1]))
        return 0
        
    return to_bytes(parts[0]), to_bytes(parts[1])

def poll_metrics_for_instance(db: Session, instance: Instance):
    setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
    key_path = setup_state.ssh_key_path if setup_state else os.getenv("EC2_SSH_KEY_PATH", "keys/cloudforge-key.pem")
    
    import subprocess
    
    try:
        active_deployments = db.query(Deployment).filter(
            Deployment.instance_id == instance.id,
            Deployment.status.in_(['deployed', 'live'])
        ).all()
        
        if not active_deployments:
            return
            
        cmd_docker = ["ssh", "-i", key_path, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", f"ubuntu@{instance.public_ip}", "docker stats --no-stream --format '{{json .}}'"]
        res = subprocess.run(cmd_docker, capture_output=True, text=True)
        if res.returncode != 0:
            logger.warning(f"Failed to run docker stats on {instance.public_ip}: {res.stderr}")
            return
            
        output = res.stdout
        
        stats_map = {}
        for line in output.strip().split('\n'):
            if not line:
                continue
            try:
                data = json.loads(line)
                name = data.get("Name", "")
                cpu_str = data.get("CPUPerc", "0%").replace('%', '')
                mem_str = data.get("MemUsage", "0B / 0B")
                net_str = data.get("NetIO", "0B / 0B")
                
                cpu = float(cpu_str) if cpu_str else 0.0
                mem = parse_memory(mem_str)
                net_in, net_out = parse_network(net_str)
                
                stats_map[name] = {
                    "cpu": cpu,
                    "mem": mem,
                    "net_in": net_in,
                    "net_out": net_out
                }
            except json.JSONDecodeError:
                pass
                
        for dep in active_deployments:
            for container in dep.containers:
                c_name = f"proj_{dep.project_id}_{dep.id}"
                c_name_compose = f"cloudforge-{dep.project_id}-{container.service_name}-1"
                
                target_stat = None
                if c_name in stats_map:
                    target_stat = stats_map[c_name]
                elif c_name_compose in stats_map:
                    target_stat = stats_map[c_name_compose]
                else:
                    for k, v in stats_map.items():
                        if c_name in k or c_name_compose in k:
                            target_stat = v
                            break
                            
                if target_stat:
                    metric = Metric(
                        container_id=container.id,
                        cpu_percent=target_stat["cpu"],
                        mem_usage_mb=target_stat["mem"],
                        net_in_bytes=target_stat["net_in"],
                        net_out_bytes=target_stat["net_out"]
                    )
                    db.add(metric)
                    
        db.commit()
    except Exception as e:
        import traceback
        logger.error(f"Error polling metrics for instance {instance.id}: {e}\n{traceback.format_exc()}")

import threading
from app.db.session import SessionLocal
import boto3

def auto_stop_idle_instances(db: Session):
    try:
        instances = db.query(Instance).filter(Instance.status == 'running').all()
        for instance in instances:
            # Check if there are any active deployments
            active_deps = db.query(Deployment).filter(
                Deployment.instance_id == instance.id,
                Deployment.status.in_(['live', 'pending', 'building', 'deploying', 'health_check', 'healing'])
            ).count()
            
            if active_deps == 0:
                logger.info(f"Instance {instance.aws_instance_id} is idle (0 active deployments). Auto-stopping to optimize cost.")
                try:
                    ec2 = boto3.client('ec2', region_name=os.getenv("AWS_REGION", "us-east-1"))
                    ec2.stop_instances(InstanceIds=[instance.aws_instance_id])
                    instance.status = "stopped"
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to auto-stop instance {instance.aws_instance_id}: {e}")
    except Exception as e:
        logger.error(f"Error in auto_stop_idle_instances: {e}")

def _metrics_polling_loop():
    while True:
        try:
            db = SessionLocal()
            try:
                # 1. Auto-optimize infrastructure (auto-stop idle instances)
                auto_stop_idle_instances(db)
                
                # 2. Poll metrics for running instances
                instances = db.query(Instance).filter(Instance.status == 'running').all()
                for instance in instances:
                    poll_metrics_for_instance(db, instance)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Metrics polling loop error: {e}")
            
        time.sleep(5)

def start_metrics_poller():
    thread = threading.Thread(target=_metrics_polling_loop, daemon=True)
    thread.start()
