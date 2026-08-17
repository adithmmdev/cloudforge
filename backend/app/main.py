from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.aws_setup import router as aws_setup_router
from app.api.ws import router as ws_router
from app.api.projects import router as projects_router
from app.api.deployments import router as deployments_router
from app.api.remediation import router as remediation_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialization logic here
    yield
    # Cleanup logic here

app = FastAPI(title="CloudForge API", lifespan=lifespan)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(aws_setup_router)
app.include_router(projects_router)
app.include_router(deployments_router)
app.include_router(remediation_router)
app.include_router(ws_router, prefix="/api")
