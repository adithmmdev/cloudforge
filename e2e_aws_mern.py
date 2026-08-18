import os
import time
import requests
import json
from dotenv import load_dotenv
load_dotenv()

BASE_URL = "http://localhost:8000/api"

def log(msg):
    print(f"[*] {msg}")

def check_aws_state():
    log("Verifying current AWS state and CloudForge-managed instances...")
    # We can check instances directly via boto3
    import boto3
    ec2 = boto3.client('ec2', region_name=os.getenv('AWS_REGION', 'us-east-1'))
    resp = ec2.describe_instances(Filters=[{"Name": "tag:ManagedBy", "Values": ["CloudForge"]}])
    instances = []
    for r in resp.get('Reservations', []):
        for i in r.get('Instances', []):
            if i.get('State', {}).get('Name') != 'terminated':
                instances.append(i['InstanceId'])
    log(f"Found CloudForge instances: {instances}")
    return instances

def trigger_mern_deployment():
    # 1. Upload MERN fixture
    log("Uploading MERN fixture...")
    fixture_path = "mern.zip"

    with open(fixture_path, "rb") as f:
        res_obj = requests.post(f"{BASE_URL}/projects", files={"file": f})
    res = res_obj.json()
    if 'id' not in res:
        log(f"Failed to upload project: {res_obj.text}")
        raise Exception("Upload failed")
    project_id = res['id']
    log(f"Project created/uploaded with ID: {project_id}")

    # 2. Trigger Deployment
    log("Triggering deployment...")
    res = requests.post(f"{BASE_URL}/projects/{project_id}/deploy").json()
    deployment_id = res.get('deployment_id')
    if not deployment_id:
        raise Exception(f"Deploy failed: {res}")
    log(f"Deployment created with ID: {deployment_id}")
    
    return project_id, deployment_id

def monitor_deployment(deployment_id):
    log("Monitoring deployment pipeline events...")
    last_status = None
    app_url = None
    while True:
        res = requests.get(f"{BASE_URL}/deployments/{deployment_id}").json()
        status = res['status']
        if status != last_status:
            log(f"Deployment status transitioned to: {status}")
            last_status = status
        
        if status == 'live':
            app_url = res.get('app_url')
            log(f"Deployment LIVE at: {app_url}")
            break
        elif status in ['failed', 'rolled_back']:
            log(f"Deployment ended in {status}")
            raise Exception("Deployment did not reach live status!")
            
        time.sleep(5)
    return app_url

def verify_app(app_url):
    log(f"Verifying React client at {app_url}...")
    try:
        res = requests.get(app_url, timeout=10)
        log(f"Client response status: {res.status_code}")
        if res.status_code == 200:
            log("React client is reachable!")
        else:
            log("Warning: React client returned non-200")
    except Exception as e:
        log(f"Failed to reach React client: {e}")

    api_url = f"{app_url}/api/health"
    log(f"Verifying Express+Mongo through proxy at {api_url}...")
    try:
        res = requests.get(api_url, timeout=10)
        log(f"API response: {res.status_code} - {res.text}")
    except Exception as e:
        log(f"Failed to reach API health: {e}")

def verify_report(deployment_id):
    log("Verifying Deployment Report generation...")
    try:
        res = requests.get(f"{BASE_URL}/deployments/{deployment_id}/report")
        if res.status_code == 200:
            report_data = res.json().get('markdown_content', '')
            log(f"Report successfully generated. Length: {len(report_data)} chars.")
            with open("deployment_report.md", "w") as f:
                f.write(report_data)
            log("Saved to deployment_report.md")
        else:
            log(f"Report endpoint returned {res.status_code}: {res.text}")
    except Exception as e:
        log(f"Failed to fetch report: {e}")

if __name__ == "__main__":
    try:
        check_aws_state()
        p_id, d_id = trigger_mern_deployment()
        app_url = monitor_deployment(d_id)
        verify_app(app_url)
        verify_report(d_id)
        log("Acceptance Stage 1 completed successfully.")
    except Exception as e:
        import traceback
        log(f"Acceptance test failed: {e}")
        traceback.print_exc()
