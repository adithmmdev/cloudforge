import pytest
from unittest.mock import patch, MagicMock
from app.remediation.llm_client_factory import get_cloud_remediation_action
from app.models.disclosure import Disclosure

@pytest.fixture
def mock_db():
    return MagicMock()

@patch("app.remediation.llm_client_factory.CLOUD_LLM_PROVIDER", "anthropic")
@patch("app.remediation.llm_client_factory.requests.post")
def test_get_cloud_remediation_action_anthropic(mock_post, mock_db):
    mock_res = MagicMock()
    mock_res.json.return_value = {
        "content": [{"text": '{"action_type": "EXPOSE_PORT", "params": {"port": 80, "service": "client"}, "confidence": 0.8}'}]
    }
    mock_post.return_value = mock_res
    
    action = get_cloud_remediation_action(mock_db, 10, {"error_class": "port_conflict"})
    
    assert action["action_type"] == "EXPOSE_PORT"
    assert action["confidence"] == 0.8
    assert mock_db.add.called
    disclosure = mock_db.add.call_args[0][0]
    assert disclosure.failure_id == 10
    assert disclosure.destination == "anthropic_api"

@patch("app.remediation.llm_client_factory.CLOUD_LLM_PROVIDER", "glm")
@patch("app.remediation.llm_client_factory.requests.post")
def test_get_cloud_remediation_action_glm(mock_post, mock_db):
    mock_res = MagicMock()
    mock_res.json.return_value = {
        "choices": [{"message": {"content": '{"action_type": "SET_ENV_VAR", "params": {"key": "NODE_ENV", "value": "test", "service": "app"}, "confidence": 0.9}'}}]
    }
    mock_post.return_value = mock_res
    
    action = get_cloud_remediation_action(mock_db, 11, {"error_class": "missing_env_var"})
    
    assert action["action_type"] == "SET_ENV_VAR"
    assert action["confidence"] == 0.9
    disclosure = mock_db.add.call_args[0][0]
    assert disclosure.destination == "glm_api"

@patch("app.remediation.llm_client_factory.CLOUD_LLM_PROVIDER", "nvidia_nim")
@patch("app.remediation.llm_client_factory.requests.post")
def test_get_cloud_remediation_action_nim(mock_post, mock_db):
    mock_res = MagicMock()
    mock_res.json.return_value = {
        "choices": [{"message": {"content": '{"action_type": "NONE", "params": {}, "confidence": 1.0}'}}]
    }
    mock_post.return_value = mock_res
    
    action = get_cloud_remediation_action(mock_db, 12, {"error_class": "unclassified"})
    
    assert action["action_type"] == "NONE"
    assert action["confidence"] == 1.0
    disclosure = mock_db.add.call_args[0][0]
    assert disclosure.destination == "nvidia_nim_api"

@patch("app.remediation.llm_client_factory.CLOUD_LLM_PROVIDER", "anthropic")
@patch("app.remediation.llm_client_factory.requests.post")
def test_get_cloud_remediation_action_failure(mock_post, mock_db):
    mock_post.side_effect = Exception("API error")
    
    action = get_cloud_remediation_action(mock_db, 13, {"error_class": "missing_python_dependency"})
    
    assert action["action_type"] == "NONE"
    assert action["confidence"] == 0.0
    disclosure = mock_db.add.call_args[0][0]
    assert disclosure.destination == "anthropic_api"
