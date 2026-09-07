import os
import json
import boto3
from sqlalchemy.orm import Session
from app.models.instance import Instance
from app.models.metric import Metric
from app.models.deployment import Deployment
from app.remediation.local_llm import query_ollama
import logging

logger = logging.getLogger(__name__)

def analyze_instance_health(db: Session, instance_id: int):
    instance = db.query(Instance).filter_by(id=instance_id).first()
    if not instance:
        return {"error": "Instance not found"}
        
    deps = db.query(Deployment).filter(Deployment.instance_id == instance.id, Deployment.status.in_(['deployed', 'live', 'pending', 'building', 'deploying', 'health_check', 'healing'])).all()
    
    recent_metrics = []
    for dep in deps:
        for c in dep.containers:
            metrics = db.query(Metric).filter_by(container_id=c.id).order_by(Metric.timestamp.desc()).limit(10).all()
            if metrics:
                avg_cpu = sum(m.cpu_percent for m in metrics) / len(metrics)
                avg_mem = sum(m.mem_usage_mb for m in metrics) / len(metrics)
                recent_metrics.append({
                    "service": c.service_name,
                    "avg_cpu_percent": round(avg_cpu, 2),
                    "avg_mem_mb": round(avg_mem, 2)
                })

    prompt = f"""You are an expert DevOps AI analyzing EC2 server health and optimizing resources.
Analyze the following instance data.
Instance AWS ID: {instance.aws_instance_id}
Status: {instance.status}
Live Deployments: {len(deps)}
Recent Container Metrics: {json.dumps(recent_metrics)}

Return a JSON object with exactly these keys:
- "status": "Healthy", "Warning", or "Critical"
- "insights": A list of strings containing predictive insights or observations. (e.g. "CPU usage is stable (0.0%).", "Deployment pipelines are healthy.")
- "recommended_action": "STOP_INSTANCE", "SCALE_UP", or "NONE"
- "reasoning": "Why you recommend this action."
"""

    response = query_ollama(prompt)
    try:
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        analysis = json.loads(text.strip())
        
        # Apply auto-stop if recommended and 0 live deployments
        if analysis.get("recommended_action") == "STOP_INSTANCE" and len(deps) == 0 and instance.status == "running":
            try:
                ec2 = boto3.client('ec2', region_name=os.getenv("AWS_REGION", "us-east-1"))
                ec2.stop_instances(InstanceIds=[instance.aws_instance_id])
                instance.status = "stopped"
                db.commit()
                analysis["action_taken"] = f"Instance {instance.aws_instance_id} auto-stopped to save costs."
            except Exception as e:
                logger.error(f"Failed to auto-stop instance {instance.aws_instance_id}: {e}")
                analysis["action_taken"] = f"Failed to stop instance: {e}"
        else:
            analysis["action_taken"] = "None"
            
        return analysis
        
    except Exception as e:
        return {"error": f"Failed to parse AI analysis: {str(e)}"}
