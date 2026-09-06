import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, engine
from app.models.base import Base
from app.models.deployment import Deployment
from app.models.instance import Instance
import boto3
from unittest.mock import patch, MagicMock

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.query(Deployment).delete()
    session.query(Instance).delete()
    session.commit()
    session.close()

def test_cancel_deployment(client, db):
    dep = Deployment(project_id=1, deployment_type="single_container", status="building")
    db.add(dep)
    db.commit()
    
    # Test cancel active
    res = client.post(f"/api/deployments/{dep.id}/cancel")
    assert res.status_code == 200
    db.refresh(dep)
    assert dep.status == "cancelled"
    
    # Test already cancelled
    res2 = client.post(f"/api/deployments/{dep.id}/cancel")
    assert res2.status_code == 200
    assert res2.json()["message"] == "Deployment already terminal"

def test_cancel_all_deployments(client, db):
    dep1 = Deployment(project_id=1, deployment_type="single_container", status="pending")
    dep2 = Deployment(project_id=1, deployment_type="single_container", status="deploying")
    db.add_all([dep1, dep2])
    db.commit()
    
    res = client.post("/api/deployments/action/cancel-all")
    assert res.status_code == 200
    assert res.json()["count"] == 2
    
    db.refresh(dep1)
    db.refresh(dep2)
    assert dep1.status == "cancelled"
    assert dep2.status == "cancelled"

@patch('app.api.instances.boto3.client')
def test_stop_instance(mock_boto, client, db):
    mock_ec2 = MagicMock()
    mock_boto.return_value = mock_ec2
    
    mock_ec2.describe_instances.return_value = {
        'Reservations': [{'Instances': [{'Tags': [{'Key': 'cloudforge-managed', 'Value': 'true'}]}]}]
    }
    
    inst = Instance(aws_instance_id="i-123456", status="running")
    db.add(inst)
    db.commit()
    
    res = client.post("/api/instances/i-123456/stop")
    assert res.status_code == 200
    mock_ec2.stop_instances.assert_called_once_with(InstanceIds=["i-123456"])

@patch('app.api.instances.boto3.client')
def test_stop_instance_safety(mock_boto, client, db):
    mock_ec2 = MagicMock()
    mock_boto.return_value = mock_ec2
    
    # Not managed by cloudforge
    mock_ec2.describe_instances.return_value = {
        'Reservations': [{'Instances': [{'Tags': [{'Key': 'some-other-tag', 'Value': 'true'}]}]}]
    }
    
    res = client.post("/api/instances/i-999999/stop")
    assert res.status_code == 400
    assert "Cannot stop non-CloudForge managed instances" in res.json()["detail"]

@patch('app.api.instances.boto3.client')
def test_stop_all_instances(mock_boto, client, db):
    mock_ec2 = MagicMock()
    mock_boto.return_value = mock_ec2
    
    mock_ec2.describe_instances.return_value = {
        'Reservations': [{'Instances': [
            {'InstanceId': 'i-111', 'State': {'Name': 'running'}},
            {'InstanceId': 'i-222', 'State': {'Name': 'running'}}
        ]}]
    }
    
    inst1 = Instance(aws_instance_id="i-111", status="running")
    inst2 = Instance(aws_instance_id="i-222", status="running")
    db.add_all([inst1, inst2])
    db.commit()
    
    res = client.post("/api/instances/action/stop-all")
    assert res.status_code == 200
    assert res.json()["count"] == 2
    mock_ec2.stop_instances.assert_called_once_with(InstanceIds=['i-111', 'i-222'])

def test_monitoring_endpoints(client, db):
    res_inst = client.get("/api/monitoring/instances")
    assert res_inst.status_code == 200
    assert isinstance(res_inst.json(), list)
    
    res_dep = client.get("/api/monitoring/deployments")
    assert res_dep.status_code == 200
    assert isinstance(res_dep.json(), list)
