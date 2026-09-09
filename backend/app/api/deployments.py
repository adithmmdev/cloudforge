from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.deployment import Deployment
from app.models.diagnosis import Diagnosis
from app.models.disclosure import Disclosure
from app.models.shadow_test import ShadowTest
from app.models.metric import Metric
from app.models.remediation_action import RemediationAction
from app.models.deployment_report import DeploymentReport
from app.models.instance import Instance

router = APIRouter(prefix="/deployments", tags=["deployments"])

@router.get("/{id}/stage-events")
def get_stage_events(id: int, db: Session = Depends(get_db)):
    from app.models.stage_event import StageEvent
    events = db.query(StageEvent).filter(
        StageEvent.deployment_id == id
    ).order_by(StageEvent.id.asc()).all()
    return [{
        "id": e.id,
        "stage": e.stage,
        "detail": e.detail,
        "created_at": e.created_at.isoformat() if e.created_at else None
    } for e in events]

@router.get("/{id}")
def get_deployment(id: int, db: Session = Depends(get_db)):
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
    instance = db.query(Instance).filter(Instance.id == dep.instance_id).first() if dep.instance_id else None
    services = [{
        "name": container.service_name,
        "image_tag": container.image_tag,
        "host_port": container.host_port,
        "status": container.status,
    } for container in dep.containers]
    public_service = next((service for service in dep.containers if service.host_port), None)
    app_url = None
    if instance and instance.public_ip and public_service:
        app_url = f"http://{instance.public_ip}:{public_service.host_port}"
    return {
        "id": dep.id,
        "project_id": dep.project_id,
        "status": dep.status,
        "deployment_type": dep.deployment_type,
        "started_at": dep.started_at,
        "finished_at": dep.finished_at,
        "services": services,
        "app_url": app_url,
    }

@router.get("/status/active")
def get_active_deployments(db: Session = Depends(get_db)):
    # Include 'live' and 'remediation_proposed' — these are still "active" from the user's perspective
    active_deps = db.query(Deployment).filter(
        Deployment.status.in_(['pending', 'building', 'deploying', 'health_check', 'healing', 'live', 'remediation_proposed'])
    ).all()
    return [{"id": d.id, "project_id": d.project_id, "status": d.status, "started_at": d.started_at} for d in active_deps]

@router.post("/{id}/cancel")
def cancel_deployment(id: int, db: Session = Depends(get_db)):
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
    # Only skip deployments that are already in a true terminal state (not 'live' which is still active)
    if dep.status in ['cancelled', 'failed', 'rolled_back']:
        return {"message": "Deployment already terminal", "status": dep.status}
    
    import datetime
    from app.models.stage_event import StageEvent
    dep.status = "cancelled"
    dep.finished_at = datetime.datetime.utcnow()
    db.add(StageEvent(deployment_id=dep.id, stage="cancelled", detail="Deployment was manually cancelled"))
    db.commit()
    # Provide an event so UI updates immediately
    import asyncio
    from app.api.aws_setup import manager
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast({"type": "deployment_cancelled", "deployment_id": id}))
    except:
        pass
        
    return {"message": "Deployment cancelled", "id": id}

@router.post("/{id}/resume")
def resume_deployment(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
    if dep.status not in ["failed", "cancelled", "rolled_back", "remediation_proposed"]:
        return {"message": "Deployment is not in a resumable state", "status": dep.status}

    from app.models.stage_event import StageEvent
    from app.orchestrator.loop import run_orchestration_loop
    import asyncio
    from app.api.aws_setup import manager

    dep.status = "pending"
    dep.finished_at = None
    db.add(StageEvent(deployment_id=dep.id, stage="resuming", detail="Deployment resumed by user"))
    db.commit()

    background_tasks.add_task(run_orchestration_loop, db, id)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast({"type": "deployment_resumed", "deployment_id": id}))
    except:
        pass

    return {"message": "Deployment resumed", "id": id}

@router.post("/action/cancel-all")
def cancel_all_deployments(db: Session = Depends(get_db)):
    active_deps = db.query(Deployment).filter(Deployment.status.in_(['pending', 'building', 'deploying', 'health_check', 'healing', 'live'])).all()
    count = 0
    import datetime
    from app.models.stage_event import StageEvent
    for dep in active_deps:
        dep.status = "cancelled"
        dep.finished_at = datetime.datetime.utcnow()
        db.add(StageEvent(deployment_id=dep.id, stage="cancelled", detail="Deployment was manually cancelled via cancel-all"))
        count += 1
    db.commit()
    
    if count > 0:
        import asyncio
        from app.api.aws_setup import manager
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast({"type": "all_deployments_cancelled", "count": count}))
        except:
            asyncio.run(manager.broadcast({"type": "all_deployments_cancelled", "count": count}))
            
    return {"message": f"Cancelled {count} deployments", "count": count}

