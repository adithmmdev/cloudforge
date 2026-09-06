import pytest
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
