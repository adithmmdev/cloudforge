import os
import boto3

def stop_instances():
    # If we are running this on the host, we might not have the env vars loaded,
    # so let's parse .env
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v
                    
    aws_access_key = env_vars.get("AWS_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_key = env_vars.get("AWS_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = env_vars.get("AWS_REGION") or os.getenv("AWS_REGION", "us-east-1")

    ec2 = boto3.client('ec2',
                       aws_access_key_id=aws_access_key,
                       aws_secret_access_key=aws_secret_key,
                       region_name=aws_region)

    res = ec2.describe_instances(Filters=[
        {'Name': 'instance-state-name', 'Values': ['running', 'pending']},
        {'Name': 'tag:cloudforge-managed', 'Values': ['true']}
    ])

    to_stop = []
    for r in res.get('Reservations', []):
        for i in r.get('Instances', []):
            to_stop.append(i['InstanceId'])

    if to_stop:
        print(f"Stopping instances: {to_stop}")
        ec2.stop_instances(InstanceIds=to_stop)
        print("Done.")
    else:
        print("No running instances found.")

if __name__ == '__main__':
    stop_instances()
