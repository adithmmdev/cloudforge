import pytest
from unittest.mock import patch, MagicMock
from app.deployer.ec2_provisioner import provision_instance
from app.models.instance import Instance

@pytest.fixture
def mock_ec2():
    with patch("app.deployer.ec2_provisioner.boto3.client") as mock_client:
        ec2 = MagicMock()
        mock_client.return_value = ec2
        yield ec2

@pytest.fixture
def mock_ssh():
    with patch("app.deployer.ec2_provisioner.paramiko.SSHClient") as mock_client_class:
        ssh = MagicMock()
        
        stdout_mock = MagicMock()
        stdout_mock.channel.recv_exit_status.return_value = 0
        
        ssh.exec_command.return_value = (None, stdout_mock, None)
        mock_client_class.return_value = ssh
        yield ssh

@pytest.fixture
def mock_db():
    db = MagicMock()
    # By default, pretend no existing instances
    db.query.return_value.all.return_value = []
    return db

@patch("app.deployer.ec2_provisioner.os.path.exists")
def test_create_when_under_cap(mock_exists, mock_ec2, mock_ssh, mock_db):
    mock_exists.return_value = True
    
    # Mock describe_instances for reconcile (empty AWS state)
    mock_ec2.describe_instances.side_effect = [
        {'Reservations': []},  # Reconcile step
        # Create step wait_for_running
        {'Reservations': [{'Instances': [{'State': {'Name': 'running'}, 'PublicIpAddress': '1.1.1.1'}]}]},
        # describe after wait_for_running
        {'Reservations': [{'Instances': [{'State': {'Name': 'running'}, 'PublicIpAddress': '1.1.1.1'}]}]}
    ]
    
    mock_ec2.run_instances.return_value = {'Instances': [{'InstanceId': 'i-new'}]}
    
    # Provide a complete AWS setup state
    mock_setup_state = MagicMock()
    mock_setup_state.ami_id = "ami-123"
    mock_setup_state.security_group_id = "sg-123"
    mock_setup_state.key_pair_name = "key-123"
    mock_setup_state.subnet_id = "subnet-123"
    mock_db.query.return_value.filter_by.return_value.first.return_value = mock_setup_state

    instance = provision_instance(mock_db, max_instances=1)
    
    assert instance.aws_instance_id == 'i-new'
    assert instance.status == 'running'
    assert mock_ec2.run_instances.called
    assert mock_ssh.connect.called

@patch("app.deployer.ec2_provisioner.os.path.exists")
def test_reuse_when_running(mock_exists, mock_ec2, mock_ssh, mock_db):
    mock_exists.return_value = True
    
    existing_inst = Instance(aws_instance_id='i-existing', status='running', public_ip='1.1.1.1')
    mock_db.query.return_value.all.return_value = [existing_inst]
    
    mock_ec2.describe_instances.return_value = {
        'Reservations': [{'Instances': [{'InstanceId': 'i-existing', 'State': {'Name': 'running'}, 'PublicIpAddress': '1.1.1.1'}]}]
    }
    
    instance = provision_instance(mock_db, max_instances=1)
    
    assert instance.aws_instance_id == 'i-existing'
    assert not mock_ec2.run_instances.called
    assert not mock_ec2.start_instances.called

@patch("app.deployer.ec2_provisioner.os.path.exists")
def test_restart_when_stopped(mock_exists, mock_ec2, mock_ssh, mock_db):
    mock_exists.return_value = True
    
    existing_inst = Instance(aws_instance_id='i-stopped', status='stopped', public_ip='2.2.2.2')
    mock_db.query.return_value.all.return_value = [existing_inst]
    
    mock_ec2.describe_instances.side_effect = [
        # Reconcile: instance is stopped
        {'Reservations': [{'Instances': [{'InstanceId': 'i-stopped', 'State': {'Name': 'stopped'}, 'PublicIpAddress': '2.2.2.2'}]}]},
        # Wait for running
        {'Reservations': [{'Instances': [{'InstanceId': 'i-stopped', 'State': {'Name': 'running'}, 'PublicIpAddress': '2.2.2.2'}]}]},
        # Final update
        {'Reservations': [{'Instances': [{'InstanceId': 'i-stopped', 'State': {'Name': 'running'}, 'PublicIpAddress': '2.2.2.2'}]}]}
    ]
    
    instance = provision_instance(mock_db, max_instances=1)
    
    assert instance.aws_instance_id == 'i-stopped'
    assert mock_ec2.start_instances.called
    assert not mock_ec2.run_instances.called

