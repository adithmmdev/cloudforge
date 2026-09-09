import os
import boto3
import json
from datetime import datetime

def get_ce_client():
    return boto3.client(
        'ce',
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )

def get_monthly_cost() -> str:
    """Returns the month-to-date AWS cost."""
    try:
        ce = get_ce_client()
        today = datetime.utcnow()
        first_day = today.replace(day=1).strftime('%Y-%m-%d')
        today_str = today.strftime('%Y-%m-%d')
        
        # If it's the 1st of the month, we can't query the same start/end date, so query yesterday to today
        if first_day == today_str:
             return json.dumps({"Info": "It is the first day of the month, no significant costs accrued yet."})
             
        res = ce.get_cost_and_usage(
            TimePeriod={'Start': first_day, 'End': today_str},
            Granularity='MONTHLY',
            Metrics=['UnblendedCost']
        )
        total = 0.0
        unit = "USD"
        for item in res.get('ResultsByTime', []):
            cost = item.get('Total', {}).get('UnblendedCost', {})
            total += float(cost.get('Amount', 0))
            unit = cost.get('Unit', 'USD')
            
        return json.dumps({"MonthToDateCost": round(total, 2), "Unit": unit})
    except Exception as e:
        return f"Error (Cost Explorer permissions may be missing): {str(e)}"
