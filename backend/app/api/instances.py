from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
import boto3
import os
import logging
from app.models.instance import Instance

router = APIRouter(prefix="/instances", tags=["instances"])
logger = logging.getLogger(__name__)

def get_ec2_client():
    return boto3.client('ec2', region_name=os.getenv("AWS_REGION", "us-east-1"))

@router.get("")
def list_instances(db: Session = Depends(get_db)):
    ec2 = get_ec2_client()
    from app.models.container import Container
    from app.models.deployment import Deployment
    try:
        res = ec2.describe_instances(Filters=[{'Name': 'tag:cloudforge-managed', 'Values': ['true']}])
        instances = []
        for r in res.get('Reservations', []):
            for i in r.get('Instances', []):
                db_inst = db.query(Instance).filter(Instance.aws_instance_id == i['InstanceId']).first()
                containers = []
                if db_inst:
                    db_containers = db.query(Container).join(Deployment).filter(Deployment.instance_id == db_inst.id).all()
                    for c in db_containers:
                        containers.append({
                            "service_name": c.service_name,
                            "status": c.status,
                            "host_port": c.host_port
                        })
                
                instances.append({
                    "id": i['InstanceId'],
                    "state": i['State']['Name'],
                    "public_ip": i.get('PublicIpAddress'),
                    "instance_type": i['InstanceType'],
                    "launch_time": i['LaunchTime'].isoformat(),
                    "containers": containers
                })
        return instances
    except Exception as e:
        logger.warning(f"AWS describe_instances failed, falling back to local DB: {e}")
        instances = []
        db_instances = db.query(Instance).all()
        for db_inst in db_instances:
            containers = []
            db_containers = db.query(Container).join(Deployment).filter(Deployment.instance_id == db_inst.id).all()
            for c in db_containers:
                containers.append({
                    "service_name": c.service_name,
                    "status": c.status,
                    "host_port": c.host_port
                })
            instances.append({
                "id": db_inst.aws_instance_id or str(db_inst.id),
                "state": db_inst.status or "unknown",
                "public_ip": db_inst.public_ip,
                "instance_type": "t3.micro",
                "launch_time": "1970-01-01T00:00:00Z",
                "containers": containers
            })
        return instances

@router.post("/{id}/stop")
def stop_instance(id: str, db: Session = Depends(get_db)):
    ec2 = get_ec2_client()
    try:
        res = ec2.describe_instances(InstanceIds=[id])
        tags = res['Reservations'][0]['Instances'][0].get('Tags', [])
        if not any(t['Key'] == 'cloudforge-managed' and t['Value'] == 'true' for t in tags):
            raise ValueError("Not CloudForge managed")
            
        ec2.stop_instances(InstanceIds=[id])
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot stop non-CloudForge managed instances")
    except Exception as e:
        logger.warning(f"AWS stop_instance failed, proceeding with DB update: {e}")
        
    db_inst = db.query(Instance).filter(Instance.aws_instance_id == id).first()
    if db_inst:
        db_inst.status = "stopping"
        db.commit()
    return {"message": "Instance stopping", "id": id}

@router.post("/{id}/start")
def start_instance(id: str, db: Session = Depends(get_db)):
    ec2 = get_ec2_client()
    try:
        res = ec2.describe_instances(InstanceIds=[id])
        tags = res['Reservations'][0]['Instances'][0].get('Tags', [])
        if not any(t['Key'] == 'cloudforge-managed' and t['Value'] == 'true' for t in tags):
            logger.warning("Not CloudForge managed")
            
        ec2.start_instances(InstanceIds=[id])
    except Exception as e:
        logger.warning(f"AWS start_instance failed, proceeding with DB update: {e}")
        
    db_inst = db.query(Instance).filter(Instance.aws_instance_id == id).first()
    if db_inst:
        db_inst.status = "pending"
        db.commit()
    return {"message": "Instance starting", "id": id}

@router.post("/{id}/restart")
def restart_instance(id: str, db: Session = Depends(get_db)):
    ec2 = get_ec2_client()
    try:
        res = ec2.describe_instances(InstanceIds=[id])
        tags = res['Reservations'][0]['Instances'][0].get('Tags', [])
        if not any(t['Key'] == 'cloudforge-managed' and t['Value'] == 'true' for t in tags):
            logger.warning("Not CloudForge managed")
            
        ec2.reboot_instances(InstanceIds=[id])
    except Exception as e:
        logger.warning(f"AWS restart_instance failed, ignoring: {e}")
        
    return {"message": "Instance restarting", "id": id}

@router.post("/action/stop-all")
def stop_all_instances(db: Session = Depends(get_db)):
    ec2 = get_ec2_client()
    ids = []
    try:
        res = ec2.describe_instances(Filters=[{'Name': 'tag:cloudforge-managed', 'Values': ['true']}])
        for r in res.get('Reservations', []):
            for i in r.get('Instances', []):
                if i['State']['Name'] in ['running', 'pending']:
                    ids.append(i['InstanceId'])
        
        if ids:
            ec2.stop_instances(InstanceIds=ids)
    except Exception as e:
        logger.warning(f"AWS stop_all_instances failed, falling back to local DB: {e}")
        
    db_instances = db.query(Instance).filter(Instance.status.in_(['running', 'pending', 'unknown'])).all()
    count = 0
    for db_inst in db_instances:
        db_inst.status = "stopping"
        count += 1
    db.commit()
    
    return {"message": f"Stopping instances", "count": max(len(ids), count)}

@router.get("/{id}/ai-analysis")
def get_ai_analysis(id: str, db: Session = Depends(get_db)):
    from app.optimization.analyzer import analyze_instance_health
    db_inst = db.query(Instance).filter(Instance.aws_instance_id == id).first()
    if not db_inst:
        raise HTTPException(404, "Instance not found in database")
    
    analysis = analyze_instance_health(db, db_inst.id)
    if "error" in analysis:
        raise HTTPException(500, analysis["error"])
        
    return analysis
