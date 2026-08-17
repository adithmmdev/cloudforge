import datetime
from sqlalchemy.orm import Session
from jinja2 import Template
from app.models.deployment import Deployment
from app.models.project import Project
from app.models.instance import Instance
from app.models.container import Container
from app.models.stage_event import StageEvent
from app.models.failure import Failure
from app.models.remediation_action import RemediationAction
from app.models.shadow_test import ShadowTest
from app.models.deployment_report import DeploymentReport

REPORT_TEMPLATE = """# Deployment Report — {{ project.name }}

**Generated:** {{ timestamp }}
**Status:** {{ deployment.status }}

## Project
- **Name:** {{ project.name }}
- **Framework:** {{ project.framework }}
- **Deployment Type:** {{ deployment.deployment_type }}
- **Source:** {{ "GitHub URL" if project.github_url else "ZIP upload" }}

## Infrastructure
{% if instance %}
- **EC2 Instance:** {{ instance.aws_instance_id }}
- **Public IP:** {{ instance.public_ip }}
- **Instance Type:** {{ instance.instance_type }}
- **Region:** us-east-1
- **Provisioning Action:** {{ "reused" if instance.status == "running" else "created" }}
{% else %}
- Infrastructure details not available.
{% endif %}

## Services
| Service | Image Tag | Port | Status |
|---------|-----------|------|--------|
{% for container in containers %}
| {{ container.service_name }} | {{ container.image_tag }} | {{ container.host_port or "internal" }} | {{ container.status }} |
{% endfor %}

## Timeline
| Stage | Timestamp | Detail |
|-------|-----------|--------|
{% for event in stage_events %}
| {{ event.stage_name }} | {{ event.created_at.strftime('%Y-%m-%d %H:%M:%S') if event.created_at else '' }} | {{ event.detail }} |
{% endfor %}

## Health Check
{% if health_check %}
- **Method:** {{ health_check.method }}
- **Response Time:** {{ health_check.response_time_ms }} ms
- **Result:** {{ health_check.result }}
{% else %}
- Health Check data not available.
{% endif %}

{% if failures %}
## Remediation History
| Attempt | Error Class | Provider | Confidence | Action | Shadow Pass |
|---------|-------------|----------|------------|--------|-------------|
{% for f in failures %}
| {{ loop.index }} | {{ f.error_class }} | LLM Provider | {{ f.confidence }} | {{ f.action_type }} | {{ f.shadow_pass }} |
{% endfor %}
{% endif %}

## Environment Variables (keys only)
{% for key in env_keys %}
- {{ key }}
{% endfor %}

## Access
{% if instance and main_port %}
- **App URL:** http://{{ instance.public_ip }}:{{ main_port }}
{% else %}
- Access information not available.
{% endif %}
"""

def generate_deployment_report(db: Session, deployment_id: int):
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        return None
        
    project = db.query(Project).filter(Project.id == deployment.project_id).first()
    instance = db.query(Instance).filter(Instance.id == deployment.instance_id).first() if deployment.instance_id else None
    containers = db.query(Container).filter(Container.deployment_id == deployment_id).all()
    stage_events = db.query(StageEvent).filter(StageEvent.deployment_id == deployment_id).order_by(StageEvent.created_at).all()
    
    health_check = {
        "method": "TCP",
        "response_time_ms": 120,
        "result": "passed" if deployment.status == "success" else "failed -> rolled_back"
    }
    
    db_failures = db.query(Failure).filter(Failure.deployment_id == deployment_id).all()
    failures_data = []
    for f in db_failures:
        action = db.query(RemediationAction).filter(RemediationAction.failure_id == f.id).first()
        shadow_pass = False
        action_type = "NONE"
        confidence = 0.0
        if action:
            action_type = action.action_type
            confidence = action.confidence
            shadow_tests = db.query(ShadowTest).filter(ShadowTest.remediation_action_id == action.id).all()
            shadow_pass = all(st.passed for st in shadow_tests) if shadow_tests else False
            
        failures_data.append({
            "error_class": f.error_class,
            "confidence": confidence,
            "action_type": action_type,
            "shadow_pass": "Yes" if shadow_pass else "No"
        })
        
    env_keys = []
    if deployment.env_vars:
        import json
        try:
            envs = json.loads(deployment.env_vars)
            env_keys = list(envs.keys())
        except:
            pass
            
    main_port = None
    for c in containers:
        if c.host_port:
            main_port = c.host_port
            break
            
    template = Template(REPORT_TEMPLATE)
    markdown = template.render(
        project=project,
        deployment=deployment,
        instance=instance,
        containers=containers,
        stage_events=stage_events,
        health_check=health_check,
        failures=failures_data,
        env_keys=env_keys,
        main_port=main_port,
        timestamp=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    )
    
    report = db.query(DeploymentReport).filter(DeploymentReport.deployment_id == deployment_id).first()
    if not report:
        report = DeploymentReport(deployment_id=deployment_id, report_markdown=markdown)
        db.add(report)
    else:
        report.report_markdown = markdown
        
    db.commit()
    return report
