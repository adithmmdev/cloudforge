import os
import re
from pathlib import Path

BLOCKED_FILENAMES = {'.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519', 'credentials'}
BLOCKED_EXTENSIONS = {'.pem', '.key', '.p12', '.pfx', '.crt', '.cer'}
BLOCKED_PATTERNS = [
    re.compile(r'aws_access_key_id', re.IGNORECASE),
    re.compile(r'aws_secret_access_key', re.IGNORECASE),
]

def validate_project_path(project_name: str, requested_path: str) -> str:
    base_dir = Path('/app/uploads') / project_name
    target_path = (base_dir / requested_path).resolve()
    
    if not str(target_path).startswith(str(base_dir.resolve())):
        raise ValueError("Invalid path: escapes project directory")
        
    if target_path.name in BLOCKED_FILENAMES:
        raise ValueError(f"Access denied: filename {target_path.name} is blocked")
        
    if target_path.suffix in BLOCKED_EXTENSIONS:
        raise ValueError(f"Access denied: extension {target_path.suffix} is blocked")
        
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(target_path.name):
            raise ValueError("Access denied: path matches blocked pattern")
            
    return str(target_path)

def is_secret_content(content: str) -> bool:
    if '-----BEGIN' in content:
        return True
    
    suspicious_patterns = [
        re.compile(r'(?i)aws_access_key_id\s*=\s*\S+'),
        re.compile(r'(?i)aws_secret_access_key\s*=\s*\S+'),
        re.compile(r'(?i)api_key\s*=\s*\S+'),
        re.compile(r'(?i)password\s*=\s*\S+'),
    ]
    
    for pattern in suspicious_patterns:
        if pattern.search(content):
            return True
            
    return False
