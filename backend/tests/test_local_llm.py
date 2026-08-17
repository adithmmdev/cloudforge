import pytest
from unittest.mock import patch, MagicMock
from app.remediation.prompt import parse_llm_response
from app.remediation.local_llm import get_remediation_action

def test_parse_llm_response_valid():
    res = parse_llm_response('{"action_type": "EXPOSE_PORT", "params": {"port": 80, "service": "app"}, "confidence": 0.8}')
    assert res["action_type"] == "EXPOSE_PORT"
    assert res["confidence"] == 0.8
    assert res["params"] == {"port": 80, "service": "app"}

def test_parse_llm_response_markdown():
    res = parse_llm_response('```json\n{"action_type": "NONE", "params": {}, "confidence": 1.0}\n```')
    assert res["action_type"] == "NONE"
    assert res["confidence"] == 1.0

def test_parse_llm_response_invalid():
    res = parse_llm_response('I think you should restart the service')
    assert res["action_type"] == "NONE"
    assert res["confidence"] == 0.0

@patch("app.remediation.local_llm.requests.post")
def test_get_remediation_action_success(mock_post):
    mock_res = MagicMock()
    mock_res.json.return_value = {
        "response": '{"action_type": "ADD_DEPENDENCY", "params": {"package": "requests", "service": "app"}, "confidence": 0.9}'
    }
    mock_post.return_value = mock_res
    
    action = get_remediation_action({"error_class": "missing_python_dependency"})
    
    assert action["action_type"] == "ADD_DEPENDENCY"
    assert action["confidence"] == 0.9
    assert action["params"]["package"] == "requests"
    
@patch("app.remediation.local_llm.requests.post")
def test_get_remediation_action_failure(mock_post):
    mock_post.side_effect = Exception("Ollama is down")
    
    action = get_remediation_action({"error_class": "missing_python_dependency"})
    
    assert action["action_type"] == "NONE"
    assert action["confidence"] == 0.0
