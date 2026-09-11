import pytest
import os
from unittest.mock import patch, MagicMock
from app.aws_copilot.bedrock_client import get_bedrock_client, invoke_minimax_with_tools

@patch('app.aws_copilot.bedrock_client.boto3.client')
def test_get_bedrock_client(mock_boto_client):
    os.environ['AWS_REGION'] = 'us-east-1'
    client = get_bedrock_client()
    mock_boto_client.assert_called_once_with('bedrock-runtime', region_name='us-east-1')

@patch('app.aws_copilot.bedrock_client.get_bedrock_client')
def test_invoke_minimax_with_tools(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_client.converse.return_value = {'output': {'message': 'test response'}}
    
    res = invoke_minimax_with_tools("sys", [{"role": "user", "content": [{"text": "hi"}]}], {})
    assert res == 'test response'
    mock_client.converse.assert_called_once()
    kwargs = mock_client.converse.call_args[1]
    assert kwargs['modelId'] == os.getenv('AWS_BEDROCK_MODEL_ID', 'minimax.minimax-m2.5')
    assert kwargs['system'][0]['text'] == 'sys'
