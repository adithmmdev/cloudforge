import os

content_ec2 = """import pytest
from unittest.mock import MagicMock
from app.deployer.ec2_provisioner import provision_instance
from app.models.instance import Instance
from app.models.aws_setup_state import AWSSetupState

def test_provision_instance_advisory_lock_release(monkeypatch):
    db = MagicMock()
    db.query().all.return_value = []
    
    mock_setup = AWSSetupState(setup_status='complete', ami_id='ami-123', security_group_id='sg-123', key_pair_name='kp', subnet_id='subnet-123')
    db.query().filter_by().first.return_value = mock_setup
    
    mock_ec2 = MagicMock()
    mock_ec2.describe_instances.side_effect = [
        {'Reservations': []},
        {'Reservations': [{'Instances': [{'InstanceId': 'i-123', 'State': {'Name': 'running'}, 'PublicIpAddress': '1.1.1.1'}]}]}
    ]
    mock_ec2.run_instances.return_value = {'Instances': [{'InstanceId': 'i-123'}]}
    
    import boto3
    monkeypatch.setattr(boto3, 'client', lambda *args, **kwargs: mock_ec2)
    
    import app.deployer.ec2_provisioner
    monkeypatch.setattr(app.deployer.ec2_provisioner, '_wait_for_running', MagicMock())
    monkeypatch.setattr(app.deployer.ec2_provisioner, '_wait_for_readiness', MagicMock())
    
    call_order = []
    db.commit.side_effect = lambda: call_order.append('commit')
    app.deployer.ec2_provisioner._wait_for_running.side_effect = lambda *args: call_order.append('wait_for_running')
    
    provision_instance(db, max_instances=3)
    
    assert call_order.index('commit') < call_order.index('wait_for_running')

def test_provision_instance_reuse_pending(monkeypatch):
    db = MagicMock()
    pending_inst = Instance(aws_instance_id='i-pending', status='pending')
    db.query().all.return_value = [pending_inst]
    
    mock_ec2 = MagicMock()
    mock_ec2.describe_instances.return_value = {'Reservations': [{'Instances': [{'InstanceId': 'i-pending', 'State': {'Name': 'pending'}, 'PublicIpAddress': None}]}]}
    
    import boto3
    monkeypatch.setattr(boto3, 'client', lambda *args, **kwargs: mock_ec2)
    
    import app.deployer.ec2_provisioner
    def mock_wait_running(ec2, aws_id):
        mock_ec2.describe_instances.return_value = {'Reservations': [{'Instances': [{'InstanceId': 'i-pending', 'State': {'Name': 'running'}, 'PublicIpAddress': '1.1.1.1'}]}]}
    
    monkeypatch.setattr(app.deployer.ec2_provisioner, '_wait_for_running', mock_wait_running)
    monkeypatch.setattr(app.deployer.ec2_provisioner, '_wait_for_readiness', MagicMock())
    
    inst = provision_instance(db, max_instances=3)
    assert inst.status == 'running'
    assert inst.public_ip == '1.1.1.1'
    mock_ec2.run_instances.assert_not_called()
"""

content_loop = """import pytest
from unittest.mock import MagicMock
from app.orchestrator.loop import run_orchestration_loop
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.autonomy_setting import AutonomySetting
from app.models.remediation_action import RemediationAction

def test_remediation_duplicate_loop_escalates(monkeypatch):
    db = MagicMock()
    
    deployment = Deployment(id=1, project_id=1, status='pending')
    db.query.return_value.filter.return_value.first.side_effect = [
        deployment, 
        deployment,
        Project(id=1, name='test', framework='express'),
        AutonomySetting(mode='full_auto')
    ]
    
    import app.orchestrator.loop
    monkeypatch.setattr(app.orchestrator.loop, 'run_deployment_pipeline', MagicMock(side_effect=Exception('test fail')))
    monkeypatch.setattr(app.orchestrator.loop, 'classify_error', lambda e: {'error_class': 'test'})
    monkeypatch.setattr(app.orchestrator.loop, 'create_redacted_signature', lambda **kw: {})
    
    past_action = RemediationAction(deployment_id=1, action_type='CHANGE_INTERNAL_PORT', params={'port': 8000}, status='rejected')
    db.query.return_value.filter.return_value.all.return_value = [past_action]
    
    monkeypatch.setattr(app.orchestrator.loop, 'get_local_action', lambda *args: {'action_type': 'CHANGE_INTERNAL_PORT', 'params': {'port': 8000}, 'confidence': 0.9, 'reasoning': ''})
    monkeypatch.setattr(app.orchestrator.loop, 'validate_action', lambda *args: True)
    
    res = run_orchestration_loop(db, 1)
    
    assert res == {'status': 'failed', 'failure_id': None, 'message': 'LLM returned NONE or invalid action'}
"""

with open("backend/tests/test_ec2_provisioner_regression.py", "w") as f:
    f.write(content_ec2)

with open("backend/tests/test_remediation_loop_regression.py", "w") as f:
    f.write(content_loop)
