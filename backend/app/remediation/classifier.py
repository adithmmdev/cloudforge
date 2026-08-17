import re

PATTERNS = [
    (r"ModuleNotFoundError: No module named '(\w+)'", "missing_python_dependency"),
    (r"Cannot find module '(\S+)'", "missing_node_dependency"),
    (r"EADDRINUSE", "port_conflict"),
    (r"(exec format error|no matching manifest for)", "wrong_base_image_arch"),
    (r"OOMKilled: true", "out_of_memory"),
    (r"(?:KeyError:\s*|undefined variable\s*|KeyError\s+)'?([A-Z_][A-Z0-9_]*)'?", "missing_env_var"),
    (r"(MongoNetworkError|ECONNREFUSED .*27017)", "db_connection_failed"),
    (r"npm ERR! code ERR_SOCKET_TIMEOUT", "build_network_error"),
    (r"container exits within 2s, no matching CMD found", "missing_or_wrong_start_command")
]

def classify_error(logs_or_status: str) -> dict:
    if not logs_or_status:
        return {
            "error_class": "unclassified",
            "extracted_token": ""
        }
        
    for pattern, error_class in PATTERNS:
        match = re.search(pattern, logs_or_status)
        if match:
            # If there's a capture group, we return it as extracted_token
            # Some patterns have multiple groups or no group.
            # Handle specifics:
            if error_class == "missing_python_dependency" or error_class == "missing_node_dependency" or error_class == "missing_env_var":
                extracted_token = match.group(1) if match.groups() else ""
            elif error_class == "db_connection_failed":
                extracted_token = "mongo"
            else:
                extracted_token = ""
                
            return {
                "error_class": error_class,
                "extracted_token": extracted_token
            }

         
    return {
        "error_class": "unclassified",
        "extracted_token": ""
    }
