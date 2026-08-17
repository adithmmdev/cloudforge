import pytest
from unittest.mock import patch, MagicMock
from app.deployer.rollback import trigger_rollback
from app.models.deployment import Deployment
from app.models.container import Container
from app.models.instance import Instance
from app.models.project import Project

@pytest.fixture
def mock_db():
    return MagicMock()

def setup_mock_db(mock_db, mern=False, has_prev=True):
    project = Project(id=1)
    failed_deployment = Deployment(id=10, project_id=1, instance_id=1, deployment_type='mern' if mern else 'single_container')
    
    prev_deployment = None
    if has_prev:
        prev_deployment = Deployment(id=9, project_id=1, instance_id=1, status='success')
        if mern:
            prev_deployment.containers = [
                Container(service_name='client', image_tag='client:old'),
                Container(service_name='server', image_tag='server:old')
            ]
        else:
            prev_deployment.containers = [
                Container(service_name='app', image_tag='app:old')
            ]
            
    instance = Instance(id=1, public_ip="8.8.8.8")
    
    def query_side_effect(model):
        m = MagicMock()
        if model == Deployment:
            # First filter is by ID for failed_deployment
            # Second filter is for prev_deployment
            def filter_side_effect(*args, **kwargs):
                fm = MagicMock()
                # order_by is called for prev_deployment
                def order_by_side_effect(*args):
                    om = MagicMock()
                    om.first.return_value = prev_deployment
                    return om
                fm.order_by.side_effect = order_by_side_effect
                
                # If it's just fetching the failed deployment by id
                if len(args) == 1 and "deployments.id =" in str(args[0]):
                    fm.first.return_value = failed_deployment
                else:
                    fm.first.return_value = prev_deployment
                return fm
                
            m.filter.side_effect = filter_side_effect
        elif model == Project:
            m.filter.return_value.first.return_value = project
        elif model == Instance:
            m.filter.return_value.first.return_value = instance
        else:
            m.filter.return_value.first.return_value = None
        return m
        
    mock_db.query.side_effect = query_side_effect
    return failed_deployment

@patch("app.deployer.rollback.paramiko.SSHClient")
@patch("app.deployer.rollback.os.path.exists")
def test_rollback_no_prev_deployment(mock_exists, mock_ssh_class, mock_db):
    failed_deployment = setup_mock_db(mock_db, has_prev=False)
    
    res = trigger_rollback(mock_db, 10)
    
    assert res is False
    assert failed_deployment.status == 'failed'
    assert not mock_ssh_class.called

@patch("app.deployer.rollback.paramiko.SSHClient")
@patch("app.deployer.rollback.os.path.exists")
def test_rollback_single_container(mock_exists, mock_ssh_class, mock_db):
    failed_deployment = setup_mock_db(mock_db, mern=False, has_prev=True)
    
    mock_ssh = MagicMock()
    stdout_mock = MagicMock()
    stdout_mock.channel.recv_exit_status.return_value = 0
    mock_ssh.exec_command.return_value = (None, stdout_mock, None)
    mock_ssh_class.return_value = mock_ssh
    
    res = trigger_rollback(mock_db, 10)
    
    assert res is True
    assert failed_deployment.status == 'rolled_back'
    assert mock_ssh.exec_command.call_count == 2
    
    args1 = mock_ssh.exec_command.call_args_list[0][0][0]
    assert "docker stop proj_1_10" in args1
    
    args2 = mock_ssh.exec_command.call_args_list[1][0][0]
    assert "docker run -d -p 80:8000" in args2
    assert "proj_1_9_rollback" in args2
    assert "app:old" in args2

@patch("app.deployer.rollback.paramiko.SSHClient")
@patch("app.deployer.rollback.os.path.exists")
def test_rollback_mern(mock_exists, mock_ssh_class, mock_db):
    failed_deployment = setup_mock_db(mock_db, mern=True, has_prev=True)
    
    mock_ssh = MagicMock()
    stdout_mock = MagicMock()
    stdout_mock.channel.recv_exit_status.return_value = 0
    mock_ssh.exec_command.return_value = (None, stdout_mock, None)
    mock_ssh_class.return_value = mock_ssh
    
    res = trigger_rollback(mock_db, 10)
    
    assert res is True
    assert failed_deployment.status == 'rolled_back'
    assert mock_ssh.exec_command.call_count == 3
    
    # 1. docker compose down
    assert "down" in mock_ssh.exec_command.call_args_list[0][0][0]
    # 2. write compose file
    assert "base64" in mock_ssh.exec_command.call_args_list[1][0][0]
    # 3. docker compose up
    assert "up -d" in mock_ssh.exec_command.call_args_list[2][0][0]
