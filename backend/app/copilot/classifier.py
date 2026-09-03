CATEGORIES = {
    'CURRENT_STATUS': ['what stage', 'where are we', 'what is happening', "what's happening", 'current stage', 'is it live', 'is it done', 'deployment status', 'what status'],
    'DEPLOYMENT_TIMING': ['why slow', 'how long', 'taking time', 'how much longer', 'when will', 'time remaining', 'why is it taking', 'still building', 'stuck'],
    'FAILURE_EXPLANATION': ['why did it fail', 'what went wrong', 'why failed', 'what error', 'what caused', 'why is it failing', 'build failed', 'deployment failed'],
    'LOG_ANALYSIS': ['show logs', 'build log', 'container log', 'output', 'stderr', 'stdout', 'what does the log', 'print logs'],
    'METRIC_ANALYSIS': ['cpu', 'memory', 'ram', 'metrics', 'performance', 'resource usage', 'mem usage'],
    'INFRASTRUCTURE': ['ec2', 'aws', 'instance', 'server state', 'cloud', 'is aws', 'is ec2'],
    'SHADOW': ['shadow', 'verification', 'smoke test', 'sandbox', 'isolated'],
    'REMEDIATION': ['qwen', 'kimi', 'remediation', 'what did the ai', 'what did ai', 'fix attempt', 'what fix', 'remediation action', 'what was proposed'],
    'PROJECT_CODE': ['why is login', 'why is the api', 'show code', 'read file', 'what does the code', 'route', 'endpoint', 'function', 'module', 'import', 'why is x failing'],
    'DEPLOYMENT_HISTORY': ['last deployment', 'previous deployment', 'compare', 'history', 'what happened in', 'deployment #'],
}

def classify_question(message: str) -> str:
    msg_lower = message.lower()
    for cat, keywords in CATEGORIES.items():
        if any(kw in msg_lower for kw in keywords):
            return cat
    return 'GENERAL'

def needs_kimi(category: str, message: str) -> bool:
    if category in ['CURRENT_STATUS', 'DEPLOYMENT_TIMING', 'INFRASTRUCTURE']:
        return False
    return True
