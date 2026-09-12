from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.remediation_action import RemediationAction
from app.models.project import Project
from app.models.deployment import Deployment
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/remediation-actions", tags=["remediation"])

def _run_shadow_and_promote(action_id: int, project_dir: str, deployment_id: int, deployment_type: str, framework: str):
    from app.remediation.grammar import apply_action
    from app.remediation.shadow import run_shadow_verification
    import shutil, os
    from app.orchestrator.loop import run_orchestration_loop
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        action = db.query(RemediationAction).filter(RemediationAction.id == action_id).first()
        if not action: return
        
        deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment: return
        
        shadow_dir = f"/app/uploads/shadow_manual_{deployment.id}_{action.id}"
        if os.path.exists(shadow_dir):
            shutil.rmtree(shadow_dir)
        shutil.copytree(project_dir, shadow_dir)
        
        # Apply the proposed fix to the shadow dir
        apply_action(shadow_dir, action.action_type, action.params)
        
        # Run shadow test
        shadow_success = run_shadow_verification(db, action.id, shadow_dir, deployment_type, framework)
        
        if not shadow_success:
            action.status = "discarded"
            db.commit()
            return
            
        # If shadow passes, apply to main dir and promote
        apply_action(project_dir, action.action_type, action.params)
        action.status = "promoted"
        deployment.status = "pending"
        db.commit()
        
        # Restart the deployment orchestrator loop for the promoted code
        run_orchestration_loop(db, deployment.id)
        
    except Exception as e:
        logger.error(f"Background shadow test failed: {e}")
        db.rollback()
        action = db.query(RemediationAction).filter(RemediationAction.id == action_id).first()
        if action:
            action.status = "discarded"
            db.commit()
    finally:
        db.close()

@router.post("/{id}/approve")
def approve_action(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    action = db.query(RemediationAction).filter(RemediationAction.id == id).first()
    if not action:
        raise HTTPException(404, "Remediation action not found")
        
    if action.status != "awaiting_approval":
        raise HTTPException(400, "Action is not awaiting approval")
        
    action.status = "shadow_testing"
    db.commit()
    
    deployment = db.query(Deployment).filter(Deployment.id == action.deployment_id).first()
    project = db.query(Project).filter(Project.id == deployment.project_id).first()
    project_dir = f"/app/uploads/{project.name}"
    
    from app.detector.registry import registry
    adapter, _ = registry.detect(project_dir)
    if not adapter:
        raise HTTPException(500, "Could not detect framework")
        
    background_tasks.add_task(
        _run_shadow_and_promote, 
        action.id, project_dir, deployment.id, adapter.deployment_type, adapter.name
    )
    
    return {"status": "ok", "message": "Shadow test started in background"}

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
