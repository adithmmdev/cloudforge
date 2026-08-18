from fastapi import APIRouter, Depends, HTTPException
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

@router.get("/{id}/remediation-actions")
def get_remediation_actions(id: int, db: Session = Depends(get_db)):
    actions = db.query(RemediationAction).filter(RemediationAction.deployment_id == id).all()
    return [{
        "id": a.id, "action_type": a.action_type, "params": a.params, "status": a.status
    } for a in actions]

@router.get("/{id}/report")
def get_report(id: int, db: Session = Depends(get_db)):
    report = db.query(DeploymentReport).filter(DeploymentReport.deployment_id == id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    return {"id": report.id, "markdown_content": report.report_markdown, "generated_at": report.generated_at}

@router.get("/{id}/metrics")
def get_metrics(id: int, db: Session = Depends(get_db)):
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
        
    metrics_data = {}
    for container in dep.containers:
        latest_metric = db.query(Metric).filter(Metric.container_id == container.id).order_by(Metric.timestamp.desc()).first()
        if latest_metric:
            metrics_data[container.service_name] = {
                "cpu_percent": latest_metric.cpu_percent,
                "mem_usage_mb": latest_metric.mem_usage_mb,
                "net_in_bytes": latest_metric.net_in_bytes,
                "net_out_bytes": latest_metric.net_out_bytes,
                "timestamp": latest_metric.timestamp.isoformat()
            }
    return metrics_data
