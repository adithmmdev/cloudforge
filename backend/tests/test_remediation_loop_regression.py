import pytest
from unittest.mock import MagicMock
from app.orchestrator.loop import run_orchestration_loop
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.autonomy_setting import AutonomySetting
from app.models.remediation_action import RemediationAction

def test_remediation_duplicate_loop_escalates(monkeypatch):
    db = MagicMock()
    
    deployment = Deployment(id=1, project_id=1, status='pending')
    db.query.return_value.filter.return_value.first.side_effect = [
        deployment, 
        deployment,
        Project(id=1, name='test', framework='express'),
        AutonomySetting(mode='full_auto')
    ]
    
    import app.orchestrator.loop
    monkeypatch.setattr(app.orchestrator.loop, 'run_deployment_pipeline', MagicMock(side_effect=Exception('test fail')))
    monkeypatch.setattr(app.orchestrator.loop, 'classify_error', lambda e: {'error_class': 'test'})
    monkeypatch.setattr(app.orchestrator.loop, 'create_redacted_signature', lambda **kw: {})
    
    past_action = RemediationAction(deployment_id=1, action_type='CHANGE_INTERNAL_PORT', params={'port': 8000}, status='rejected')
    db.query.return_value.filter.return_value.all.return_value = [past_action]
    
    monkeypatch.setattr(app.orchestrator.loop, 'get_local_action', lambda *args: {'action_type': 'CHANGE_INTERNAL_PORT', 'params': {'port': 8000}, 'confidence': 0.9, 'reasoning': ''})
    monkeypatch.setattr(app.orchestrator.loop, 'validate_action', lambda *args: True)
    
    res = run_orchestration_loop(db, 1)
    
    assert res == {'status': 'failed', 'failure_id': None, 'message': 'LLM returned NONE or invalid action'}
