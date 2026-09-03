import pytest
from unittest.mock import patch, MagicMock
from app.aws_setup.setup_service import run_aws_teardown

@patch('app.aws_setup.setup_service.boto3.client')
def test_run_aws_teardown(mock_boto):
    db_mock = MagicMock()
    state_mock = MagicMock()
    state_mock.security_group_id = "sg-123"
    state_mock.key_pair_name = "key-123"
    db_mock.query().first.return_value = state_mock
    
    ec2_mock = MagicMock()
    mock_boto.return_value = ec2_mock
    
    run_aws_teardown(db_mock)
    
    ec2_mock.delete_security_group.assert_called_with(GroupId="sg-123")
    ec2_mock.delete_key_pair.assert_called_with(KeyName="key-123")
    db_mock.delete.assert_called_with(state_mock)
    db_mock.commit.assert_called_once()
