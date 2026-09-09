import json
import logging
from app.aws_copilot.tools import ec2, cloudwatch, billing, iam

logger = logging.getLogger(__name__)

TOOLS_CONFIG = {
    "tools": [
        {
            "toolSpec": {
                "name": "list_ec2_instances",
                "description": "Returns a summary of all EC2 instances and their current state (running, stopped, etc.)",
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {}
                    }
                }
            }
        },
        {
            "toolSpec": {
                "name": "get_ec2_cpu_metrics",
                "description": "Gets the average CPU utilization for an EC2 instance over the last hour.",
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "instance_id": {"type": "string", "description": "The ID of the EC2 instance (e.g., i-1234567890abcdef0)"}
                        },
                        "required": ["instance_id"]
                    }
                }
            }
        },
        {
            "toolSpec": {
                "name": "get_account_identity",
                "description": "Returns the current AWS account identity, including Account ID and User ARN.",
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {}
                    }
                }
            }
        },
        {
            "toolSpec": {
                "name": "get_monthly_cost",
                "description": "Returns the month-to-date AWS cost.",
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {}
                    }
                }
            }
        }
    ]
}

def execute_tool(tool_name: str, parameters: dict) -> dict:
    """Executes a tool and returns the result strictly as a dict that Bedrock expects."""
    logger.info(f"Executing AWS Copilot tool: {tool_name} with params {parameters}")
    try:
        if tool_name == "list_ec2_instances":
            result = ec2.list_ec2_instances()
        elif tool_name == "get_ec2_cpu_metrics":
            result = cloudwatch.get_ec2_cpu_metrics(parameters.get('instance_id', ''))
        elif tool_name == "get_account_identity":
            result = iam.get_account_identity()
        elif tool_name == "get_monthly_cost":
            result = billing.get_monthly_cost()
        else:
            result = f"Error: Tool {tool_name} not found."
            
        return {
            "text": result
        }
    except Exception as e:
        logger.error(f"Error executing {tool_name}: {e}")
        return {
            "text": f"Error executing {tool_name}: {str(e)}"
        }