@patch("app.deployer.ec2_provisioner.os.path.exists")
def test_hard_fail_when_at_cap(mock_exists, mock_ec2, mock_ssh, mock_db):
    mock_exists.return_value = True
    
    inst1 = Instance(aws_instance_id='i-1', status='pending', public_ip=None)
    inst2 = Instance(aws_instance_id='i-2', status='pending', public_ip=None)
    
    mock_db.query.return_value.all.return_value = [inst1, inst2]
    
    mock_ec2.describe_instances.return_value = {
        'Reservations': [
            {'Instances': [{'InstanceId': 'i-1', 'State': {'Name': 'pending'}}]},
            {'Instances': [{'InstanceId': 'i-2', 'State': {'Name': 'pending'}}]}
        ]
    }
    
    with pytest.raises(RuntimeError, match="Instance cap reached"):
        provision_instance(mock_db, max_instances=2)

@patch("app.deployer.ec2_provisioner.os.path.exists")
def test_reconciliation_updates_db(mock_exists, mock_ec2, mock_ssh, mock_db):
    mock_exists.return_value = True
    
    inst_missing_in_aws = Instance(aws_instance_id='i-old', status='running')
    mock_db.query.return_value.all.return_value = [inst_missing_in_aws]
    
    mock_ec2.describe_instances.side_effect = [
        # Reconcile returns empty AWS reality
        {'Reservations': []},
        # Create wait
        {'Reservations': [{'Instances': [{'State': {'Name': 'running'}, 'PublicIpAddress': '4.4.4.4'}]}]},
        # Create final
        {'Reservations': [{'Instances': [{'State': {'Name': 'running'}, 'PublicIpAddress': '4.4.4.4'}]}]}
    ]
    
    mock_ec2.run_instances.return_value = {'Instances': [{'InstanceId': 'i-new2'}]}
    
    mock_setup_state = MagicMock()
    mock_setup_state.ami_id = "ami-123"
    mock_db.query.return_value.filter_by.return_value.first.return_value = mock_setup_state
    
    provision_instance(mock_db, max_instances=1)
    
    # Verify the old instance was marked as terminated
    assert inst_missing_in_aws.status == 'terminated'

@patch("app.deployer.ec2_provisioner.os.path.exists")
def test_advisory_lock_serialization(mock_exists, mock_ec2, mock_ssh, mock_db):
    mock_exists.return_value = True
    
    mock_ec2.describe_instances.side_effect = [
        {'Reservations': []},  # reconcile
        {'Reservations': [{'Instances': [{'State': {'Name': 'running'}, 'PublicIpAddress': '5.5.5.5'}]}]},
        {'Reservations': [{'Instances': [{'State': {'Name': 'running'}, 'PublicIpAddress': '5.5.5.5'}]}]}
    ]
    mock_ec2.run_instances.return_value = {'Instances': [{'InstanceId': 'i-new3'}]}
    
    mock_setup_state = MagicMock()
    mock_setup_state.ami_id = "ami-123"
    mock_db.query.return_value.filter_by.return_value.first.return_value = mock_setup_state
    
    provision_instance(mock_db, max_instances=1)
    
    # Verify advisory lock was acquired exactly once
    assert mock_db.execute.call_count == 1
    query_str = mock_db.execute.call_args[0][0].text
    assert "pg_advisory_xact_lock" in query_str
