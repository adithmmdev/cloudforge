import pytest
from unittest.mock import patch, MagicMock
from app.health.check import check_deployment_health
from app.models.deployment import Deployment
from app.models.container import Container
from app.models.instance import Instance

@pytest.fixture
def mock_db():
    return MagicMock()

def setup_mock_db(mock_db, ip="8.8.8.8", port=8000):
    instance = Instance(id=1, public_ip=ip)
    container = Container(service_name="app", host_port=port)
    deployment = Deployment(id=10, instance_id=1)
    deployment.containers = [container]
    
    # We will use side_effect on query to return the right object
    query_mock = MagicMock()
    query_mock.filter.side_effect = lambda condition: MagicMock(
        first=lambda: deployment if "Deployment.id" in str(condition) else instance
    )
    
    def query_side_effect(model):
        m = MagicMock()
        if model == Deployment:
            m.filter.return_value.first.return_value = deployment
        elif model == Instance:
            m.filter.return_value.first.return_value = instance
        else:
            m.filter.return_value.first.return_value = None
        return m
        
    mock_db.query.side_effect = query_side_effect

@patch("app.health.check.requests.get")
@patch("app.health.check.time.sleep")
def test_tier_1_health_pass(mock_sleep, mock_get, mock_db):
    setup_mock_db(mock_db)
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_get.return_value = mock_res
    
    result = check_deployment_health(mock_db, 10)
    
    assert result is True
    assert mock_get.call_count == 1
    args = mock_get.call_args[0]
    assert "/health" in args[0]

@patch("app.health.check.requests.get")
@patch("app.health.check.time.sleep")
def test_tier_2_health_pass(mock_sleep, mock_get, mock_db):
    setup_mock_db(mock_db)
    
    def get_side_effect(url, timeout):
        res = MagicMock()
        if "/health" in url:
            res.status_code = 404
        else:
            res.status_code = 200
        return res
        
    mock_get.side_effect = get_side_effect
    
    result = check_deployment_health(mock_db, 10)
    
    assert result is True
    assert mock_get.call_count == 6  # 5 fails for /health + 1 pass for /

@patch("app.health.check.requests.get")
@patch("app.health.check.socket.create_connection")
@patch("app.health.check.time.sleep")
def test_tier_3_health_pass(mock_sleep, mock_conn, mock_get, mock_db):
    setup_mock_db(mock_db)
    
    def get_side_effect(*args, **kwargs):
        raise Exception("Connection Refused")
        
    mock_get.side_effect = get_side_effect
    
    # TCP connection succeeds on first try
    mock_conn.return_value.__enter__ = MagicMock()
    mock_conn.return_value.__exit__ = MagicMock()
    
    result = check_deployment_health(mock_db, 10)
    
    assert result is True
    assert mock_get.call_count == 10  # 5 fails for /health + 5 fails for /
    assert mock_conn.call_count == 1

@patch("app.health.check.requests.get")
@patch("app.health.check.socket.create_connection")
@patch("app.health.check.time.sleep")
def test_all_tiers_fail(mock_sleep, mock_conn, mock_get, mock_db):
    setup_mock_db(mock_db)
    
    mock_get.side_effect = Exception("Connection Refused")
    mock_conn.side_effect = Exception("Connection Refused")
    
    result = check_deployment_health(mock_db, 10)
    
    assert result is False
    assert mock_get.call_count == 10
    assert mock_conn.call_count == 5
