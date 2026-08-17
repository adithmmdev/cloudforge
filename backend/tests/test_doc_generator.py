import pytest
from unittest.mock import MagicMock
from app.doc_generator.generator import generate_deployment_report
import datetime

@pytest.fixture
def mock_db():
    return MagicMock()

def test_generate_deployment_report(mock_db):
    mock_deployment = MagicMock()
    mock_deployment.id = 1
    mock_deployment.status = "success"
    mock_deployment.deployment_type = "single_container"
    mock_deployment.env_vars = '{"PORT": "8000"}'
    
    mock_project = MagicMock()
    mock_project.name = "test-project"
    mock_project.framework = "fastapi"
    mock_project.github_url = "http://github.com/test"
    
    mock_instance = MagicMock()
    mock_instance.aws_instance_id = "i-1234"
    mock_instance.public_ip = "1.2.3.4"
    mock_instance.instance_type = "t3.micro"
    mock_instance.status = "running"
    
    mock_container = MagicMock()
    mock_container.service_name = "app"
    mock_container.image_tag = "app:latest"
    mock_container.host_port = "80"
    mock_container.status = "running"
    
    mock_event = MagicMock()
    mock_event.stage_name = "deploy"
    mock_event.created_at = datetime.datetime.now()
    mock_event.detail = "done"
    
    def query_side_effect(model):
        q = MagicMock()
        if model.__name__ == "Deployment":
            q.filter.return_value.first.return_value = mock_deployment
        elif model.__name__ == "Project":
            q.filter.return_value.first.return_value = mock_project
        elif model.__name__ == "Instance":
            q.filter.return_value.first.return_value = mock_instance
        elif model.__name__ == "Container":
            q.filter.return_value.all.return_value = [mock_container]
        elif model.__name__ == "StageEvent":
            q.filter.return_value.order_by.return_value.all.return_value = [mock_event]
        elif model.__name__ == "Failure":
            q.filter.return_value.all.return_value = []
        elif model.__name__ == "DeploymentReport":
            q.filter.return_value.first.return_value = None
        return q
        
    mock_db.query.side_effect = query_side_effect
    
    report = generate_deployment_report(mock_db, 1)
    
    assert report is not None
    assert "Deployment Report — test-project" in report.report_markdown
    assert "1.2.3.4" in report.report_markdown
    assert "PORT" in report.report_markdown
    assert mock_db.add.called
