import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.deployment import Deployment
from app.models.metric import Metric

router = APIRouter(prefix="/ws", tags=["websocket"])

@router.websocket("/deployments/{deployment_id}")
async def deployment_websocket(websocket: WebSocket, deployment_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    
    deployment = db.query(Deployment).filter(Deployment.id == deployment_id).first()
    if not deployment:
        await websocket.close(code=1008, reason="Deployment not found")
        return
        
    try:
        while True:
            # Re-fetch deployment to get updated status
            db.expire(deployment)
            db.refresh(deployment)
            
            # Fetch latest metrics for all containers in this deployment
            metrics_data = {}
            for container in deployment.containers:
                latest_metric = db.query(Metric).filter(Metric.container_id == container.id).order_by(Metric.timestamp.desc()).first()
                if latest_metric:
                    metrics_data[container.service_name] = {
                        "cpu_percent": latest_metric.cpu_percent,
                        "mem_usage_mb": latest_metric.mem_usage_mb,
                        "net_in_bytes": latest_metric.net_in_bytes,
                        "net_out_bytes": latest_metric.net_out_bytes,
                        "timestamp": latest_metric.timestamp.isoformat()
                    }
                    
            await websocket.send_json({
                "type": "deployment_update",
                "status": deployment.status,
                "metrics": metrics_data
            })
            
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))
