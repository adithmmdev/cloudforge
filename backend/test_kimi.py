import asyncio
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.api.copilot import stream_response
from app.models.project import Project

async def test_chat():
    db = SessionLocal()
    proj = db.query(Project).first()
    if not proj:
        print('No projects found!')
        return
        
    print(f'Testing Kimi for project: {proj.name}')
    
    from app.models.copilot_session import CopilotSession
    s = CopilotSession(project_id=proj.id, title='Test Chat')
    db.add(s)
    db.commit()
    db.refresh(s)
    
    question = 'Can you see the project name?'
    print(f'Question: {question}')
    
    gen = stream_response(s.id, question, db)
    async for chunk in gen:
        if 'copilot_token' in chunk:
            print(chunk.strip())

if __name__ == '__main__':
    asyncio.run(test_chat())
