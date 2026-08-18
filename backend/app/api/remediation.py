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
        
    if action.status != "awaiting_approval":
        raise HTTPException(400, "Action is not awaiting approval")
        
    action.status = "shadow_testing"
    db.commit()
    
    deployment = db.query(Deployment).filter(Deployment.id == action.deployment_id).first()
    project = db.query(Project).filter(Project.id == deployment.project_id).first()
    project_dir = f"/tmp/{project.name}"
    
    import shutil, os
    from app.remediation.grammar import apply_action
    from app.remediation.shadow import run_shadow_verification
    from app.detector.registry import registry
    
    try:
        # Run shadow test before applying
        shadow_dir = f"/tmp/shadow_manual_{deployment.id}_{action.id}"
        if os.path.exists(shadow_dir):
            shutil.rmtree(shadow_dir)
        shutil.copytree(project_dir, shadow_dir)
        
        apply_action(shadow_dir, action.action_type, action.params)
        
        adapter, _ = registry.detect(shadow_dir)
        if not adapter:
            raise RuntimeError("Framework detection failed for shadow project")
        framework = adapter.name
        deployment_type = adapter.deployment_type
        
        shadow_success = run_shadow_verification(db, action.id, shadow_dir, deployment_type, framework)
        if not shadow_success:
            action.status = "discarded"
            db.commit()
            return {"status": "error", "message": "Shadow test failed. Action discarded."}
        
        # If shadow passes, apply to main dir and promote
        apply_action(project_dir, action.action_type, action.params)
        action.status = "promoted"
        db.commit()
        return {"status": "ok", "message": "Action promoted and applied"}
    except Exception as e:
        logger.error(f"Failed to apply action {id}: {e}")
        action.status = "discarded"
        db.commit()
        raise HTTPException(500, f"Failed to apply action: {e}")

@router.post("/{id}/reject")
def reject_action(id: int, db: Session = Depends(get_db)):
    action = db.query(RemediationAction).filter(RemediationAction.id == id).first()
    if not action:
        raise HTTPException(404, "Remediation action not found")
        
    if action.status != "awaiting_approval":
        raise HTTPException(400, "Action is not awaiting approval")
        
    action.status = "discarded"
    db.commit()
    return {"status": "ok", "message": "Action rejected"}
