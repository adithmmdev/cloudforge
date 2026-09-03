import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cloudforge:cloudforge@localhost:5432/cloudforge")

# For running outside docker, we might need to connect to localhost instead of db
if "localhost" not in DATABASE_URL and os.getenv("DOCKER_ENV") != "1":
    # Basic fallback for local testing
    pass

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300, pool_size=20, max_overflow=50)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
