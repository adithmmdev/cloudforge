from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.remediation_action import RemediationAction
from app.models.project import Project
from app.models.deployment import Deployment
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/remediation-actions", tags=["remediation"])

@router.post("/{id}/approve")
def approve_action(id: int, db: Session = Depends(get_db)):
    action = db.query(RemediationAction).filter(RemediationAction.id == id).first()
    if not action:
        raise HTTPException(404, "Remediation action not found")
        
    if action.status != "proposed":
        raise HTTPException(400, "Action is not in proposed state")
        
    action.status = "approved"
    db.commit()
    
    # We should trigger the apply here or the orchestrator should pick it up
    # Let's apply it right away
    deployment = db.query(Deployment).filter(Deployment.id == action.deployment_id).first()
    project = db.query(Project).filter(Project.id == deployment.project_id).first()
    project_dir = f"/tmp/{project.name}"
    
    from app.remediation.grammar import apply_action
    try:
        apply_action(project_dir, action.action_type, action.params)
        return {"status": "ok", "message": "Action applied"}
    except Exception as e:
        logger.error(f"Failed to apply action {id}: {e}")
        raise HTTPException(500, f"Failed to apply action: {e}")

@router.post("/{id}/reject")
def reject_action(id: int, db: Session = Depends(get_db)):
    action = db.query(RemediationAction).filter(RemediationAction.id == id).first()
    if not action:
        raise HTTPException(404, "Remediation action not found")
        
    if action.status != "proposed":
        raise HTTPException(400, "Action is not in proposed state")
        
    action.status = "rejected"
    db.commit()
    return {"status": "ok", "message": "Action rejected"}
