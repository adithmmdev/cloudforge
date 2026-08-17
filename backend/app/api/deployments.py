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

router = APIRouter(prefix="/deployments", tags=["deployments"])

@router.get("/{id}")
def get_deployment(id: int, db: Session = Depends(get_db)):
    dep = db.query(Deployment).filter(Deployment.id == id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
    return {"id": dep.id, "project_id": dep.project_id, "status": dep.status, "deployment_type": dep.deployment_type, "created_at": dep.created_at}

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
        for d in f.diagnoses:
            disc = db.query(Disclosure).filter(Disclosure.diagnosis_id == d.id).first()
            if disc:
                disclosures.append({
                    "id": disc.id, "redacted_signature": disc.redacted_signature,
                    "provider_name": disc.provider_name, "timestamp": disc.timestamp
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
                "id": t.id, "remediation_action_id": a.id, "status": t.status, "logs": t.logs
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
    return {"id": report.id, "markdown_content": report.markdown_content, "generated_at": report.generated_at}

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
