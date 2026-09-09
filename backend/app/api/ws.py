import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
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
from app.models.project import Project

router = APIRouter(prefix="/ws", tags=["websocket"])

def fetch_deployment_data(deployment_id, last_event_id, last_diagnosis_id, last_disclosure_id, last_shadow_id, last_remediation_id):
    db = SessionLocal()
    try:
        deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
        if not deployment:
            return None
            
        events = []
        
        # 1. Stage events
        new_events = db.query(StageEvent).filter(
            StageEvent.deployment_id == deployment_id,
            StageEvent.id > last_event_id
        ).order_by(StageEvent.id.asc()).all()
        
        for ev in new_events:
            if ev.stage == 'log':
                detail = ev.detail or ''
                service = 'app'
                text = detail
                if ':' in detail and len(detail.split(':', 1)[0]) < 20:
                    parts = detail.split(':', 1)
                    service = parts[0].strip()
                    text = parts[1].strip()
                events.append({
                    "event": "log_line",
                    "text": text,
                    "service": service,
                    "created_at": ev.created_at.isoformat() if ev.created_at else None
                })
            else:
                events.append({
                    "event": "stage_update",
                    "stage": ev.stage,
                    "detail": ev.detail,
                    "created_at": ev.created_at.isoformat() if ev.created_at else None
                })
            last_event_id = ev.id

        # 2. Diagnoses
        failures = db.query(Failure).filter(Failure.deployment_id == deployment_id).all()
        for failure in failures:
            new_diags = db.query(Diagnosis).filter(
                Diagnosis.failure_id == failure.id,
                Diagnosis.id > last_diagnosis_id
            ).order_by(Diagnosis.id.asc()).all()
            for diag in new_diags:
                events.append({
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

            new_discs = db.query(Disclosure).filter(
                Disclosure.failure_id == failure.id,
                Disclosure.id > last_disclosure_id
            ).order_by(Disclosure.id.asc()).all()
            for disc in new_discs:
                events.append({
                    "event": "disclosure_logged",
                    "id": disc.id,
                    "destination": disc.destination,
                    "provider_name": disc.destination,
                    "content_sent": disc.content_sent,
                    "redacted_signature": disc.content_sent,
                    "timestamp": disc.created_at.isoformat() if disc.created_at else None
                })
                last_disclosure_id = disc.id

        # 4. Shadow tests
        rem_actions = db.query(RemediationAction).filter(RemediationAction.deployment_id == deployment_id).all()
        for action in rem_actions:
            new_shadows = db.query(ShadowTest).filter(
                ShadowTest.remediation_action_id == action.id,
                ShadowTest.id > last_shadow_id
            ).order_by(ShadowTest.id.asc()).all()
            for st in new_shadows:
                events.append({
                    "event": "shadow_test_result",
                    "remediation_action_id": action.id,
                    "test_name": st.test_name,
                    "passed": st.passed,
                    "output": st.output,
                    "timestamp": st.ran_at.isoformat() if st.ran_at else None
                })
                last_shadow_id = st.id

            if action.id > last_remediation_id:
                if action.status == 'awaiting_approval':
                    events.append({
                        "event": "awaiting_approval",
                        "remediation_action_id": action.id
                    })
                last_remediation_id = action.id

            if action.id <= last_remediation_id:
                if action.status == 'promoted':
                    events.append({"event": "remediation_promoted", "remediation_action_id": action.id})
                elif action.status == 'shadow_testing':
                    events.append({"event": "remediation_shadow_testing", "remediation_action_id": action.id})
                elif action.status in ('discarded', 'rejected', 'failed'):
                    events.append({"event": "remediation_rejected", "remediation_action_id": action.id})

        # 6. Metrics
        containers = db.query(Container).filter(Container.deployment_id == deployment_id).all()
        for container in containers:
            latest_metric = db.query(Metric).filter(Metric.container_id == container.id).order_by(Metric.timestamp.desc()).first()
            if latest_metric:
                events.append({
                    "event": "metrics",
                    "service": container.service_name,
                    "cpu_percent": latest_metric.cpu_percent,
                    "mem_usage_mb": latest_metric.mem_usage_mb,
                    "timestamp": latest_metric.timestamp.isoformat()
                })

        # 7. Terminal states
        terminal_event = None
        is_terminal = deployment.status in ['live', 'failed', 'rolled_back', 'cancelled']
        
        if is_terminal:
            if deployment.status == 'live':
                app_url = None
                instance = db.query(Instance).filter(Instance.id == deployment.instance_id).first() if deployment.instance_id else None
                public_container = db.query(Container).filter(Container.deployment_id == deployment_id, Container.host_port != None).first()
                if instance and instance.public_ip and public_container:
                    app_url = f"http://{instance.public_ip}:{public_container.host_port}"
                terminal_event = {"event": "deployment_complete", "app_url": app_url}
            else:
                terminal_event = {
                    "event": "deployment_failed",
                    "rolled_back": deployment.status == 'rolled_back',
                    "cancelled": deployment.status == 'cancelled',
                    "reason": "Check logs and timeline for details"
                }

        return {
            "events": events,
            "terminal_event": terminal_event,
            "status": deployment.status,
            "new_state": (last_event_id, last_diagnosis_id, last_disclosure_id, last_shadow_id, last_remediation_id)
        }
    finally:
        db.close()

@router.websocket("/deployments/{deployment_id}")
async def deployment_websocket(websocket: WebSocket, deployment_id: int):
    await websocket.accept()
    
    # Check if exists
    def check_exists():
        db = SessionLocal()
        try:
            return db.query(Deployment).filter(Deployment.id == deployment_id).first() is not None
        finally:
            db.close()
            
    if not await run_in_threadpool(check_exists):
        await websocket.close(code=1008, reason="Deployment not found")
        return

    state = (0, 0, 0, 0, 0)
    terminal_sent = False
    terminal_extra_polls = 0
    TERMINAL_EXTRA_POLLS = 4

    try:
        while True:
            data = await run_in_threadpool(fetch_deployment_data, deployment_id, *state)
            if not data:
                break
                
            for ev in data["events"]:
                await websocket.send_json(ev)
                
            state = data["new_state"]
            
            is_terminal = data["status"] in ['live', 'failed', 'rolled_back', 'cancelled']
            
            if is_terminal and not terminal_sent and data["terminal_event"]:
                await websocket.send_json(data["terminal_event"])
                terminal_sent = True
                
            if terminal_sent:
                terminal_extra_polls += 1
                if terminal_extra_polls >= TERMINAL_EXTRA_POLLS and data["status"] != 'live':
                    break
                    
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close(code=1011, reason=str(e)[:100])
        except Exception:
            pass

def fetch_global_data():
    db = SessionLocal()
    try:
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
        
        active_deps = db.query(Deployment).filter(
            Deployment.status.in_(['pending', 'building', 'deploying', 'health_check', 'healing', 'live', 'remediation_proposed'])
        ).order_by(Deployment.started_at.desc()).all()
        active_deps_data = [{"id": d.id, "project_id": d.project_id, "status": d.status, "started_at": d.started_at.isoformat() if d.started_at else None} for d in active_deps]

        return {
            "projects": proj_data,
            "instances": inst_data,
            "active_deployments": active_deps_data
        }
    finally:
        db.close()

@router.websocket("/global")
async def global_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await run_in_threadpool(fetch_global_data)
            await websocket.send_json({
                "event": "global_sync",
                **data
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Global WS Error: {e}")
        try:
            await websocket.close(code=1011, reason=str(e)[:100])
        except Exception:
            pass
