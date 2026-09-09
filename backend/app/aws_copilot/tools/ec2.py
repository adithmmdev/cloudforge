import os
import boto3
import json

def get_ec2_client():
    return boto3.client(
        'ec2',
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )

def list_ec2_instances() -> str:
    """Returns a summary of all EC2 instances."""
    try:
        ec2 = get_ec2_client()
        res = ec2.describe_instances()
        instances = []
        for r in res.get('Reservations', []):
            for i in r.get('Instances', []):
                name = "Unknown"
                for t in i.get('Tags', []):
                    if t['Key'] == 'Name':
                        name = t['Value']
                instances.append({
                    "InstanceId": i['InstanceId'],
                    "Name": name,
                    "State": i['State']['Name'],
                    "Type": i['InstanceType'],
                    "PublicIp": i.get('PublicIpAddress', 'None')
                })
        return json.dumps(instances)
    except Exception as e:
        return f"Error: {str(e)}"
