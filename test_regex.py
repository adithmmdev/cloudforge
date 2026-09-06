import re

text = """Here is a conversational intro
```json
{
    "action_type": "ADD_DEPENDENCY",
    "params": {"package": "requests", "version": "latest", "manifest": "requirements.txt", "service": "app"},
    "confidence": 0.95,
    "reasoning": "Missing requests package"
}
```
And some conversational outro"""

json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
if json_match:
    print("Match group 1:")
    print(json_match.group(1))
else:
    print("No match")
