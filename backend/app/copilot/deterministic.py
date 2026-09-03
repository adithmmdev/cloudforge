def try_deterministic_answer(message: str, deployment: dict | None, project: dict | None, ec2: dict | None) -> str | None:
    msg = message.lower()
    if 'is it live' in msg and deployment:
        if deployment['status'] == 'success':
            return f"Yes, Deployment #{deployment['id']} is **LIVE**"
        return f"No, current status is {deployment['status']}"
        
    if 'what stage' in msg and deployment:
        return f"Currently in the **{deployment.get('stage', 'unknown')}** stage"
        
    if 'how long' in msg and deployment:
        elapsed = deployment.get('elapsed_seconds', 0)
        return f"Deployment #{deployment['id']} has been running for **{elapsed} seconds** ({elapsed // 60} minutes)"
        
    if 'is ec2' in msg and ec2:
        return f"EC2 instance {ec2.get('aws_instance_id')} is {ec2.get('status')} at {ec2.get('public_ip')}"
        
    if 'what is the project' in msg and project:
        return f"The project is {project.get('name')} using {project.get('framework')}"
        
    return None
