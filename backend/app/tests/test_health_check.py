import pytest
from unittest.mock import MagicMock, patch
from app.health.check import check_deployment_health

@patch('app.health.check.requests.get')
def test_check_deployment_health_success(mock_get):
    db_mock = MagicMock()
    deployment_mock = MagicMock()
    instance_mock = MagicMock()
    container_mock = MagicMock()
    
    container_mock.service_name = 'app'
    container_mock.host_port = 8080
    deployment_mock.containers = [container_mock]
    instance_mock.public_ip = '1.2.3.4'
    
    db_mock.query().filter().first.side_effect = [deployment_mock, instance_mock]
    
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_get.return_value = mock_res
    
    result = check_deployment_health(db_mock, 1)
    
    assert result["passed"] is True
    assert result["method"] == "HTTP GET /health"
    assert deployment_mock.health_check_result == "passed"
