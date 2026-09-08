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
import json as _json
from app.models.stage_event import StageEvent as _SE
from app.deployer.rollback import trigger_rollback
from app.health.check import check_deployment_health
from app.doc_generator.generator import generate_deployment_report


logger = logging.getLogger(__name__)

LOCAL_CONFIDENCE_THRESHOLD = float(os.getenv("LOCAL_CONFIDENCE_THRESHOLD", 0.75))
MAX_REMEDIATION_ATTEMPTS = 4

def run_orchestration_loop(db: Session, deployment_id: int):
    attempt_number = 1
    terminal_status = None
    
    try:
        while attempt_number <= MAX_REMEDIATION_ATTEMPTS:
            deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
            if not deployment or deployment.status == "cancelled":
                logger.info(f"Deployment {deployment_id} cancelled. Stopping orchestration loop.")
                terminal_status = "cancelled"
                return {"status": "cancelled"}
                
            try:
                run_deployment_pipeline(db, deployment_id)
                
                # ACTUAL HEALTH CHECK
                health_res = check_deployment_health(db, deployment_id)
                if not health_res["passed"]:
                    raise RuntimeError(f"Health check failed after deployment. Error: {health_res.get('error', 'unreachable')}")
                    
                logger.info(f"Deployment {deployment_id} succeeded on attempt {attempt_number}.")
                
                # Post-deployment AI success verification
                try:
                    success_failure = Failure(
                        deployment_id=deployment_id,
                        error_message=f"All containers deployed successfully and passed health checks (Method: {health_res['method']}, {health_res['ms']}ms).",
                        error_class="deployment_success"
                    )
                    db.add(success_failure)
                    db.commit()
                    
                    success_diagnosis = Diagnosis(
                        failure_id=success_failure.id,
                        model_tier="system",
                        cloud_provider="system",
                        confidence=1.0,
                        action_type="NONE",
                        params={},
                        reasoning="Deployment passed health checks. Marking successful."
                    )
                    db.add(success_diagnosis)
                    db.commit()
                except Exception as inner_e:
                    logger.error(f"Failed to create success diagnosis: {inner_e}")

                deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
                if deployment and deployment.status == "deployed":
                    deployment.status = "live"
                    from app.models.stage_event import StageEvent
                    db.add(StageEvent(deployment_id=deployment_id, stage='live', detail='Deployment verified and traffic is live'))
                    db.commit()
                    logger.info(f"Deployment {deployment_id} transitioned to live.")
                    terminal_status = "success"
                return {"status": "success"}
                
            except Exception as e:
                logger.error(f"Deployment {deployment_id} failed on attempt {attempt_number}: {e}")
                error_msg = str(e)
                
                deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
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
                    extracted_token=classification.get("extracted_token")
                )
                db.add(failure)
                db.commit()
                
                if mode == "suggest_only":
                    deployment.status = "failed"
                    db.commit()
                    terminal_status = "failed"
                    return {"status": "failed", "failure_id": failure.id, "message": "suggest_only mode: stopped after failure"}
                    
                actual_exit_code = getattr(e, 'exit_code', 1)
                sig = create_redacted_signature(
                    error_class=classification["error_class"],
                    framework=framework,
                    deployment_type=deployment_type,
                    service=service,
                    extracted_token=classification.get("extracted_token"),
                    exit_code=actual_exit_code,
                    attempt_number=attempt_number
                )
                
                # Fetch past rejected actions for this deployment
                past_actions_recs = db.query(RemediationAction).filter(
                    RemediationAction.deployment_id == deployment_id,
                    RemediationAction.status == 'rejected'
                ).all()
                
                past_actions_list = [
                    {"action_type": a.action_type, "params": a.params, "failure_reason": "Shadow verification failed"} 
                    for a in past_actions_recs
                ]
                
                # 1. Try Local LLM
                if attempt_number <= 3:
                    local_action = get_local_action(db, sig, past_actions_list)
                    
                    # 2. Threshold Check
                    if local_action.get("confidence", 0.0) >= LOCAL_CONFIDENCE_THRESHOLD and local_action.get("action_type") != "NONE":
                        action_data = local_action
                        model_tier = "local"
                        provider = "ollama"
                    else:
                        logger.info("Local LLM confidence below threshold or returned NONE. Escalating to Cloud Provider.")
                        # 3. Escalate to Cloud
                        cloud_action = get_cloud_remediation_action(db, failure.id, sig, past_actions_list)
                        action_data = cloud_action
                        model_tier = "cloud"
                        provider = "nvidia_nim"
                else:
                    logger.info("3 attempts failed. Forcing Kimi fallback.")
                    cloud_action = get_cloud_remediation_action(db, failure.id, sig, past_actions_list)
                    action_data = cloud_action
                    model_tier = "cloud"
                    provider = "nvidia_nim"
                    
                is_valid = validate_action(deployment_type, container_services, action_data["action_type"], action_data.get("params", {}))
                
                # Create canonical fingerprint for duplicate rejection
                canonical_fingerprint = _json.dumps(
                    {"action_type": action_data["action_type"], "params": action_data.get("params", {})},
                    sort_keys=True
                )
                
                past_fingerprints = [
                    _json.dumps({"action_type": a["action_type"], "params": a["params"]}, sort_keys=True)
                    for a in past_actions_list
                ]
                
                if not is_valid or canonical_fingerprint in past_fingerprints:
                    action_data["action_type"] = "NONE"
                    action_data["params"] = {}
                    action_data["reasoning"] += f"\n\n[SYSTEM] Automatically escalated to NONE because action was {'invalid' if not is_valid else 'a duplicate of a previously rejected action'}."
                    
                diagnosis = Diagnosis(
                    failure_id=failure.id,
                    model_tier=model_tier,
                    cloud_provider=provider,
                    confidence=action_data.get("confidence", 0.0),
                    action_type=action_data["action_type"],
                    params=action_data.get("params", {}),
                    reasoning=action_data.get("reasoning", "")
                )
                db.add(diagnosis)
                db.commit()
                db.refresh(diagnosis)
                
                # Write a stage event so WS polling picks up the diagnosis
                db.add(_SE(deployment_id=deployment_id, stage='diagnosis', detail=_json.dumps({
                    "diagnosis_id": diagnosis.id,
                    "action_type": diagnosis.action_type,
                    "confidence": diagnosis.confidence,
                    "model_tier": diagnosis.model_tier,
                    "cloud_provider": diagnosis.cloud_provider,
                    "reasoning": diagnosis.reasoning,
                    "params": diagnosis.params or {}
                })))
                db.commit()
                
                rem_action = RemediationAction(
                    diagnosis_id=diagnosis.id,
                    deployment_id=deployment_id,
                    action_type=action_data["action_type"],
                    params=action_data.get("params", {}),
                    status="discarded" if action_data["action_type"] == "NONE" else "awaiting_approval"
                )
                db.add(rem_action)
                db.commit()
                
                if action_data["action_type"] == "NONE":
                    deployment.status = "failed"
                    db.commit()
                    terminal_status = "failed"
                    return {"status": "failed", "failure_id": failure.id, "message": "LLM returned NONE or invalid action"}
                    
                if mode == "approve_each":
                    deployment.status = "remediation_proposed"
                    # Write stage event so WS knows to show approval UI
                    db.add(_SE(deployment_id=deployment_id, stage='awaiting_approval', detail=str(rem_action.id)))
                    db.commit()
                    # Approval means it pauses. It's not terminal.
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
                    
                    shadow_output = "Unknown shadow test failure"
                    if not shadow_success:
                        from app.models.shadow_test import ShadowTest
                        st = db.query(ShadowTest).filter(ShadowTest.remediation_action_id == rem_action.id, ShadowTest.passed == False).first()
                        if st:
                            shadow_output = f"{st.test_name} failed:\n{st.output}"
                except Exception as shadow_e:
                    logger.error(f"Shadow failed with exception: {shadow_e}")
                    shadow_success = False
                    shadow_output = str(shadow_e)
                    
                if shadow_success:
                    rem_action.status = "promoted"
                    db.commit()
                    # Apply promotion and continue
                    apply_action(project_dir, rem_action.action_type, rem_action.params)
                    attempt_number += 1
                    continue 
                else:
                    rem_action.status = "rejected"
                    
                    # Add a new failure specifically for the shadow test so the LLM can try to fix the fix
                    db.add(Failure(
                        deployment_id=deployment_id,
                        error_message=f"Shadow Verification Failed:\n{shadow_output}",
                        error_class="shadow_verification_failure"
                    ))
                    db.commit()
                    
                    attempt_number += 1
                    continue
                    
        terminal_status = "max_retries_exceeded"
        deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if deployment and deployment.status not in ["failed", "rolled_back", "live", "cancelled"]:
            deployment.status = "failed"
            db.commit()
        return {"status": "max_retries_exceeded"}

    finally:
        if terminal_status in ["failed", "max_retries_exceeded"]:
            try:
                trigger_rollback(db, deployment_id)
            except Exception as rb_err:
                logger.error(f"Rollback failed for {deployment_id}: {rb_err}")
                
        # Always generate report on terminal completion (success or failure)
        if terminal_status in ["success", "failed", "max_retries_exceeded", "cancelled"]:
            try:
                generate_deployment_report(db, deployment_id)
                logger.info(f"Generated report for {deployment_id} on {terminal_status}")
            except Exception as rpt_err:
                logger.error(f"Failed to generate report for {deployment_id}: {rpt_err}")
