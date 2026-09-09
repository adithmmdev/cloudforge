import os
import boto3
import json
from datetime import datetime, timedelta

def get_cw_client():
    return boto3.client(
        'cloudwatch',
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )

def get_ec2_cpu_metrics(instance_id: str) -> str:
    """Gets the average CPU utilization for an EC2 instance over the last hour."""
    try:
        cw = get_cw_client()
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        res = cw.get_metric_statistics(
            Namespace='AWS/EC2',
            MetricName='CPUUtilization',
            Dimensions=[{'Name': 'InstanceId', 'Value': instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=['Average']
        )
        datapoints = res.get('Datapoints', [])
        datapoints.sort(key=lambda x: x['Timestamp'])
        formatted = [{"Time": d['Timestamp'].isoformat(), "CPU_Percent": round(d['Average'], 2)} for d in datapoints[-5:]]
        return json.dumps(formatted)
    except Exception as e:
        return f"Error: {str(e)}"
