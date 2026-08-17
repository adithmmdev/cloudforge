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
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(instance.public_ip, username='ubuntu', key_filename=key_path)
        
        active_deployments = db.query(Deployment).filter(
            Deployment.instance_id == instance.id,
            Deployment.status == 'success'
        ).all()
        
        if not active_deployments:
            return
            
        stdin, stdout, stderr = ssh.exec_command('docker stats --no-stream --format "{{json .}}"')
        output = stdout.read().decode()
        
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
        logger.error(f"Error polling metrics for instance {instance.id}: {e}")
    finally:
        ssh.close()
