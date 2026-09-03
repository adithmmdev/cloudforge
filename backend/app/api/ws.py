import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.db.session import SessionLocal
from app.models.deployment import Deployment
from app.models.stage_event import StageEvent
from app.models.metric import Metric
from app.models.failure import Failure
from app.models.diagnosis import Diagnosis
from app.models.disclosure import Disclosure
from app.models.remediation_action import RemediationAction
from app.models.shadow_test import ShadowTest
from app.models.instance import Instance
from app.models.container import Container

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/deployments/{deployment_id}")
async def deployment_websocket(websocket: WebSocket, deployment_id: int):
    await websocket.accept()

    db = SessionLocal()
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    db.close()

    if not deployment:
        await websocket.close(code=1008, reason="Deployment not found")
        return

    last_event_id = 0
    last_diagnosis_id = 0
    last_disclosure_id = 0
    last_shadow_id = 0
    last_remediation_id = 0
    terminal_sent = False
    # After terminal status, do a few extra polls to flush any last events
    terminal_extra_polls = 0
    TERMINAL_EXTRA_POLLS = 4

    try:
        while True:
            db = SessionLocal()
            try:
                deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
                if not deployment:
                    break

                # 1. Stage events — split into log_line vs stage_update
                new_events = db.query(StageEvent).filter(
                    StageEvent.deployment_id == deployment_id,
                    StageEvent.id > last_event_id
                ).order_by(StageEvent.id.asc()).all()

                for ev in new_events:
                    if ev.stage == 'log':
                        # Parse optional "service:text" format
                        detail = ev.detail or ''
                        service = 'app'
                        text = detail
                        if ':' in detail and len(detail.split(':', 1)[0]) < 20:
                            parts = detail.split(':', 1)
                            service = parts[0].strip()
                            text = parts[1].strip()
                        await websocket.send_json({
                            "event": "log_line",
                            "text": text,
                            "service": service,
                            "created_at": ev.created_at.isoformat() if ev.created_at else None
                        })
                    else:
                        await websocket.send_json({
                            "event": "stage_update",
                            "stage": ev.stage,
                            "detail": ev.detail,
                            "created_at": ev.created_at.isoformat() if ev.created_at else None
                        })
                    last_event_id = ev.id

                # 2. Diagnoses — poll via failures
                failures = db.query(Failure).filter(Failure.deployment_id == deployment_id).all()
                for failure in failures:
                    new_diags = db.query(Diagnosis).filter(
                        Diagnosis.failure_id == failure.id,
                        Diagnosis.id > last_diagnosis_id
                    ).order_by(Diagnosis.id.asc()).all()
                    for diag in new_diags:
                        await websocket.send_json({
                            "event": "diagnosis_proposed",
                            "id": diag.id,
                            "action_type": diag.action_type,
                            "confidence": diag.confidence,
                            "model_tier": diag.model_tier,
                            "cloud_provider": diag.cloud_provider,
                            "reasoning": diag.reasoning,
                            "params": diag.params or {}
                        })
                        last_diagnosis_id = diag.id

                    # 3. Disclosures
                    new_discs = db.query(Disclosure).filter(
                        Disclosure.failure_id == failure.id,
                        Disclosure.id > last_disclosure_id
                    ).order_by(Disclosure.id.asc()).all()
                    for disc in new_discs:
                        await websocket.send_json({
                            "event": "disclosure_logged",
                            "id": disc.id,
                            "destination": disc.destination,
                            "provider_name": disc.destination,
                            "content_sent": disc.content_sent,
                            "redacted_signature": disc.content_sent,
                            "timestamp": disc.created_at.isoformat() if disc.created_at else None
                        })
                        last_disclosure_id = disc.id

                # 4. Shadow tests via remediation actions
                rem_actions = db.query(RemediationAction).filter(
                    RemediationAction.deployment_id == deployment_id
                ).all()
                for action in rem_actions:
                    new_shadows = db.query(ShadowTest).filter(
                        ShadowTest.remediation_action_id == action.id,
                        ShadowTest.id > last_shadow_id
                    ).order_by(ShadowTest.id.asc()).all()
                    for st in new_shadows:
                        await websocket.send_json({
                            "event": "shadow_test_result",
                            "remediation_action_id": action.id,
                            "test_name": st.test_name,
                            "passed": st.passed,
                            "output": st.output,
                            "timestamp": st.ran_at.isoformat() if st.ran_at else None
                        })
                        last_shadow_id = st.id

                    # 5. Awaiting approval — only fire ONCE per action (guard by last_remediation_id)
                    if action.id > last_remediation_id:
                        if action.status == 'awaiting_approval':
                            await websocket.send_json({
                                "event": "awaiting_approval",
                                "remediation_action_id": action.id
                            })
                        last_remediation_id = action.id

                    # 5b. Notify when action status changes away from awaiting_approval
                    if action.id <= last_remediation_id:
                        if action.status == 'promoted':
                            await websocket.send_json({
                                "event": "remediation_promoted",
                                "remediation_action_id": action.id
                            })
                        elif action.status == 'shadow_testing':
                            await websocket.send_json({
                                "event": "remediation_shadow_testing",
                                "remediation_action_id": action.id
                            })
                        elif action.status in ('discarded', 'rejected'):
                            await websocket.send_json({
                                "event": "remediation_rejected",
                                "remediation_action_id": action.id
                            })

                # 6. Metrics
                containers = db.query(Container).filter(Container.deployment_id == deployment_id).all()
                for container in containers:
                    latest_metric = db.query(Metric).filter(
                        Metric.container_id == container.id
                    ).order_by(Metric.timestamp.desc()).first()
                    if latest_metric:
                        await websocket.send_json({
                            "event": "metrics",
                            "service": container.service_name,
                            "cpu_percent": latest_metric.cpu_percent,
                            "mem_usage_mb": latest_metric.mem_usage_mb,
                            "timestamp": latest_metric.timestamp.isoformat()
                        })

                # 7. Terminal states — send once, then do extra polls to flush shadow/log events
                is_terminal = deployment.status in ['live', 'failed', 'rolled_back', 'cancelled']

                if is_terminal and not terminal_sent:
                    if deployment.status == 'live':
                        app_url = None
                        instance = db.query(Instance).filter(
                            Instance.id == deployment.instance_id
                        ).first() if deployment.instance_id else None
                        public_container = db.query(Container).filter(
                            Container.deployment_id == deployment_id,
                            Container.host_port != None
                        ).first()
                        if instance and instance.public_ip and public_container:
                            app_url = f"http://{instance.public_ip}:{public_container.host_port}"
                        await websocket.send_json({
                            "event": "deployment_complete",
                            "app_url": app_url
                        })
                    else:
                        await websocket.send_json({
                            "event": "deployment_failed",
                            "rolled_back": deployment.status == 'rolled_back',
                            "cancelled": deployment.status == 'cancelled',
                            "reason": "Check logs and timeline for details"
                        })
                    terminal_sent = True

                if terminal_sent:
                    terminal_extra_polls += 1
                    if terminal_extra_polls >= TERMINAL_EXTRA_POLLS and deployment.status != 'live':
                        break

            finally:
                db.close()

            await asyncio.sleep(2)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=1011, reason=str(e)[:100])
        except Exception:
            pass

