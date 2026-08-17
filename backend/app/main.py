from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.aws_setup import router as aws_setup_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialization logic here
    yield
    # Cleanup logic here

app = FastAPI(title="CloudForge API", lifespan=lifespan)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(aws_setup_router, prefix="/api")
