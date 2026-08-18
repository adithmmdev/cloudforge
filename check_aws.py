import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.aws_setup.setup_service import run_aws_setup

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cloudforge:cloudforge@db:5432/cloudforge")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def logger(step, msg):
    print(f"[{step}] {msg}")

db = SessionLocal()
try:
    print("Executing run_aws_setup...")
    state = run_aws_setup(db, log_callback=logger)
    print("\n--- Setup Wizard Finished ---")
    print(f"Status: {state.setup_status}")
    print(f"Subnet ID: {state.subnet_id}")
    print(f"Security Group ID: {state.security_group_id}")
    print(f"Key Pair Name: {state.key_pair_name}")
    print(f"SSH Key Path: {state.ssh_key_path}")
    print(f"AMI ID: {state.ami_id}")
    print(f"IAM Validated: {state.iam_validated}")
except Exception as e:
    import traceback
    print("\n--- Setup Wizard Failed ---")
    print(f"Error: {e}")
    traceback.print_exc()
finally:
    db.close()
