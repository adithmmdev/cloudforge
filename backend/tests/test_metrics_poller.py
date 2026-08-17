import pytest
from unittest.mock import patch, MagicMock
from app.metrics.poller import poll_metrics_for_instance, parse_memory, parse_network
from app.models.container import Container
from app.models.deployment import Deployment
from app.models.instance import Instance

def test_parse_memory():
    assert parse_memory("15.2MiB / 2GiB") == 15.2
    assert parse_memory("1GiB / 2GiB") == 1024.0
    assert parse_memory("500KiB / 2GiB") == 500 / 1024
    assert parse_memory("0B / 0B") == 0.0

def test_parse_network():
    assert parse_network("1.5kB / 2.0kB") == (1536, 2048) # 1.5 * 1024 = 1536
    assert parse_network("1MB / 2GB") == (1048576, 2147483648)
    assert parse_network("0B / 0B") == (0, 0)

@pytest.fixture
def mock_db():
    return MagicMock()

@patch("app.metrics.poller.paramiko.SSHClient")
@patch("app.metrics.poller.os.path.exists")
def test_poll_metrics_success(mock_exists, mock_ssh_class, mock_db):
    instance = Instance(id=1, public_ip="8.8.8.8")
    
    deployment = Deployment(id=10, project_id=1, instance_id=1, status='success')
    container = Container(id=100, service_name='app', deployment_id=10)
    deployment.containers = [container]
    
    def query_side_effect(model):
        m = MagicMock()
        if model == Deployment:
            m.filter.return_value.all.return_value = [deployment]
        else:
            m.filter_by.return_value.first.return_value = None
        return m
        
    mock_db.query.side_effect = query_side_effect
    
    mock_ssh = MagicMock()
    stdout_mock = MagicMock()
    
    # Mock docker stats output
    stats_json = '{"Name":"proj_1_10","CPUPerc":"2.5%","MemUsage":"10MiB / 2GiB","NetIO":"1kB / 2kB"}\n'
    stdout_mock.read.return_value = stats_json.encode()
    mock_ssh.exec_command.return_value = (None, stdout_mock, None)
    mock_ssh_class.return_value = mock_ssh
    
    poll_metrics_for_instance(mock_db, instance)
    
    assert mock_ssh.exec_command.called
    assert mock_db.add.called
    
    metric = mock_db.add.call_args[0][0]
    assert metric.container_id == 100
    assert metric.cpu_percent == 2.5
    assert metric.mem_usage_mb == 10.0
    assert metric.net_in_bytes == 1024
    assert metric.net_out_bytes == 2048
