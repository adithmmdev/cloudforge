from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.aws_setup_state import AWSSetupState
from app.aws_setup.setup_service import run_aws_setup
import logging
import asyncio
import json

router = APIRouter(prefix="/aws", tags=["aws"])
logger = logging.getLogger(__name__)

class SetupRequest(BaseModel):
    allowed_ssh_cidr: str = "0.0.0.0/0"

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

def background_setup_task(db: Session, allowed_ssh_cidr: str):
    def log_cb(step, msg):
        logger.info(f"[AWS Setup] {step}: {msg}")
        # Broadcast to WebSockets
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast({"step": step, "message": msg}))
        except RuntimeError:
            # If no running event loop, create a new one to send the broadcast
            asyncio.run(manager.broadcast({"step": step, "message": msg}))
    
    try:
        run_aws_setup(db, allowed_ssh_cidr, log_callback=log_cb)
    except Exception as e:
        logger.error(f"AWS setup failed: {e}")
        state = db.query(AWSSetupState).first()
        if not state:
            state = AWSSetupState()
            db.add(state)
        state.setup_status = 'failed'
        state.error_detail = str(e)
        db.commit()
        try:
            asyncio.run(manager.broadcast({"step": "error", "message": str(e)}))
        except Exception:
            pass

@router.post("/setup")
def start_aws_setup(req: SetupRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    state = db.query(AWSSetupState).first()
    if state and state.setup_status == 'complete':
        return {"message": "Setup already complete"}
        
    if state and state.setup_status == 'running':
        return {"message": "Setup already in progress"}
        
    if not state:
        state = AWSSetupState()
        db.add(state)
        
    state.setup_status = 'running'
    state.error_detail = None
    db.commit()
    
    background_tasks.add_task(background_setup_task, db, req.allowed_ssh_cidr)
    return {"message": "Setup started"}

@router.get("/setup/status")
def get_setup_status(db: Session = Depends(get_db)):
    state = db.query(AWSSetupState).first()
    if not state:
        return {"status": "pending"}
        
    return {
        "status": state.setup_status,
        "error": state.error_detail,
        "iam_validated": state.iam_validated
    }

@router.post("/teardown")
def start_aws_teardown(db: Session = Depends(get_db)):
    state = db.query(AWSSetupState).first()
    if state:
        db.delete(state)
        db.commit()
    return {"message": "State reset (actual teardown not implemented in mock)"}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
