import pytest
from unittest.mock import patch, MagicMock
from app.remediation.shadow import run_shadow_verification
from app.models.shadow_test import ShadowTest

@pytest.fixture
def mock_db():
    return MagicMock()

@patch("app.remediation.shadow.subprocess.run")
@patch("app.remediation.shadow.time.sleep")
@patch("app.remediation.shadow.requests.get")
def test_shadow_verification_single_container_success(mock_get, mock_sleep, mock_run, mock_db):
    def run_side_effect(args, **kwargs):
        res = MagicMock()
        res.returncode = 0
        if "inspect" in args:
            res.stdout = "true\n"
        elif "port" in args:
            res.stdout = "0.0.0.0:8000\n"
        return res
        
    mock_run.side_effect = run_side_effect
    
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_get.return_value = mock_res
    
    success = run_shadow_verification(mock_db, 10, "/tmp/project", "single_container", "fastapi")
    
    assert success is True
    assert mock_db.add.call_count == 2 # stay_running_15s and smoke_test
    
    calls = mock_db.add.call_args_list
    assert calls[0][0][0].test_name == "stay_running_15s"
    assert calls[0][0][0].passed is True
    assert calls[1][0][0].test_name == "smoke_test"
    assert calls[1][0][0].passed is True
    assert any(call.args[:3] == (["docker", "rm", "-f", "shadow_cnt_10"],) for call in mock_run.call_args_list)

@patch("app.remediation.shadow.subprocess.run")
@patch("app.remediation.shadow.time.sleep")
@patch("app.remediation.shadow.requests.get")
def test_shadow_verification_mern_success(mock_get, mock_sleep, mock_run, mock_db):
    def run_side_effect(args, **kwargs):
        res = MagicMock()
        res.returncode = 0
        if "ps" in args:
            res.stdout = "12345\n"
        elif "port" in args:
            res.stdout = "0.0.0.0:80\n"
        return res
        
    mock_run.side_effect = run_side_effect
    
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_get.return_value = mock_res
    
    success = run_shadow_verification(mock_db, 11, "/tmp/project", "mern", "mern")
    
    assert success is True
    assert mock_db.add.call_count == 2
    
@patch("app.remediation.shadow.subprocess.run")
@patch("app.remediation.shadow.time.sleep")
def test_shadow_verification_build_fail(mock_sleep, mock_run, mock_db):
    res = MagicMock()
    res.returncode = 1
    res.stderr = "build error"
    mock_run.return_value = res
    
    success = run_shadow_verification(mock_db, 12, "/tmp/project", "single_container", "fastapi")
    
    assert success is False
    assert mock_db.add.call_count == 1
    st = mock_db.add.call_args[0][0]
    assert st.test_name == "build"
    assert st.passed is False
