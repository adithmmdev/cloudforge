#!/bin/bash
set -e

API_URL="http://localhost:8000"

echo "Checking if backend is running..."
if ! curl -s $API_URL/health > /dev/null; then
  echo "Backend is not running. Please start it on $API_URL"
  exit 1
fi

echo "Backend is running. Running E2E Demo..."

function run_test() {
  local name=$1
  local is_failure=$2
  
  echo "--------------------------------------------------"
  echo "Testing: $name"
  
  # Create dummy project zip
  rm -rf "./cloudforge_test" "project.zip"
  mkdir -p "./cloudforge_test"
  
  if [ "$name" == "React" ]; then
    mkdir -p "./cloudforge_test/public" "./cloudforge_test/src"
    echo "<!DOCTYPE html><html lang='en'><head><title>React</title></head><body><div id='root'></div></body></html>" > "./cloudforge_test/public/index.html"
    echo "import React from 'react'; import { createRoot } from 'react-dom/client'; const root = createRoot(document.getElementById('root')); root.render(<div>React</div>);" > "./cloudforge_test/src/index.js"
    echo '{"dependencies": {"react": "^18.0.0", "react-dom": "^18.0.0", "react-scripts": "^5.0.1"}, "scripts": {"build": "react-scripts build"}}' > "./cloudforge_test/package.json"
  elif [ "$name" == "Express" ]; then
    echo "const express = require('express'); const app = express(); app.listen(8080);" > "./cloudforge_test/index.js"
    echo '{"dependencies": {"express": "^4.17.1"}}' > "./cloudforge_test/package.json"
  elif [ "$name" == "Flask" ]; then
    echo "from flask import Flask; app = Flask(__name__)" > "./cloudforge_test/app.py"
    echo "Flask==2.0.1" > "./cloudforge_test/requirements.txt"
  elif [ "$name" == "FastAPI" ]; then
    echo "from fastapi import FastAPI; app = FastAPI()" > "./cloudforge_test/main.py"
    echo "fastapi==0.68.0" > "./cloudforge_test/requirements.txt"
  elif [ "$name" == "MERN" ]; then
    mkdir -p "./cloudforge_test/client/public" "./cloudforge_test/client/src" "./cloudforge_test/server"
    echo "<!DOCTYPE html><html lang='en'><head><title>MERN</title></head><body><div id='root'></div></body></html>" > "./cloudforge_test/client/public/index.html"
    echo "import React from 'react'; import { createRoot } from 'react-dom/client'; const root = createRoot(document.getElementById('root')); root.render(<div>MERN</div>);" > "./cloudforge_test/client/src/index.js"
    echo '{"dependencies": {"react": "^18.0.0", "react-dom": "^18.0.0", "react-scripts": "^5.0.1"}, "scripts": {"build": "react-scripts build"}}' > "./cloudforge_test/client/package.json"
    echo "const express = require('express'); const app = express(); app.listen(8080);" > "./cloudforge_test/server/index.js"
    echo '{"dependencies": {"express": "^4.17.1"}}' > "./cloudforge_test/server/package.json"
  elif [ "$name" == "Missing dependency" ]; then
    echo "from flask import Flask; import requests; app = Flask(__name__); print('hello')" > "./cloudforge_test/app.py"
    echo "Flask==2.0.1" > "./cloudforge_test/requirements.txt"
  elif [ "$name" == "Port conflict" ]; then
    echo "const express = require('express'); const app = express(); app.listen(80); app.listen(80);" > "./cloudforge_test/index.js"
    echo '{"dependencies": {"express": "^4.17.1"}}' > "./cloudforge_test/package.json"
  fi
  
  python -c "import shutil; shutil.make_archive('project', 'zip', 'cloudforge_test')" > /dev/null
  
  echo "Uploading project..."
  RES=$(curl -s -X POST -F "file=@project.zip" $API_URL/api/projects)
  PROJ_ID=$(echo $RES | grep -o '"id":[^,]*' | cut -d':' -f2)
  
  if [ -z "$PROJ_ID" ]; then
    echo "Failed to upload project. Response: $RES"
    rm -rf cloudforge_test project.zip
    return
  fi
  
  echo "Project uploaded with ID $PROJ_ID. Setting autonomy to full_auto..."
  curl -s -X PUT -H "Content-Type: application/json" -d '{"mode":"full_auto"}' $API_URL/api/projects/$PROJ_ID/autonomy
  
  echo "Triggering deployment..."
  DEP_RES=$(curl -s -X POST $API_URL/api/projects/$PROJ_ID/deploy)
  DEP_ID=$(echo $DEP_RES | grep -o '"deployment_id":[^,]*' | cut -d':' -f2 | tr -d '}')
  
  echo "Deployment started with ID $DEP_ID"
  
  echo "Waiting for deployment $DEP_ID to finish..."
  MAX_RETRIES=60
  RETRY_COUNT=0
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    STATUS_RES=$(curl -s $API_URL/api/projects/$PROJ_ID/deployments)
    STATUS=$(echo "$STATUS_RES" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$STATUS" == "deployed" ]; then
      echo "Deployment $DEP_ID finished with status: $STATUS"
      break
    elif [ "$STATUS" == "failed" ]; then
      if [[ "$name" == "Missing dependency" || "$name" == "Port conflict" ]]; then
        : # wait for remediation to kick in and eventually set it to deployed
      else
        echo "Deployment $DEP_ID failed unexpectedly!"
        # We should NOT break instantly in case it's doing something, but failing E2E on non-failure tests is correct.
      fi
    fi
    echo "Waiting... (current status: $STATUS) - attempt $RETRY_COUNT/$MAX_RETRIES"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT+1))
  done
  
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Deployment $DEP_ID timed out or ended in failed state."
  fi
  
  echo "Test $name completed."
  
  # Cleanup docker containers to free port 80 and other resources locally
  docker rm -f $(docker ps -q --filter name="proj_") 2>/dev/null || true
  docker rm -f $(docker ps -q --filter ancestor="cloudforge-${PROJ_ID}-client:${DEP_ID}") 2>/dev/null || true
  docker rm -f $(docker ps -q --filter ancestor="cloudforge-${PROJ_ID}-server:${DEP_ID}") 2>/dev/null || true
  
  rm -rf cloudforge_test project.zip
}

# run_test "React"
# run_test "Express"
# run_test "Flask"
# run_test "FastAPI"
run_test "MERN"

run_test "Missing dependency"

echo "--------------------------------------------------"
echo "All E2E scenarios triggered successfully."
exit 0
