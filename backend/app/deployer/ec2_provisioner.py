import base64
import time
import boto3
import paramiko
import os
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.instance import Instance
from app.models.aws_setup_state import AWSSetupState

USER_DATA_SCRIPT = """#!/bin/bash
set -euxo pipefail
exec > /var/log/cloudforge-bootstrap.log 2>&1
echo "=== CloudForge EC2 Bootstrap ==="
echo "Started: $(date -u)"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu
touch /home/ubuntu/.cloudforge-bootstrap-done
echo "=== CloudForge Bootstrap Complete ==="
echo "Finished: $(date -u)"
"""

def provision_instance(db: Session, max_instances: int = None) -> Instance:
    if max_instances is None:
        max_instances = int(os.getenv("MAX_EC2_INSTANCES", "3"))

    # 1. ACQUIRE pg_advisory_xact_lock
    db.execute(text("SELECT pg_advisory_xact_lock(12345)"))
    
    ec2 = boto3.client('ec2', region_name=os.getenv("AWS_REGION", "us-east-1"))
    
    # 2. RECONCILE
    res = ec2.describe_instances(Filters=[{'Name': 'tag:cloudforge-managed', 'Values': ['true']}])
    aws_instances = {}
    for res_obj in res.get('Reservations', []):
        for inst in res_obj.get('Instances', []):
            aws_instances[inst['InstanceId']] = inst
            
    db_instances = db.query(Instance).all()
    db_map = {i.aws_instance_id: i for i in db_instances}
    
    for aws_id, aws_inst in aws_instances.items():
        state_name = aws_inst['State']['Name']
        pub_ip = aws_inst.get('PublicIpAddress')
        if aws_id in db_map:
            db_map[aws_id].status = state_name
            db_map[aws_id].public_ip = pub_ip
        else:
            new_inst = Instance(aws_instance_id=aws_id, status=state_name, public_ip=pub_ip)
            db.add(new_inst)
            db_map[aws_id] = new_inst
            
    for db_id, db_inst in db_map.items():
        if db_id not in aws_instances and db_inst.status != 'terminated':
            db_inst.status = 'terminated'
            
    db.flush()
    
    # 3. REUSE
    running_inst = next((i for i in db_map.values() if i.status == 'running'), None)
    if running_inst:
        _wait_for_readiness(running_inst, db)
        return running_inst
        
    # 4. RESTART
    stopped_inst = next((i for i in db_map.values() if i.status == 'stopped'), None)
    if stopped_inst:
        ec2.start_instances(InstanceIds=[stopped_inst.aws_instance_id])
        _wait_for_running(ec2, stopped_inst.aws_instance_id)
        
        updated_aws = ec2.describe_instances(InstanceIds=[stopped_inst.aws_instance_id])
        inst_data = updated_aws['Reservations'][0]['Instances'][0]
        stopped_inst.status = 'running'
        stopped_inst.public_ip = inst_data.get('PublicIpAddress')
        db.flush()
        
        _wait_for_readiness(stopped_inst, db)
        return stopped_inst
        
    # 5. CREATE
    active_count = sum(1 for i in db_map.values() if i.status in ('pending', 'running', 'stopped'))
    if active_count >= max_instances:
        raise RuntimeError("Instance cap reached. Cannot provision more EC2 instances.")
        
    setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
    if not setup_state:
        ami_id = os.getenv("EC2_AMI_ID")
        sg_id = os.getenv("EC2_SECURITY_GROUP_ID")
        key_name = os.getenv("EC2_KEY_PAIR_NAME")
        subnet_id = os.getenv("EC2_SUBNET_ID")
        if not (ami_id and sg_id and key_name):
            raise RuntimeError("Missing AWS configuration. Run setup wizard or set .env manually.")
    else:
        ami_id = setup_state.ami_id
        sg_id = setup_state.security_group_id
        key_name = setup_state.key_pair_name
        subnet_id = setup_state.subnet_id
        
    run_kwargs = {
        'ImageId': ami_id,
        'InstanceType': os.getenv('EC2_INSTANCE_TYPE', 't2.micro'),
        'KeyName': key_name,
        'SecurityGroupIds': [sg_id],
        'MinCount': 1,
        'MaxCount': 1,
        'UserData': base64.b64encode(USER_DATA_SCRIPT.encode()).decode(),
        'TagSpecifications': [
            {
                'ResourceType': 'instance',
                'Tags': [{'Key': 'cloudforge-managed', 'Value': 'true'}]
            }
        ]
    }
    if subnet_id:
        run_kwargs['SubnetId'] = subnet_id
        
    create_res = ec2.run_instances(**run_kwargs)
    new_aws_id = create_res['Instances'][0]['InstanceId']
    
    _wait_for_running(ec2, new_aws_id)
    
    updated_aws = ec2.describe_instances(InstanceIds=[new_aws_id])
    inst_data = updated_aws['Reservations'][0]['Instances'][0]
    
    new_inst = Instance(aws_instance_id=new_aws_id, status='running', public_ip=inst_data.get('PublicIpAddress'))
    db.add(new_inst)
    db.flush()
    
    _wait_for_readiness(new_inst, db)
    return new_inst

def _wait_for_running(ec2, instance_id, timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        res = ec2.describe_instances(InstanceIds=[instance_id])
        state = res['Reservations'][0]['Instances'][0]['State']['Name']
        if state == 'running':
            return
        time.sleep(5)
    raise RuntimeError(f"Timeout waiting for instance {instance_id} to run")

def _wait_for_readiness(instance: Instance, db: Session, timeout=120):
    if not instance.public_ip:
        raise RuntimeError("No public IP available for readiness check")
        
    setup_state = db.query(AWSSetupState).filter_by(setup_status='complete').first()
    key_path = setup_state.ssh_key_path if setup_state else os.getenv("EC2_SSH_KEY_PATH")
    
    if not key_path or not os.path.exists(key_path):
        raise RuntimeError("SSH key path not found for readiness check")
        
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    start = time.time()
    while time.time() - start < timeout:
        try:
            ssh.connect(instance.public_ip, username='ubuntu', key_filename=key_path, timeout=5)
            stdin, stdout, stderr = ssh.exec_command("cat /home/ubuntu/.cloudforge-bootstrap-done")
            if stdout.channel.recv_exit_status() == 0:
                stdin, stdout, stderr = ssh.exec_command("docker info")
                if stdout.channel.recv_exit_status() == 0:
                    ssh.close()
                    return
            ssh.close()
        except Exception:
            pass
        time.sleep(5)
        
    raise RuntimeError("Timeout waiting for EC2 readiness (bootstrap/docker)")
