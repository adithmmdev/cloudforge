from app.remediation.prompt import parse_llm_response

res = """Here is a conversational intro
```json
{
    "action_type": "ADD_DEPENDENCY",
    "params": {"package": "requests", "version": "latest", "manifest": "requirements.txt", "service": "app"},
    "confidence": 0.95,
    "reasoning": "Missing requests package"
}
```
And some conversational outro"""

print("Result:", parse_llm_response(res))
