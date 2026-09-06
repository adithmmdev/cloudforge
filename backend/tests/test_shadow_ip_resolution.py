import pytest
from app.remediation.shadow import run_shadow_verification
from unittest.mock import MagicMock, patch

def test_shadow_ip_resolution(monkeypatch):
    import subprocess
    
    # We will mock subprocess.run, subprocess.getoutput, and socket.gethostbyname
    def mock_getoutput(cmd):
        if cmd == "ip route":
            return "default via 172.99.0.1 dev eth0"
        return ""
        
    monkeypatch.setattr(subprocess, "getoutput", mock_getoutput)
    
    import socket
    def mock_gethostbyname(name):
        raise socket.error("Testing failure")
    monkeypatch.setattr(socket, "gethostbyname", mock_gethostbyname)
    
    mock_run = MagicMock()
    mock_run.return_value.returncode = 0
    mock_run.return_value.stdout = "0.0.0.0:8000\n"
    monkeypatch.setattr(subprocess, "run", mock_run)
    
    import requests
    mock_get = MagicMock()
    mock_get.return_value.status_code = 200
    monkeypatch.setattr(requests, "get", mock_get)
    
    import time
    monkeypatch.setattr(time, "sleep", MagicMock())
    
    db = MagicMock()
    
    # Needs valid MERN structure or just single_container
    import os
    monkeypatch.setattr(os.path, "exists", lambda p: True)
    
    with patch("builtins.open", MagicMock()):
        result = run_shadow_verification(db, 1, 1, "single_container", "/tmp/dummy")
        
    # the requests.get should have been called with 172.99.0.1:8000
    called_urls = [call.args[0] for call in mock_get.call_args_list]
    assert any("172.99.0.1" in url for url in called_urls), f"Expected 172.99.0.1 in {called_urls}"
