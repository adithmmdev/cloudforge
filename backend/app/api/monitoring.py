from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.instance import Instance
from app.models.metric import Metric
from app.models.deployment import Deployment

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

@router.get("/instances")
def get_instance_metrics(db: Session = Depends(get_db)):
    from app.models.container import Container
    instances = db.query(Instance).filter(Instance.status.in_(['running', 'pending'])).all()
    result = []
    for inst in instances:
        total_cpu = 0
        total_mem = 0
        containers = db.query(Container).join(Deployment).filter(Deployment.instance_id == inst.id).all()
        for c in containers:
            latest = db.query(Metric).filter(Metric.container_id == c.id).order_by(Metric.timestamp.desc()).first()
            if latest:
                total_cpu += latest.cpu_percent
                total_mem += latest.mem_usage_mb
                
        # Calculate idle time
        active_deps = db.query(Deployment).filter(Deployment.instance_id == inst.id, Deployment.status.in_(['live', 'pending', 'building', 'deploying', 'health_check', 'healing'])).count()
        is_idle = active_deps == 0
        
        result.append({
            "aws_instance_id": inst.aws_instance_id,
            "status": inst.status,
            "public_ip": inst.public_ip,
            "total_cpu_percent": total_cpu,
            "total_mem_mb": total_mem,
            "active_containers": len(containers),
            "is_idle": is_idle,
            "auto_stop_countdown_minutes": 30 if is_idle else None
        })
    return result

@router.get("/deployments")
def get_deployment_metrics(db: Session = Depends(get_db)):
    active_deps = db.query(Deployment).filter(Deployment.status.in_(['pending', 'building', 'deploying', 'health_check', 'healing', 'live'])).order_by(Deployment.started_at.desc()).limit(20).all()
    
    result = []
    for dep in active_deps:
        # Count failures / remediations
        from app.models.failure import Failure
        from app.models.remediation_action import RemediationAction
        failures = db.query(Failure).filter(Failure.deployment_id == dep.id).count()
        remediations = db.query(RemediationAction).filter(RemediationAction.deployment_id == dep.id).count()
        
        elapsed = 0
        if dep.finished_at:
            elapsed = (dep.finished_at - dep.started_at).total_seconds()
            
        result.append({
            "deployment_id": dep.id,
            "status": dep.status,
            "elapsed_seconds": elapsed,
            "failures": failures,
            "remediations": remediations,
            "started_at": dep.started_at.isoformat()
        })
    return result

import json
import os
import requests
from app.remediation.llm_client_factory import call_anthropic, CLOUD_LLM_PROVIDER, ANTHROPIC_API_KEY
from app.remediation.local_llm import OLLAMA_HOST, OLLAMA_MODEL

@router.post("/analyze")
def generate_ai_analysis(db: Session = Depends(get_db)):
    # Gather telemetry
    instances = get_instance_metrics(db)
    deployments = get_deployment_metrics(db)
    
    # Construct state summary
    state_summary = {
        "active_instances": instances,
        "recent_deployments": deployments
    }
    
    prompt = f"""
You are an expert Cloud Infrastructure and DevOps AI Architect for CloudForge. 
Analyze the following telemetry data representing the current state of EC2 instances and deployments.

Telemetry Data:
{json.dumps(state_summary, indent=2)}

Provide a highly professional, detailed analysis dashboard in JSON format.
Your output MUST be ONLY valid JSON matching this exact structure, with no markdown formatting or other text:
{{
  "executive_summary": "A 2-3 sentence high-level overview of system health.",
  "performance_insights": ["insight 1", "insight 2"],
  "cost_optimization": ["cost finding 1", "cost finding 2"],
  "security_risks": ["security issue 1", "security issue 2"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"]
}}
"""

    try:
        # Try local first
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=25)
        response.raise_for_status()
        text = response.json().get("response", "")
        return json.loads(text)
    except Exception as e_local:
        # Fallback to cloud
        try:
            if CLOUD_LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY:
                text = call_anthropic(prompt)
                # Strip markdown if present
                if text.startswith("```json"):
                    text = text.split("```json")[1].rsplit("```", 1)[0].strip()
                return json.loads(text)
        except Exception as e_cloud:
            pass
            
    # Ultimate fallback if both fail
    return {
        "executive_summary": "AI analysis is currently unavailable due to LLM connectivity issues.",
        "performance_insights": ["Could not fetch data"],
        "cost_optimization": ["Could not fetch data"],
        "security_risks": ["Could not fetch data"],
        "recommendations": ["Check Ollama or Cloud API keys"]
    }

