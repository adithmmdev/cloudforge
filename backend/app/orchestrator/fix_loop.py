import re

with open("backend/app/orchestrator/loop.py", "r") as f:
    lines = f.readlines()

second_local_conf = -1
first_def = -1
for i, line in enumerate(lines):
    if line.startswith("def run_orchestration_loop"):
        first_def = i
    if first_def != -1 and i > first_def and "LOCAL_CONFIDENCE_THRESHOLD =" in line:
        second_local_conf = i
        break

if second_local_conf != -1:
    clean_lines = lines[:second_local_conf]
    
    # Also we need to make sure we don't have any local imports of Failure inside this remaining block
    for i, line in enumerate(clean_lines):
        if "from app.models.failure import Failure" in line and i > first_def:
            clean_lines[i] = "\n"  # erase it
            
    with open("backend/app/orchestrator/loop.py", "w") as f:
        f.writelines(clean_lines)
    print("Fixed loop.py")
else:
    print("No duplicates found")
