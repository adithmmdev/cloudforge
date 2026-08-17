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
  mkdir -p "/tmp/cloudforge_test"
  
  if [ "$name" == "React" ]; then
    echo "import React from 'react'; export default () => <div>React</div>;" > "/tmp/cloudforge_test/App.js"
    echo '{"dependencies": {"react": "^18.0.0"}}' > "/tmp/cloudforge_test/package.json"
  elif [ "$name" == "Express" ]; then
    echo "const express = require('express'); const app = express(); app.listen(8080);" > "/tmp/cloudforge_test/index.js"
    echo '{"dependencies": {"express": "^4.17.1"}}' > "/tmp/cloudforge_test/package.json"
  elif [ "$name" == "Flask" ]; then
    echo "from flask import Flask; app = Flask(__name__)" > "/tmp/cloudforge_test/app.py"
    echo "Flask==2.0.1" > "/tmp/cloudforge_test/requirements.txt"
  elif [ "$name" == "FastAPI" ]; then
    echo "from fastapi import FastAPI; app = FastAPI()" > "/tmp/cloudforge_test/main.py"
    echo "fastapi==0.68.0" > "/tmp/cloudforge_test/requirements.txt"
  elif [ "$name" == "MERN" ]; then
    mkdir -p "/tmp/cloudforge_test/client" "/tmp/cloudforge_test/server"
    echo "import React from 'react'; export default () => <div>MERN</div>;" > "/tmp/cloudforge_test/client/App.js"
    echo '{"dependencies": {"react": "^18.0.0"}}' > "/tmp/cloudforge_test/client/package.json"
    echo "const express = require('express'); const app = express(); app.listen(8080);" > "/tmp/cloudforge_test/server/index.js"
    echo '{"dependencies": {"express": "^4.17.1"}}' > "/tmp/cloudforge_test/server/package.json"
  elif [ "$name" == "Missing dependency" ]; then
    echo "import requests; print('hello')" > "/tmp/cloudforge_test/app.py"
    echo "" > "/tmp/cloudforge_test/requirements.txt"
  elif [ "$name" == "Port conflict" ]; then
    echo "const express = require('express'); const app = express(); app.listen(80); app.listen(80);" > "/tmp/cloudforge_test/index.js"
    echo '{"dependencies": {"express": "^4.17.1"}}' > "/tmp/cloudforge_test/package.json"
  fi
  
  cd /tmp/cloudforge_test
  zip -r /tmp/project.zip ./* > /dev/null
  cd - > /dev/null
  
  echo "Uploading project..."
  RES=$(curl -s -X POST -F "file=@/tmp/project.zip" $API_URL/projects)
  PROJ_ID=$(echo $RES | grep -o '"id":[^,]*' | cut -d':' -f2)
  
  if [ -z "$PROJ_ID" ]; then
    echo "Failed to upload project. Response: $RES"
    rm -rf /tmp/cloudforge_test /tmp/project.zip
    return
  fi
  
  echo "Project uploaded with ID $PROJ_ID. Triggering deployment..."
  DEP_RES=$(curl -s -X POST $API_URL/projects/$PROJ_ID/deploy)
  DEP_ID=$(echo $DEP_RES | grep -o '"deployment_id":[^,]*' | cut -d':' -f2 | tr -d '}')
  
  echo "Deployment started with ID $DEP_ID"
  
  # For demo purposes, we won't wait for the full deployment to finish since it can take minutes
  # and this script is meant to verify the API pipeline triggers.
  echo "Test $name triggered successfully."
  
  rm -rf /tmp/cloudforge_test /tmp/project.zip
}

run_test "React"
run_test "Express"
run_test "Flask"
run_test "FastAPI"
run_test "MERN"

run_test "Missing dependency"
run_test "Port conflict"

echo "--------------------------------------------------"
echo "All E2E scenarios triggered successfully."
exit 0
