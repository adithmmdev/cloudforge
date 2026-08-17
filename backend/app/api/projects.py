from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.project import Project
from app.models.deployment import Deployment
from app.models.autonomy_setting import AutonomySetting
from typing import List
import shutil
import os
from app.utils.zip_guard import safe_extract_zip, ZipBombError

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("")
async def upload_project(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Task 5.2 Input Validation
    file_path = f"/tmp/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    project_name = file.filename.replace('.zip', '')
    extract_path = f"/tmp/{project_name}"
    try:
        safe_extract_zip(file_path, extract_path)
    except ZipBombError as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))

        
    # Create DB entry
    from app.detector import registry
    adapter, _ = registry.detect(extract_path)
    framework = adapter.name if adapter else "unknown"
    
    project = Project(name=project_name, framework=framework)
    db.add(project)
    db.commit()
    db.refresh(project)
    
    autonomy = AutonomySetting(project_id=project.id)
    db.add(autonomy)
    db.commit()
    
    os.remove(file_path)
    return {"id": project.id, "name": project.name, "framework": project.framework}

@router.get("")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return [{"id": p.id, "name": p.name, "framework": p.framework} for p in projects]

@router.get("/{project_id}/autonomy")
def get_autonomy(project_id: int, db: Session = Depends(get_db)):
    setting = db.query(AutonomySetting).filter(AutonomySetting.project_id == project_id).first()
    if not setting:
        raise HTTPException(404, "Autonomy setting not found")
    return {"mode": setting.mode}

from pydantic import BaseModel
class AutonomyUpdate(BaseModel):
    mode: str

@router.put("/{project_id}/autonomy")
def update_autonomy(project_id: int, req: AutonomyUpdate, db: Session = Depends(get_db)):
    setting = db.query(AutonomySetting).filter(AutonomySetting.project_id == project_id).first()
    if not setting:
        raise HTTPException(404, "Autonomy setting not found")
    if req.mode not in ["suggest_only", "approve_each", "full_auto"]:
        raise HTTPException(400, "Invalid mode")
    setting.mode = req.mode
    db.commit()
    return {"status": "ok"}

from app.deployer.pipeline import run_deployment_pipeline
from fastapi import BackgroundTasks
@router.post("/{project_id}/deploy")
def trigger_deploy(project_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    dep_type = "mern" if project.framework == "mern" else "single_container"
    deployment = Deployment(project_id=project.id, deployment_type=dep_type, status="pending")
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    
    background_tasks.add_task(run_deployment_pipeline, db, deployment.id)
    return {"deployment_id": deployment.id, "status": "pending"}

@router.get("/{project_id}/deployments")
def get_deployments(project_id: int, db: Session = Depends(get_db)):
    deployments = db.query(Deployment).filter(Deployment.project_id == project_id).order_by(Deployment.created_at.desc()).all()
    return [{"id": d.id, "status": d.status, "deployment_type": d.deployment_type, "created_at": d.created_at} for d in deployments]

