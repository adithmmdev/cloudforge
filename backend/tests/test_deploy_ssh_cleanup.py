import pytest
from unittest.mock import MagicMock, patch
from app.deployer.deploy import run_deployment_pipeline
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.instance import Instance

def test_deploy_ssh_cleanup_on_failure(monkeypatch):
    mock_db = MagicMock()
    
    mock_deployment = Deployment(id=1, project_id=1, status="pending")
    mock_project = Project(id=1, name="test", framework="single_container")
    mock_instance = Instance(id=1, aws_instance_id="i-1", public_ip="1.1.1.1", status="running")
    
    def mock_query(*args, **kwargs):
        mock_q = MagicMock()
        def mock_first():
            if args[0] == Deployment: return mock_deployment
            if args[0] == Project: return mock_project
            if args[0] == Instance: return mock_instance
        mock_q.filter.return_value.first.side_effect = mock_first
        mock_q.first.side_effect = mock_first
        return mock_q
        
    mock_db.query.side_effect = mock_query
    
    import app.deployer.deploy
    monkeypatch.setattr(app.deployer.deploy, "provision_instance", lambda db, max: mock_instance)
    monkeypatch.setattr(app.deployer.deploy, "detect_framework", lambda p: "single_container")
    monkeypatch.setattr(app.deployer.deploy, "get_adapter", MagicMock())
    monkeypatch.setattr(app.deployer.deploy, "generate_dockerfile", lambda f,p,c: None)
    
    mock_ssh = MagicMock()
    mock_sftp = MagicMock()
    mock_ssh.open_sftp.return_value = mock_sftp
    mock_sftp.put.side_effect = Exception("SFTP upload failed")
    # Connection succeeds
    mock_ssh.connect.return_value = None
    
    with patch("app.deployer.deploy.paramiko.SSHClient") as MockClient:
        MockClient.return_value = mock_ssh
        
        with patch("app.deployer.deploy.subprocess.run") as mock_run:
            mock_run.return_value.returncode = 0
            
            with pytest.raises(RuntimeError, match="SFTP upload failed"):
                run_deployment_pipeline(mock_db, 1)
                
            mock_ssh.close.assert_called()
