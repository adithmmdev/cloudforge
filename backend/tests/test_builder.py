import os
import shutil
import pytest
from unittest.mock import patch, MagicMock
from app.build_service.builder import build_project
from app.detector.registry import registry

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")

@pytest.mark.parametrize("fixture_name", [
    "fastapi-sample",
    "flask-sample",
    "express-sample",
    "react-sample",
    "react-cra-sample",
    "mern-sample"
])
@patch("app.build_service.builder.subprocess.Popen")
def test_build_fixtures(mock_popen, fixture_name, tmp_path):
    src = os.path.join(FIXTURES_DIR, fixture_name)
    dst = os.path.join(tmp_path, fixture_name)
    shutil.copytree(src, dst)
    
    adapter, extracted_info = registry.detect(dst)
    assert adapter is not None, f"Failed to detect {fixture_name}"
    
    # Mock subprocess.Popen
    mock_process = MagicMock()
    mock_process.stdout = ["Step 1/3 : FROM python:3.12-slim", "Step 2/3 : RUN echo 'building'"]
    mock_process.returncode = 0
    mock_popen.return_value = mock_process
    
    logs = []
    def log_cb(line, service=None):
        logs.append(line)
        
    build_project(
        project_path=dst,
        project_id="test",
        deployment_id="v1",
        adapter_name=adapter.name,
        extracted_info=extracted_info,
        log_callback=log_cb
    )
    
    assert mock_popen.called
    
    # Verify templates were written
    if adapter.name == "mern":
        assert os.path.exists(os.path.join(dst, "client", "Dockerfile"))
        assert os.path.exists(os.path.join(dst, "server", "Dockerfile"))
    else:
        assert os.path.exists(os.path.join(dst, "Dockerfile"))
    
    # Ensure logs were streamed
    assert len(logs) > 0
