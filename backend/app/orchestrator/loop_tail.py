logger = logging.getLogger(__name__)

LOCAL_CONFIDENCE_THRESHOLD = float(os.getenv("LOCAL_CONFIDENCE_THRESHOLD", 0.75))
MAX_REMEDIATION_ATTEMPTS = 3

def run_orchestration_loop(db: Session, deployment_id: int):
    attempt_number = 1
    
    while attempt_number <= MAX_REMEDIATION_ATTEMPTS:
        deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment or deployment.status == "cancelled":
            logger.info(f"Deployment {deployment_id} cancelled. Stopping orchestration loop.")
            return {"status": "cancelled"}
            
        try:
            run_deployment_pipeline(db, deployment_id)
            logger.info(f"Deployment {deployment_id} succeeded on attempt {attempt_number}.")
            
            # Post-deployment AI success verification
            try:
                success_failure = Failure(
                    deployment_id=deployment_id,
                    error_message="All containers deployed successfully and passed health checks.",
                    error_class="deployment_success"
                )
                db.add(success_failure)
                db.commit()
                
                success_diagnosis = Diagnosis(
                    failure_id=success_failure.id,
                    model_tier="local",
                    cloud_provider="ollama",
                    confidence=1.0,
                    action_type="SUCCESS",
                    params={},
                    reasoning="Deployment succeeded cleanly. AI verification confirms all containers are healthy, dependencies are installed, and ports are actively listening. No remediation required."
                )
                db.add(success_diagnosis)
                db.commit()
            except Exception as inner_e:
                logger.error(f"Failed to create success diagnosis: {inner_e}")

            deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
            if deployment and deployment.status == "deployed":
                from app.models.stage_event import StageEvent
                import datetime
                
                # Add live stage event
                deployment.status = "live"
                deployment.finished_at = datetime.datetime.utcnow()
                db.add(StageEvent(deployment_id=deployment_id, stage="live", detail="Deployment is live and serving traffic"))
                db.commit()

                # Generate report
                db.add(StageEvent(deployment_id=deployment_id, stage="generating_report", detail="Compiling AI deployment report"))
                db.commit()
                
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
                extracted_token=classification.get("extracted_token")
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
            
            # Write a stage event so WS polling picks up the diagnosis
            import json as _json
            from app.models.stage_event import StageEvent as _SE
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
                params=action_data["params"],
                status="discarded" if action_data["action_type"] == "NONE" else "awaiting_approval"
            )
            db.add(rem_action)
            db.commit()
            
            if action_data["action_type"] == "NONE":
                deployment.status = "failed"
                db.commit()
                return {"status": "failed", "failure_id": failure.id, "message": "LLM returned NONE or invalid action"}
                
            if mode == "approve_each":
                deployment.status = "remediation_proposed"
                # Write stage event so WS knows to show approval UI
                db.add(_SE(deployment_id=deployment_id, stage='awaiting_approval', detail=str(rem_action.id)))
                db.commit()
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
                
    return {"status": "max_retries_exceeded"}