@router.get("/{id}/diagnoses")
def get_diagnoses(id: int, db: Session = Depends(get_db)):
    # Diagnoses are linked to failures, which are linked to deployments
    from app.models.failure import Failure
    failures = db.query(Failure).filter(Failure.deployment_id == id).all()
    diagnoses = []
    for f in failures:
        for d in f.diagnoses:
            diagnoses.append({
                "id": d.id, "failure_id": f.id, "model_tier": d.model_tier, "cloud_provider": d.cloud_provider,
                "confidence": d.confidence, "action_type": d.action_type, "params": d.params, "reasoning": d.reasoning
            })
    return diagnoses

@router.get("/{id}/disclosures")
def get_disclosures(id: int, db: Session = Depends(get_db)):
    from app.models.failure import Failure
    failures = db.query(Failure).filter(Failure.deployment_id == id).all()
    disclosures = []
    for f in failures:
        discs = db.query(Disclosure).filter(Disclosure.failure_id == f.id).all()
        for disc in discs:
            disclosures.append({
                "id": disc.id, "redacted_signature": disc.content_sent,
                "provider_name": disc.destination, "timestamp": disc.created_at
            })
    return disclosures

@router.get("/{id}/shadow-tests")
def get_shadow_tests(id: int, db: Session = Depends(get_db)):
    from app.models.remediation_action import RemediationAction
    actions = db.query(RemediationAction).filter(RemediationAction.deployment_id == id).all()
    tests = []
    for a in actions:
        for t in a.shadow_tests:
            tests.append({
                "id": t.id, "remediation_action_id": a.id, "test_name": t.test_name, "passed": t.passed, "output": t.output
            })
    return tests

from typing import Optional

@router.get("/{id}/remediation-actions")
def get_remediation_actions(id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(RemediationAction).filter(RemediationAction.deployment_id == id)
    if status:
        q = q.filter(RemediationAction.status == status)
    actions = q.all()
    return [{
        "id": a.id, "action_type": a.action_type, "params": a.params, "status": a.status
    } for a in actions]

@router.get("/{id}/report")
def get_report(id: int, db: Session = Depends(get_db)):
    report = db.query(DeploymentReport).filter(DeploymentReport.deployment_id == id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    return {"id": report.id, "markdown": report.report_markdown, "generated_at": report.generated_at}

@router.get("/{id}/metrics")
def get_metrics(id: int, since: Optional[str] = None, service: Optional[str] = None, db: Session = Depends(get_db)):
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
        
    container_ids = [c.id for c in dep.containers]
    if not container_ids:
        return []
        
    q = db.query(Metric).filter(Metric.container_id.in_(container_ids))
    if since:
        from dateutil.parser import parse
        try:
            since_dt = parse(since)
            q = q.filter(Metric.timestamp >= since_dt)
        except Exception:
            pass
            
    metrics = q.order_by(Metric.timestamp.asc()).all()
    c_map = {c.id: c.service_name for c in dep.containers}
    
    results = []
    for m in metrics:
        s_name = c_map.get(m.container_id, "unknown")
        if service and s_name != service:
            continue
        results.append({
            "timestamp": m.timestamp.isoformat(),
            "cpu_percent": m.cpu_percent,
            "mem_usage_mb": m.mem_usage_mb,
            "net_in_bytes": m.net_in_bytes,
            "net_out_bytes": m.net_out_bytes,
            "service": s_name
        })
    return results

@router.post("/{id}/shadow-manual")
def manual_shadow_verification(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from app.models.remediation_action import RemediationAction
    from app.models.project import Project
    from app.models.deployment import Deployment
    from app.remediation.shadow import run_shadow_verification
    import shutil
    import os
    
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
        
    project = db.query(Project).filter(Project.id == dep.project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    rem = RemediationAction(
        deployment_id=dep.id,
        action_type="MANUAL",
        params={},
        status="shadow_testing"
    )
    db.add(rem)
    db.commit()

    base_dir = f"/app/uploads/{project.name}"
    shadow_dir = f"/app/uploads/shadow_manual_{rem.id}"
    
    if os.path.exists(shadow_dir):
        shutil.rmtree(shadow_dir)
    shutil.copytree(base_dir, shadow_dir)

    framework = project.framework
    deployment_type = "mern" if framework == "mern" else "single_container"

    def _bg_task():
        from app.db.session import SessionLocal
        local_db = SessionLocal()
        try:
            success = run_shadow_verification(local_db, rem.id, shadow_dir, deployment_type, framework)
            r = local_db.query(RemediationAction).filter(RemediationAction.id == rem.id).first()
            if r:
                r.status = "promoted" if success else "failed"
                local_db.commit()
        finally:
            local_db.close()
            # Cleanup
            try:
                import subprocess
                subprocess.run(["docker", "compose", "-p", f"shadow_{rem.id}", "down", "-v", "--remove-orphans"], cwd=shadow_dir)
                shutil.rmtree(shadow_dir)
            except Exception:
                pass

    background_tasks.add_task(_bg_task)
    return {"status": "started", "remediation_action_id": rem.id}
