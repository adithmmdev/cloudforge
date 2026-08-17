from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialization logic here
    yield
    # Cleanup logic here

app = FastAPI(title="CloudForge API", lifespan=lifespan)

@app.get("/health")
def health_check():
    return {"status": "ok"}