@router.websocket("/global")
async def global_websocket(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            db = SessionLocal()
            try:
                # Get projects and deployments
                from app.models.project import Project
                
                projects = db.query(Project).all()
                proj_data = []
                for p in projects:
                    latest = db.query(Deployment).filter(Deployment.project_id == p.id).order_by(Deployment.started_at.desc()).first()
                    proj_data.append({
                        "id": p.id,
                        "name": p.name,
                        "framework": p.framework,
                        "status": latest.status if latest else p.status,
                        "last_deployment_id": latest.id if latest else None,
                    })

                # Get instances and their stats
                instances = db.query(Instance).all()
                inst_data = []
                for inst in instances:
                    inst_data.append({
                        "id": inst.id,
                        "aws_instance_id": inst.aws_instance_id,
                        "public_ip": inst.public_ip,
                        "state": inst.status,
                        "instance_type": "t3.micro"
                    })
                
                # Active deployments for Control Center - include live so they can be stopped
                active_deps = db.query(Deployment).filter(
                    Deployment.status.in_(['pending', 'building', 'deploying', 'health_check', 'healing', 'live', 'remediation_proposed'])
                ).order_by(Deployment.started_at.desc()).all()
                active_deps_data = [{"id": d.id, "project_id": d.project_id, "status": d.status, "started_at": d.started_at.isoformat() if d.started_at else None} for d in active_deps]

                await websocket.send_json({
                    "event": "global_sync",
                    "projects": proj_data,
                    "instances": inst_data,
                    "active_deployments": active_deps_data
                })
            except Exception as inner_e:
                import logging
                logging.getLogger(__name__).error(f"Global WS Error: {inner_e}")
                break
            finally:
                db.close()
            
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=1011, reason=str(e)[:100])
        except Exception:
            pass
