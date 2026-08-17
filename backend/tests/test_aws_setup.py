import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError
from app.models.aws_setup_state import AWSSetupState
from app.aws_setup.setup_service import run_aws_setup

@pytest.fixture
def db_session():
    mock_db = MagicMock()
    mock_db.query.return_value.first.return_value = None
    return mock_db

@pytest.fixture
def mock_boto3():
    with patch("app.aws_setup.setup_service.boto3.client") as mock_client:
        mock_sts = MagicMock()
        mock_ec2 = MagicMock()
        
        def client_side_effect(service_name, **kwargs):
            if service_name == 'sts':
                return mock_sts
            elif service_name == 'ec2':
                return mock_ec2
            raise ValueError(f"Unknown service: {service_name}")
            
        mock_client.side_effect = client_side_effect
        
        # Default mock returns
        mock_sts.get_caller_identity.return_value = {"UserId": "mock-user"}
        
        # describe_instances needs to raise DryRunOperation
        error_response = {'Error': {'Code': 'DryRunOperation', 'Message': 'Request would have succeeded, but DryRun flag is set.'}}
        mock_ec2.describe_instances.side_effect = ClientError(error_response, 'DescribeInstances')
        
        mock_ec2.describe_vpcs.return_value = {'Vpcs': [{'VpcId': 'vpc-123', 'IsDefault': True}]}
        mock_ec2.describe_subnets.return_value = {'Subnets': [{'SubnetId': 'subnet-456', 'MapPublicIpOnLaunch': True}]}
        
        mock_ec2.create_security_group.return_value = {'GroupId': 'sg-789'}
        mock_ec2.authorize_security_group_ingress.return_value = {}
        
        mock_ec2.create_key_pair.return_value = {'KeyMaterial': '-----BEGIN RSA PRIVATE KEY-----\n...'}
        
        mock_ec2.describe_images.return_value = {
            'Images': [
                {'ImageId': 'ami-12345', 'CreationDate': '2023-01-01T00:00:00.000Z'},
                {'ImageId': 'ami-67890', 'CreationDate': '2023-06-01T00:00:00.000Z'} # latest
            ]
        }
        
        yield mock_sts, mock_ec2

def test_run_aws_setup_success(mock_boto3, db_session):
    mock_sts, mock_ec2 = mock_boto3
    
    logs = []
    def log_cb(step, msg):
        logs.append(step)
        
    state = run_aws_setup(db_session, allowed_ssh_cidr="1.2.3.4/32", log_callback=log_cb)
    
    assert state is not None
    assert state.setup_status == 'complete'
    assert state.iam_validated is True
    assert state.security_group_id == 'sg-789'
    assert state.ami_id == 'ami-67890'
    assert state.subnet_id == 'subnet-456'
    
    assert "step1" in logs
    assert "complete" in logs
    
    # Verify DB insertion
    assert db_session.add.called
    assert db_session.commit.called
    
    args, _ = db_session.add.call_args
    db_state = args[0]
    assert db_state.setup_status == 'complete'

def test_run_aws_setup_iam_failure(mock_boto3, db_session):
    mock_sts, mock_ec2 = mock_boto3
    
    error_response = {'Error': {'Code': 'AccessDenied', 'Message': 'Access Denied'}}
    mock_sts.get_caller_identity.side_effect = ClientError(error_response, 'GetCallerIdentity')
    
    with pytest.raises(RuntimeError, match="IAM validation failed"):
        run_aws_setup(db_session)

def test_run_aws_setup_no_vpc(mock_boto3, db_session):
    mock_sts, mock_ec2 = mock_boto3
    
    mock_ec2.describe_vpcs.return_value = {'Vpcs': []}
    
    with pytest.raises(RuntimeError, match="No VPC found"):
        run_aws_setup(db_session)

def test_run_aws_setup_no_ami(mock_boto3, db_session):
    mock_sts, mock_ec2 = mock_boto3
    
    mock_ec2.describe_images.return_value = {'Images': []}
    
    with pytest.raises(RuntimeError, match="No suitable Ubuntu Jammy AMI found"):
        run_aws_setup(db_session)

def test_run_aws_setup_idempotent(mock_boto3, db_session):
    mock_sts, mock_ec2 = mock_boto3
    
    # Mock DB already has a complete state
    existing_state = AWSSetupState(
        setup_status='complete',
        security_group_id='sg-existing',
        key_pair_name='key-existing',
        ami_id='ami-existing',
        subnet_id='subnet-existing'
    )
    db_session.query.return_value.first.return_value = existing_state
    
    # Mock describe_security_groups and describe_key_pairs to return success
    mock_ec2.describe_security_groups.return_value = {}
    mock_ec2.describe_key_pairs.return_value = {}
    
    logs = []
    state = run_aws_setup(db_session, log_callback=lambda s, m: logs.append(s))
    
    assert state == existing_state
    assert "complete" in logs
    
    # Verify no new resources were created
    assert not mock_ec2.create_security_group.called
    assert not mock_ec2.create_key_pair.called
    assert not db_session.add.called

