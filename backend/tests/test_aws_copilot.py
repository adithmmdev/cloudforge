import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import get_db

client = TestClient(app)

def test_create_session():
    response = client.post("/api/aws-copilot/sessions")
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["title"] == "New AWS Chat"

def test_get_sessions():
    response = client.get("/api/aws-copilot/sessions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_get_session():
    res = client.post("/api/aws-copilot/sessions")
    sid = res.json()["id"]
    response = client.get(f"/api/aws-copilot/sessions/{sid}")
    assert response.status_code == 200
    assert response.json()["id"] == sid
    assert "messages" in response.json()

def test_delete_session():
    res = client.post("/api/aws-copilot/sessions")
    sid = res.json()["id"]
    response = client.delete(f"/api/aws-copilot/sessions/{sid}")
    assert response.status_code == 200
    
    response = client.get(f"/api/aws-copilot/sessions/{sid}")
    assert response.status_code == 404
