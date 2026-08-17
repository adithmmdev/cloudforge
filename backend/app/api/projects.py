from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.project import Project
from app.models.deployment import Deployment
from app.models.autonomy_setting import AutonomySetting
from typing import List
import shutil
import os
from app.utils.zip_guard import ZipGuard

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("")
async def upload_project(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Task 5.2 Input Validation
    file_path = f"/tmp/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        ZipGuard.verify_zip(file_path)
    except ValueError as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))
        
    # Extract project
    project_name = file.filename.replace('.zip', '')
    extract_path = f"/tmp/{project_name}"
    import zipfile
    with zipfile.ZipFile(file_path, 'r') as zip_ref:
        zip_ref.extractall(extract_path)
        
    # Create DB entry
    from app.detector.registry import detect
    adapter, _ = detect(extract_path)
    framework = adapter.get_stack_name() if adapter else "unknown"
    
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

class AutonomyUpdate(BaseModel):
    mode: str

from pydantic import BaseModel
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
        
    deployment = Deployment(project_id=project.id, status="pending")
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    
    background_tasks.add_task(run_deployment_pipeline, db, deployment.id)
    return {"deployment_id": deployment.id, "status": "pending"}

@router.get("/{project_id}/deployments")
def get_deployments(project_id: int, db: Session = Depends(get_db)):
    deployments = db.query(Deployment).filter(Deployment.project_id == project_id).order_by(Deployment.created_at.desc()).all()
    return [{"id": d.id, "status": d.status, "deployment_type": d.deployment_type, "created_at": d.created_at} for d in deployments]

