import logging
import os
import shutil
from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.autonomy_setting import AutonomySetting
from app.models.failure import Failure
from app.models.diagnosis import Diagnosis
from app.models.remediation_action import RemediationAction
from app.deployer.deploy import run_deployment_pipeline
from app.remediation.classifier import classify_error
from app.remediation.redactor import create_redacted_signature
from app.remediation.local_llm import get_remediation_action as get_local_action
from app.remediation.llm_client_factory import get_cloud_remediation_action
from app.remediation.grammar import validate_action, apply_action
from app.remediation.shadow import run_shadow_verification

logger = logging.getLogger(__name__)

LOCAL_CONFIDENCE_THRESHOLD = 0.8
MAX_REMEDIATION_ATTEMPTS = 3

def run_orchestration_loop(db: Session, deployment_id: int):
    attempt_number = 1
    
    while attempt_number <= MAX_REMEDIATION_ATTEMPTS:
        try:
            run_deployment_pipeline(db, deployment_id)
            logger.info(f"Deployment {deployment_id} succeeded on attempt {attempt_number}.")
            
            deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
            if deployment and deployment.status == "deployed":
                deployment.status = "live"
                db.commit()
                # Generate report
                from app.doc_generator.generator import generate_deployment_report
                generate_deployment_report(db, deployment_id)
                logger.info(f"Deployment {deployment_id} transitioned to live and report generated.")
                
            return {"status": "success"}
        except Exception as e:
            logger.error(f"Deployment {deployment_id} failed on attempt {attempt_number}: {e}")
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
                attempt_number=attempt_number
            )
            
            # 1. Try Local LLM
            local_action = get_local_action(sig)
            
            action_data = None
            if local_action.get("confidence", 0.0) >= LOCAL_CONFIDENCE_THRESHOLD:
                action_data = local_action
                model_tier = "local"
                provider = "ollama"
            else:
                # 2. Escalate to Cloud LLM
                cloud_action = get_cloud_remediation_action(db, failure.id, sig)
                action_data = cloud_action
                model_tier = "cloud"
                provider = os.getenv("CLOUD_LLM_PROVIDER", "anthropic")
                
            is_valid = validate_action(deployment_type, container_services, action_data["action_type"], action_data.get("params", {}))
            if not is_valid:
                action_data["action_type"] = "NONE"
                action_data["params"] = {}
                
            diagnosis = Diagnosis(
                failure_id=failure.id,
                model_tier=model_tier,
                cloud_provider=provider,
                confidence=action_data.get("confidence", 0.0),
                action_type=action_data["action_type"],
                params=action_data["params"],
                reasoning=action_data.get("reasoning", "")
            )
            db.add(diagnosis)
            db.commit()
            db.refresh(diagnosis)
            
            rem_action = RemediationAction(
                diagnosis_id=diagnosis.id,
                deployment_id=deployment_id,
                action_type=action_data["action_type"],
                params=action_data["params"],
                status="awaiting_approval"
            )
            db.add(rem_action)
            db.commit()
            
            if action_data["action_type"] == "NONE":
                return {"status": "failed", "failure_id": failure.id, "message": "LLM returned NONE or invalid action"}
                
            if mode == "approve_each":
                return {"status": "awaiting_approval", "remediation_action_id": rem_action.id}
                
            project_dir = f"/app/uploads/{project.name}"
            if not os.path.exists(project_dir):
                project_dir = os.path.join(os.getenv("FIXTURES_DIR", "tests/fixtures"), project.name)
            # Copy to shadow dir to prevent messing up the main dir during test
            shadow_dir = f"/app/uploads/shadow_{deployment_id}_{attempt_number}"
            if os.path.exists(shadow_dir):
                shutil.rmtree(shadow_dir)
            shutil.copytree(project_dir, shadow_dir)
            
            try:
                apply_action(shadow_dir, rem_action.action_type, rem_action.params)
                shadow_success = run_shadow_verification(db, rem_action.id, shadow_dir, deployment_type, framework)
            except Exception as shadow_e:
                logger.error(f"Shadow failed with exception: {shadow_e}")
                shadow_success = False
                
            if shadow_success:
                logger.info(f"Shadow passed for {rem_action.id}, applying to main code and retrying.")
                apply_action(project_dir, rem_action.action_type, rem_action.params)
                rem_action.status = "approved"
                db.commit()
                attempt_number += 1
                continue # Retry pipeline
            else:
                rem_action.status = "rejected"
                db.commit()
                return {"status": "shadow_failed", "message": "Shadow verification failed"}
                
    return {"status": "max_retries_exceeded"}
