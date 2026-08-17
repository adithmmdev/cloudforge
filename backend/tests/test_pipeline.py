import pytest
from unittest.mock import patch, MagicMock
from app.deployer.deploy import run_deployment_pipeline
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.instance import Instance

@pytest.fixture
def mock_db():
    db = MagicMock()
    return db

@patch("app.deployer.deploy.provision_instance")
@patch("app.deployer.deploy.build_project")
@patch("app.deployer.deploy.subprocess.Popen")
@patch("app.deployer.deploy.paramiko.SSHClient")
@patch("app.deployer.deploy.os.path.exists")
@patch("app.detector.registry.registry.detect")
def test_successful_deployment(mock_detect, mock_exists, mock_ssh_class, mock_popen, mock_build, mock_provision, mock_db):
    mock_exists.return_value = True
    
    mock_adapter = MagicMock()
    mock_adapter.name = "single_container"
    mock_detect.return_value = (mock_adapter, {})
    
    mock_deployment = Deployment(id=1, project_id=10, status='pending', deployment_type='single_container')
    mock_project = Project(id=10, name="test_proj")
    
    def query_side_effect(model):
        m = MagicMock()
        if model == Deployment:
            m.filter.return_value.first.return_value = mock_deployment
        elif model == Project:
            m.filter.return_value.first.return_value = mock_project
        else:
            m.filter.return_value.first.return_value = None
        return m
        
    mock_db.query.side_effect = query_side_effect
    
    mock_instance = Instance(id=5, public_ip="8.8.8.8")
    mock_provision.return_value = mock_instance
    
    mock_build.return_value = {
        "status": "success",
        "images": ["test_proj:latest"]
    }
    
    mock_proc1 = MagicMock()
    mock_proc2 = MagicMock()
    mock_proc2.communicate.return_value = (b"", b"")
    mock_proc2.returncode = 0
    mock_popen.side_effect = [mock_proc1, mock_proc2]
    
    mock_ssh = MagicMock()
    stdout_mock = MagicMock()
    stdout_mock.channel.recv_exit_status.return_value = 0
    mock_ssh.exec_command.return_value = (None, stdout_mock, None)
    mock_ssh_class.return_value = mock_ssh
    
    res = run_deployment_pipeline(mock_db, deployment_id=1)
    
    assert res["status"] == "success"
    assert mock_deployment.status == "success"
    assert mock_deployment.instance_id == 5
    assert mock_provision.called
    assert mock_build.called
    assert mock_popen.call_count == 2
    assert mock_ssh.exec_command.called

@patch("app.deployer.deploy.provision_instance")
@patch("app.deployer.deploy.build_project")
@patch("app.deployer.deploy.subprocess.Popen")
@patch("app.deployer.deploy.paramiko.SSHClient")
@patch("app.deployer.deploy.os.path.exists")
@patch("app.detector.registry.registry.detect")
def test_build_failure(mock_detect, mock_exists, mock_ssh_class, mock_popen, mock_build, mock_provision, mock_db):
    mock_exists.return_value = True
    
    mock_adapter = MagicMock()
    mock_adapter.name = "single_container"
    mock_detect.return_value = (mock_adapter, {})
    
    mock_deployment = Deployment(id=2, project_id=11, status='pending', deployment_type='single_container')
    mock_project = Project(id=11, name="fail_proj")
    
    def query_side_effect(model):
        m = MagicMock()
        if model == Deployment:
            m.filter.return_value.first.return_value = mock_deployment
        elif model == Project:
            m.filter.return_value.first.return_value = mock_project
        else:
            m.filter.return_value.first.return_value = None
        return m
        
    mock_db.query.side_effect = query_side_effect
    
    mock_instance = Instance(id=6, public_ip="9.9.9.9")
    mock_provision.return_value = mock_instance
    
    mock_build.return_value = {
        "status": "failed",
        "error": "syntax error"
    }
    
    with pytest.raises(RuntimeError, match="Build failed: syntax error"):
        run_deployment_pipeline(mock_db, deployment_id=2)
        
    assert mock_deployment.status == "failed"
    assert not mock_popen.called
    assert not mock_ssh_class.called
