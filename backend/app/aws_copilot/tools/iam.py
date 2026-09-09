import os
import boto3
import json

def get_sts_client():
    return boto3.client(
        'sts',
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )

def get_account_identity() -> str:
    """Returns the current AWS account identity (Account ID, User ID, ARN)."""
    try:
        sts = get_sts_client()
        res = sts.get_caller_identity()
        return json.dumps({
            "Account": res.get("Account"),
            "UserId": res.get("UserId"),
            "Arn": res.get("Arn")
        })
    except Exception as e:
        return f"Error: {str(e)}"
