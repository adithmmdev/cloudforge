import logging
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.autonomy_setting import AutonomySetting
from app.models.failure import Failure
from app.models.remediation_action import RemediationAction
from app.deployer.pipeline import run_deployment_pipeline
from app.remediation.classifier import classify_error
from app.remediation.redactor import create_redacted_signature
from app.remediation.llm_client_factory import get_cloud_remediation_action
from app.remediation.grammar import validate_action
from app.remediation.shadow import run_shadow_verification

logger = logging.getLogger(__name__)

def run_orchestration_loop(db: Session, deployment_id: int):
    try:
        run_deployment_pipeline(db, deployment_id)
        logger.info(f"Deployment {deployment_id} succeeded on first try.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Deployment {deployment_id} failed: {e}")
        error_msg = str(e)
        
        deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            return {"status": "error", "message": "Deployment not found"}
            
        project = db.query(Project).filter(Project.id == deployment.project_id).first()
        autonomy = db.query(AutonomySetting).filter(AutonomySetting.project_id == project.id).first()
        
        mode = autonomy.mode if autonomy else "approve_each"
        
        classification = classify_error(error_msg)
        framework = project.framework
        deployment_type = "mern" if framework == "mern" else "single_container"
        service = "client" if framework == "mern" else "app" 
        container_services = ["client", "server", "mongo"] if framework == "mern" else ["app"]
        
        failure = Failure(
            deployment_id=deployment_id,
            error_message=error_msg,
            error_class=classification["error_class"],
            extracted_token=classification["extracted_token"]
        )
        db.add(failure)
        db.commit()
        
        if mode == "suggest_only":
            return {"status": "failed", "failure_id": failure.id, "message": "suggest_only mode: stopped after failure"}
            
        sig = create_redacted_signature(
            error_class=classification["error_class"],
            framework=framework,
            deployment_type=deployment_type,
            service=service,
            extracted_token=classification["extracted_token"],
            exit_code=1,
            attempt_number=1
        )
        
        action = get_cloud_remediation_action(db, failure.id, sig)
        
        is_valid = validate_action(deployment_type, container_services, action["action_type"], action.get("params", {}))
        if not is_valid:
            action["action_type"] = "NONE"
            action["params"] = {}
            
        rem_action = RemediationAction(
            failure_id=failure.id,
            action_type=action["action_type"],
            params=action["params"],
            confidence=action["confidence"]
        )
        db.add(rem_action)
        db.commit()
        
        if action["action_type"] == "NONE":
            return {"status": "failed", "failure_id": failure.id, "message": "LLM returned NONE or invalid action"}
            
        if mode == "approve_each":
            return {"status": "awaiting_approval", "remediation_action_id": rem_action.id}
            
        project_dir = f"/tmp/{project.name}"
        shadow_success = run_shadow_verification(db, rem_action.id, project_dir, deployment_type, framework)
        
        if shadow_success:
            return {"status": "shadow_success", "message": "Shadow passed, ready to auto-apply"}
        else:
            return {"status": "shadow_failed", "message": "Shadow verification failed"}
