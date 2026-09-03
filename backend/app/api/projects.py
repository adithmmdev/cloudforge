from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.project import Project
from app.models.deployment import Deployment
from app.models.autonomy_setting import AutonomySetting
from typing import List, Optional
from pydantic import BaseModel, HttpUrl
import shutil
import os
import subprocess
import tempfile
from app.utils.zip_guard import safe_extract_zip, ZipBombError

router = APIRouter(prefix="/projects", tags=["projects"])

def _create_project_from_path(extract_path: str, project_name: str, repo_url: Optional[str], db: Session):
    """Shared logic: detect framework and create DB record from an extracted project path."""
    from app.detector.registry import registry, UnsupportedStackError
    try:
        adapter, _ = registry.detect(extract_path)
    except UnsupportedStackError as e:
        shutil.rmtree(extract_path, ignore_errors=True)
        raise HTTPException(
            status_code=422,
            detail=f"unsupported_stack: {str(e)}"
        )
        
    if not adapter:
        shutil.rmtree(extract_path, ignore_errors=True)
        raise HTTPException(
            status_code=422,
            detail="unsupported_stack: CloudForge supports React, Express (JavaScript), Flask, FastAPI, and MERN projects.",
        )
    framework = adapter.name

    project = Project(name=project_name, framework=framework, repo_url=repo_url)
    db.add(project)
    db.commit()
    db.refresh(project)

    autonomy = AutonomySetting(project_id=project.id)
    db.add(autonomy)
    db.commit()

    return project

@router.post("")
@router.post("/upload")
async def upload_project(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a ZIP file and detect framework."""
    os.makedirs("/app/uploads", exist_ok=True)
    file_path = f"/app/uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    project_name = file.filename.replace('.zip', '')
    extract_path = f"/app/uploads/{project_name}"
    try:
        safe_extract_zip(file_path, extract_path)
    except ZipBombError as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))

    project = _create_project_from_path(extract_path, project_name, None, db)
    os.remove(file_path)
    return {
        "id": project.id,
        "project_id": project.id,
        "name": project.name,
        "detected_framework": project.framework,
        "framework": project.framework,
    }


class RepoUrlRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = "main"


@router.post("/from-url")
async def import_from_github(req: RepoUrlRequest, db: Session = Depends(get_db)):
    """Clone a public GitHub repository and detect its framework."""
    repo_url = req.repo_url.strip()
    if not (repo_url.startswith("https://github.com/") or repo_url.startswith("https://gitlab.com/")):
        raise HTTPException(status_code=400, detail="Only public GitHub or GitLab HTTPS URLs are supported.")

    # Derive project name from URL
    parts = repo_url.rstrip("/").rstrip(".git").split("/")
    project_name = parts[-1] if parts else "imported-project"
    extract_path = f"/app/uploads/{project_name}"

    # Remove existing dir if present
    if os.path.exists(extract_path):
        shutil.rmtree(extract_path, ignore_errors=True)

    os.makedirs("/app/uploads", exist_ok=True)

    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1", "--branch", req.branch, repo_url, extract_path],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            # Try with default branch if specified branch fails
            result = subprocess.run(
                ["git", "clone", "--depth=1", repo_url, extract_path],
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Git clone failed: {result.stderr.strip()}"
                )
    except subprocess.TimeoutExpired:
        shutil.rmtree(extract_path, ignore_errors=True)
        raise HTTPException(status_code=408, detail="Clone timed out after 120 seconds.")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="git is not installed in the backend container.")

    # Remove .git dir to save space
    git_dir = os.path.join(extract_path, ".git")
    if os.path.exists(git_dir):
        shutil.rmtree(git_dir, ignore_errors=True)

    project = _create_project_from_path(extract_path, project_name, repo_url, db)
    return {
        "id": project.id,
        "project_id": project.id,
        "name": project.name,
        "detected_framework": project.framework,
        "framework": project.framework,
        "repo_url": repo_url,
    }


@router.get("")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    result = []
    for project in projects:
        latest = (
            db.query(Deployment)
            .filter(Deployment.project_id == project.id)
            .order_by(Deployment.started_at.desc())
            .first()
        )
        result.append({
            "id": project.id,
            "name": project.name,
            "framework": project.framework,
            "status": latest.status if latest else project.status,
            "last_deployment_id": latest.id if latest else None,
        })
    return result

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_name = project.name
    
    # Cascade delete is configured on SQLAlchemy models, so this will wipe Deployments, Remediations, Logs etc.
    db.delete(project)
    db.commit()

    # Remove files from disk
    project_dir = f"/app/uploads/{project_name}"
    if os.path.exists(project_dir):
        shutil.rmtree(project_dir, ignore_errors=True)
        
    return {"status": "success", "message": f"Project {project_name} deleted successfully"}

@router.get("/{project_id}/autonomy")
def get_autonomy(project_id: int, db: Session = Depends(get_db)):
    setting = db.query(AutonomySetting).filter(AutonomySetting.project_id == project_id).first()
    if not setting:
        setting = AutonomySetting(project_id=project_id, mode="approve_each")
        db.add(setting)
        db.commit()
    return {"mode": setting.mode}

from pydantic import BaseModel
class AutonomyUpdate(BaseModel):
    mode: str

@router.put("/{project_id}/autonomy")
def update_autonomy(project_id: int, req: AutonomyUpdate, db: Session = Depends(get_db)):
    setting = db.query(AutonomySetting).filter(AutonomySetting.project_id == project_id).first()
    if not setting:
        setting = AutonomySetting(project_id=project_id, mode="approve_each")
        db.add(setting)
    if req.mode not in ["suggest_only", "approve_each", "full_auto"]:
        raise HTTPException(400, "Invalid mode")
    setting.mode = req.mode
    db.commit()
    return {"status": "ok"}

from app.orchestrator.loop import run_orchestration_loop
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
    
    background_tasks.add_task(run_orchestration_loop, db, deployment.id)
    return {"deployment_id": deployment.id, "status": "pending"}

@router.get("/{project_id}/deployments")
def get_deployments(project_id: int, db: Session = Depends(get_db)):
    deployments = db.query(Deployment).filter(Deployment.project_id == project_id).order_by(Deployment.started_at.desc()).all()
    return [{"id": d.id, "status": d.status, "deployment_type": d.deployment_type, "started_at": d.started_at} for d in deployments]
