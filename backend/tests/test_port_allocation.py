import pytest
from unittest.mock import MagicMock, patch
from app.deployer.port_allocator import allocate_port, assign_ports_to_deployment, PORT_POOL_START
from app.models.container import Container
from app.models.deployment import Deployment

@pytest.fixture
def mock_db():
    return MagicMock()

def test_allocate_port_empty(mock_db):
    mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []
    
    port = allocate_port(mock_db, 1)
    assert port == PORT_POOL_START

def test_allocate_port_used(mock_db):
    mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = [(PORT_POOL_START,), (PORT_POOL_START+1,)]
    
    port = allocate_port(mock_db, 1)
    assert port == PORT_POOL_START + 2

def test_allocate_port_full(mock_db):
    from app.deployer.port_allocator import PORT_POOL_END
    # Mock all ports used
    used = [(p,) for p in range(PORT_POOL_START, PORT_POOL_END + 1)]
    mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = used
    
    with pytest.raises(RuntimeError, match="No available ports"):
        allocate_port(mock_db, 1)

def test_assign_ports_to_deployment_single(mock_db):
    mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []
    
    deployment = Deployment(id=1, instance_id=1, deployment_type='single_container')
    c1 = Container(service_name='app')
    deployment.containers = [c1]
    
    assign_ports_to_deployment(mock_db, deployment)
    
    assert c1.host_port == PORT_POOL_START
    assert mock_db.commit.called

def test_assign_ports_to_deployment_mern(mock_db):
    mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []
    
    deployment = Deployment(id=1, instance_id=1, deployment_type='mern')
    c_client = Container(service_name='client')
    c_server = Container(service_name='server')
    c_mongo = Container(service_name='mongo')
    deployment.containers = [c_client, c_server, c_mongo]
    
    assign_ports_to_deployment(mock_db, deployment)
    
    assert c_client.host_port == PORT_POOL_START
    assert c_server.host_port is None
    assert c_mongo.host_port is None
    assert mock_db.commit.called
