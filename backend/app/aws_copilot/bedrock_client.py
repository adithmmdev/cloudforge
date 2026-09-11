import os
import boto3
import json
import logging
from typing import List, Dict, Any, AsyncGenerator
import asyncio

logger = logging.getLogger(__name__)

MODEL_ID = os.getenv("AWS_BEDROCK_MODEL_ID", "minimax.minimax-m2.5")

def get_bedrock_client():
    ak = os.getenv("AWS_ACCESS_KEY_ID")
    sk = os.getenv("AWS_SECRET_ACCESS_KEY")
    
    bearer_token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    if bearer_token and bearer_token.startswith("ABSK"):
        import base64
        try:
            decoded = base64.b64decode(bearer_token[4:]).decode('utf-8')
            ak, sk = decoded.split(":", 1)
        except Exception as e:
            logger.error(f"Failed to parse AWS_BEARER_TOKEN_BEDROCK: {e}")

    return boto3.client(
        'bedrock-runtime',
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=ak,
        aws_secret_access_key=sk
    )

def invoke_minimax_with_tools(system_prompt: str, messages: List[Dict], tool_config: Dict) -> Dict:
    client = get_bedrock_client()
    try:
        response = client.converse(
            modelId=MODEL_ID,
            messages=messages,
            system=[{"text": system_prompt}],
            toolConfig=tool_config,
            inferenceConfig={"temperature": 0.2}
        )
        return response['output']['message']
    except Exception as e:
        logger.error(f"Bedrock Converse error: {e}")
        raise

async def invoke_minimax_stream_async(system_prompt: str, messages: List[Dict]) -> AsyncGenerator[str, None]:
    client = get_bedrock_client()
    loop = asyncio.get_running_loop()
    
    def _call():
        return client.converse_stream(
            modelId=MODEL_ID,
            messages=messages,
            system=[{"text": system_prompt}],
            inferenceConfig={"temperature": 0.2}
        )

    try:
        response = await loop.run_in_executor(None, _call)
        stream = response.get('stream')
        if stream:
            for event in stream:
                if 'contentBlockDelta' in event:
                    delta = event['contentBlockDelta']['delta']
                    if 'text' in delta:
                        yield delta['text']
                await asyncio.sleep(0)
    except Exception as e:
        logger.error(f"Bedrock stream error: {e}")
        yield f"\n[Error communicating with AWS Bedrock: {str(e)}]"
