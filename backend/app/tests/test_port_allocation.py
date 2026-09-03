import pytest
from unittest.mock import MagicMock
from app.deployer.port_allocator import allocate_port

def test_allocate_port_finds_first_free():
    db_mock = MagicMock()
    db_mock.query().join().filter().all.return_value = [(8000,), (8001,)]
    
    port = allocate_port(db_mock, 1)
    assert port == 8002
    
    # Verify advisory lock was called
    db_mock.execute.assert_called_once()
    assert "pg_advisory_xact_lock" in str(db_mock.execute.call_args[0][0])
