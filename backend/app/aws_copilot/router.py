from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import datetime
import logging
import asyncio

from app.db.session import get_db
from app.models.aws_copilot_session import AWSCopilotSession
from app.models.aws_copilot_message import AWSCopilotMessage
from app.aws_copilot.bedrock_client import invoke_minimax_with_tools, invoke_minimax_stream_async
from app.aws_copilot.tool_registry import TOOLS_CONFIG, execute_tool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/aws-copilot", tags=["aws-copilot"])

class MessageBody(BaseModel):
    content: str

MAX_TOOL_STEPS = 5
SYSTEM_PROMPT = """You are AWS Copilot, an AI assistant built to help users manage and understand their AWS accounts.
You have access to safe, read-only tools that query real AWS data.
When the user asks about their AWS account:
1. Always use tools to fetch actual data. Do not guess or fabricate numbers.
2. If a tool fails (e.g. permission error), state that clearly to the user.
3. Be professional, concise, and format answers cleanly using markdown and tables when useful.
4. Keep the distinction clear between Observed (real data) and Calculated/Inferred (your conclusions).
"""

def _session_dict(s):
    return {
        "id": s.id,
        "title": s.title,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        "messages_count": len(s.messages) if s.messages is not None else 0,
    }

def safe_commit(db: Session):
    try:
        db.commit()
    except Exception:
        db.rollback()
        db.commit()

@router.post('/sessions')
def create_session(db: Session = Depends(get_db)):
    s = AWSCopilotSession(title='New AWS Chat')
    db.add(s)
    safe_commit(db)
    db.refresh(s)
    return _session_dict(s)

@router.get('/sessions')
def get_sessions(db: Session = Depends(get_db)):
    rows = db.query(AWSCopilotSession).order_by(AWSCopilotSession.updated_at.desc()).all()
    return [_session_dict(s) for s in rows]

@router.get('/sessions/{session_id}')
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(AWSCopilotSession).filter(AWSCopilotSession.id == session_id).first()
    if not s: raise HTTPException(404)
    d = _session_dict(s)
    d['messages'] = [
        {
            'id': m.id, 'role': m.role, 'content': m.content,
            'tool_calls': m.tool_calls,
            'created_at': m.created_at.isoformat() if m.created_at else None,
        }
        for m in (s.messages or [])
    ]
    return d

@router.delete('/sessions/{session_id}')
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(AWSCopilotSession).filter(AWSCopilotSession.id == session_id).first()
    if not s: raise HTTPException(404)
    db.delete(s)
    safe_commit(db)
    return {"status": "success"}

def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

async def stream_aws_copilot_response(session_id: int, user_content: str, db: Session):
    def rollback():
        try: db.rollback()
        except: pass

    s = db.query(AWSCopilotSession).filter(AWSCopilotSession.id == session_id).first()
    if not s:
        yield sse('error', {'message': 'Session not found'})
        return

    # Persist user message
    user_msg = AWSCopilotMessage(session_id=session_id, role='user', content=user_content)
    db.add(user_msg)
    safe_commit(db)

    if s.title == 'New AWS Chat' and user_content.strip():
        s.title = user_content.strip()[:45]
        safe_commit(db)

    # Gather history
    history_rows = db.query(AWSCopilotMessage).filter(AWSCopilotMessage.session_id == session_id).order_by(AWSCopilotMessage.created_at.asc()).all()
    
    # We must construct messages exactly as Bedrock Converse API requires
    # For Bedrock: [{"role": "user"|"assistant", "content": [{"text": "..."}, {"toolUse": {...}}, {"toolResult": {...}}]}]
    bedrock_messages = []
    for m in history_rows[:-1]: # exclude the one we just added
        content_blocks = [{"text": m.content}]
        # Omit tool history for simplicity to avoid exceeding context or breaking Converse API strict alternating constraints,
        # but keep standard text conversation.
        if m.content:
            bedrock_messages.append({"role": m.role, "content": content_blocks})

    bedrock_messages.append({"role": "user", "content": [{"text": user_content}]})

    step = 0
    all_tools_used = []
    
    yield sse('status', {'message': 'Analyzing request...'})
    
    while step < MAX_TOOL_STEPS:
        step += 1
        try:
            # Synchronous call for tool-use logic
            # Run in executor to not block event loop
            loop = asyncio.get_running_loop()
            def _invoke():
                return invoke_minimax_with_tools(SYSTEM_PROMPT, bedrock_messages, TOOLS_CONFIG)
            
            response_msg = await loop.run_in_executor(None, _invoke)
        except Exception as e:
            logger.error(f"Bedrock invocation error: {e}")
            yield sse('error', {'message': f"Error calling AI model: {e}"})
            return
            
        bedrock_messages.append(response_msg)
        
        # Check if the model requested any tools
        tool_requests = [c for c in response_msg.get('content', []) if 'toolUse' in c]
        if not tool_requests:
            # Model generated final text. Let's extract and stream it (actually we already have the full text here)
            # To simulate streaming of the final response, we could have used stream_async above.
            # But since we have it, we just yield it.
            final_text = "".join([c.get('text', '') for c in response_msg.get('content', []) if 'text' in c])
            for ch in final_text:
                yield sse('token', {'token': ch})
            
            # Save Assistant message
            ast_msg = AWSCopilotMessage(
                session_id=session_id, role='assistant', content=final_text, 
                tool_calls=all_tools_used
            )
            db.add(ast_msg)
            safe_commit(db)
            
            yield sse('done', {})
            return
            
        # Execute tools
        tool_results_content = []
        for req in tool_requests:
            t_use = req['toolUse']
            t_id = t_use['toolUseId']
            t_name = t_use['name']
            t_input = t_use['input']
            
            yield sse('status', {'message': f"Querying AWS: {t_name}..."})
            
            res_data = execute_tool(t_name, t_input)
            all_tools_used.append({"tool": t_name, "input": t_input, "result": res_data})
            
            tool_results_content.append({
                "toolResult": {
                    "toolUseId": t_id,
                    "content": [{"json": res_data}]
                }
            })
            
        # Append tool results to conversation
        bedrock_messages.append({
            "role": "user",
            "content": tool_results_content
        })
        
    # If we hit max steps
    error_msg = "I reached the maximum number of tool executions and couldn't complete the request."
    for ch in error_msg:
         yield sse('token', {'token': ch})
    
    ast_msg = AWSCopilotMessage(
        session_id=session_id, role='assistant', content=error_msg, 
        tool_calls=all_tools_used
    )
    db.add(ast_msg)
    safe_commit(db)
    yield sse('done', {})

@router.post('/sessions/{session_id}/messages')
async def send_message_endpoint(session_id: int, body: MessageBody, db: Session = Depends(get_db)):
    return StreamingResponse(
        stream_aws_copilot_response(session_id, body.content, db),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'Connection': 'keep-alive'}
    )
