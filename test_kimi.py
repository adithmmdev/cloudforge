import os
import json
import requests
from dotenv import load_dotenv

load_dotenv('.env')

NVIDIA_NIM_BASE_URL = os.getenv('NVIDIA_NIM_BASE_URL', 'https://integrate.api.nvidia.com/v1')
NVIDIA_NIM_API_KEY = os.getenv('NVIDIA_NIM_API_KEY')
MODEL = os.getenv('CLOUD_LLM_MODEL_NVIDIA', 'moonshotai/kimi-k3')

def run_test():
    if not NVIDIA_NIM_API_KEY:
        print("FAIL: NVIDIA_NIM_API_KEY is not set.")
        return
        
    headers = {
        'Authorization': f'Bearer {NVIDIA_NIM_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': MODEL,
        'messages': [{'role': 'user', 'content': 'Respond with a simple JSON object: {"status": "success", "model": "kimi-k3"}. Do not add any backticks or markdown, just the raw JSON.'}],
        'temperature': 0.0,
        'max_tokens': 50
    }
    
    url = f"{NVIDIA_NIM_BASE_URL}/chat/completions"
    print(f"Testing NVIDIA NIM API at {url} using model {MODEL}")
    print("Sending request... (Token is redacted)")
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        
        if response.status_code == 200:
            print("SUCCESS: Received 200 OK")
            try:
                data = response.json()
                content = data['choices'][0]['message']['content']
                print(f"Response content: {content}")
                
                # Check JSON parsing
                parsed = json.loads(content)
                if parsed.get('status') == 'success':
                    print("SUCCESS: JSON parsing worked perfectly.")
                else:
                    print("FAIL: JSON structure mismatch.")
            except Exception as e:
                print(f"FAIL: Could not parse response as JSON. Error: {e}")
                print(f"Raw response: {response.text}")
        elif response.status_code == 429:
            print("RATE LIMITED (429): Request rate limit exceeded.")
        elif response.status_code >= 500:
            print(f"SERVER ERROR ({response.status_code}): NVIDIA API is down or failing.")
        else:
            print(f"FAIL: Unexpected status code {response.status_code}")
            print(f"Error detail: {response.text}")
            
    except requests.exceptions.Timeout:
        print("FAIL: Request timed out after 10 seconds.")
    except Exception as e:
        print(f"FAIL: Request failed with exception: {e}")

if __name__ == '__main__':
    run_test()
