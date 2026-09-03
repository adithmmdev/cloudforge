import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.aws_setup import router as aws_setup_router
from app.api.ws import router as ws_router
from app.api.projects import router as projects_router
from app.api.deployments import router as deployments_router
from app.api.remediation import router as remediation_router
from app.api.instances import router as instances_router
from app.api.monitoring import router as monitoring_router
from app.api.copilot import router as copilot_router
from app.api.proxy import router as proxy_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialization logic here
    from app.metrics.poller import start_metrics_poller
    start_metrics_poller()
    yield
    # Cleanup logic here

app = FastAPI(title="CloudForge API", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────
# ALLOWED_ORIGINS env var is a comma-separated list of allowed origins.
# Default includes localhost (dev) and wildcard for Render previews.
# On Render, set ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.onrender.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "X-Accel-Buffering"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(aws_setup_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(deployments_router, prefix="/api")
app.include_router(remediation_router, prefix="/api")
app.include_router(ws_router, prefix="/api")
app.include_router(instances_router, prefix="/api")
app.include_router(monitoring_router, prefix="/api")
app.include_router(copilot_router, prefix="/api")
app.include_router(proxy_router, prefix="/api")
