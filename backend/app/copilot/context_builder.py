import json
from app.copilot import tools

def build_context(db, project_id, deployment_id, category, message, conversation_history) -> tuple[dict, list[str]]:
    ctx = {}
    tools_used = []
    
    from app.models.project import Project
    proj = db.query(Project).filter(Project.id == project_id).first()
    if proj:
        ctx['project'] = {
            'id': proj.id,
            'name': proj.name,
            'framework': proj.framework,
        }
        tools_used.append('get_project')
        
    ctx['current_deployment'] = tools.get_current_deployment(db, project_id)
    tools_used.append('get_current_deployment')
    
    if deployment_id:
        ctx['deployment_status'] = tools.get_deployment_status(db, deployment_id)
        tools_used.append('get_deployment_status')
        ctx['timeline'] = tools.get_deployment_timeline(db, deployment_id)
        ctx['recent_events'] = tools.get_recent_events(db, deployment_id, n=10)
        
        ctx['errors'] = tools.get_recent_errors(db, deployment_id)
        ctx['remediation'] = tools.get_remediation_history(db, deployment_id)
        ctx['shadow'] = tools.get_shadow_results(db, deployment_id)
        ctx['qwen_agent'] = tools.get_qwen_result(db, deployment_id)
        ctx['kimi_agent'] = tools.get_kimi_result(db, deployment_id)
        tools_used.extend(['get_deployment_timeline', 'get_recent_events', 'get_recent_errors', 'get_remediation_history', 'get_shadow_results', 'get_qwen_result', 'get_kimi_result'])
        
    ctx['ec2_status'] = tools.get_ec2_status(db, project_id)
    tools_used.append('get_ec2_status')
    
    if category in ['LOG_ANALYSIS']:
        ctx['logs'] = tools.get_build_logs(db, deployment_id)
        tools_used.append('get_build_logs')
        
    elif category == 'PROJECT_CODE':
        ctx['files'] = tools.list_project_files(db, project_id)
        tools_used.append('list_project_files')
        
    elif category == 'DEPLOYMENT_HISTORY':
        ctx['history'] = tools.get_deployment_history(db, project_id)
        tools_used.append('get_deployment_history')

    return ctx, tools_used

def build_system_prompt(context: dict, conversation_history: list) -> str:
    prompt = f"""You are the CloudForge Deployment Copilot, an AI assistant with access to real-time CloudForge deployment data.

RULES:
- Answer ONLY from the evidence provided below. Do not invent deployment states, logs, or errors.
- Clearly distinguish FACT (from data), INFERENCE (your reasoning), and UNKNOWN (not in data).
- Keep responses clear, structured, and helpful.
- Use markdown formatting (bold, code blocks, lists) for readability.
- Do NOT expose API keys, secrets, or internal system paths.
- When asked to execute actions (stop deployment, fix code), explain that the user should use the CloudForge UI controls.

CloudForge Runtime Evidence:
{json.dumps(context, indent=2, default=str)}
"""
    return prompt
