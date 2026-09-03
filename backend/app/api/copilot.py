from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import datetime
import logging

from app.db.session import get_db
from app.models.copilot_session import CopilotSession
from app.models.copilot_message import CopilotMessage
from app.models.project import Project
from app.copilot import tools, classifier, deterministic, context_builder, kimi_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/copilot", tags=["copilot"])


class MessageBody(BaseModel):
    content: str


def _session_dict(s):
    return {
        "id": s.id,
        "project_id": s.project_id,
        "deployment_id": s.deployment_id,
        "title": s.title,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        "messages_count": len(s.messages) if s.messages is not None else 0,
    }


def _safe_commit(db: Session):
    """Commit, rolling back first if transaction is already aborted."""
    try:
        db.commit()
    except Exception:
        try:
            db.rollback()
            db.commit()
        except Exception as e2:
            logger.error(f"DB commit failed after rollback: {e2}")


# ── Session CRUD ──────────────────────────────────────────────────────────────

@router.post('/projects/{project_id}/sessions')
def create_session(project_id: int, db: Session = Depends(get_db)):
    dep_id = None
    try:
        dep = tools.get_current_deployment(db, project_id)
        if dep:
            dep_id = dep['id']
    except Exception as e:
        logger.warning(f"create_session deployment lookup failed: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    s = CopilotSession(project_id=project_id, deployment_id=dep_id, title='New Chat')
    db.add(s)
    _safe_commit(db)
    db.refresh(s)
    return _session_dict(s)


@router.get('/projects/{project_id}/sessions')
def get_sessions(project_id: int, db: Session = Depends(get_db)):
    try:
        rows = db.query(CopilotSession).filter(
            CopilotSession.project_id == project_id
        ).order_by(CopilotSession.updated_at.desc()).all()
        return [_session_dict(s) for s in rows]
    except Exception as e:
        logger.error(f"get_sessions error: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return []


@router.get('/sessions/{session_id}')
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(CopilotSession).filter(CopilotSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    d = _session_dict(s)
    d['messages'] = [
        {
            'id': m.id, 'role': m.role, 'content': m.content,
            'model': m.model, 'evidence_refs': m.evidence_refs,
            'tokens_in': m.tokens_in, 'tokens_out': m.tokens_out,
            'created_at': m.created_at.isoformat() if m.created_at else None,
        }
        for m in (s.messages or [])
    ]
    return d


@router.delete('/sessions/{session_id}')
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(CopilotSession).filter(CopilotSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    _safe_commit(db)
    return {"status": "success"}


@router.get('/sessions/{session_id}/messages')
def get_messages(session_id: int, db: Session = Depends(get_db)):
    try:
        rows = db.query(CopilotMessage).filter(
            CopilotMessage.session_id == session_id
        ).order_by(CopilotMessage.created_at.asc()).all()
        return [
            {
                'id': m.id, 'role': m.role, 'content': m.content,
                'model': m.model, 'evidence_refs': m.evidence_refs,
                'created_at': m.created_at.isoformat() if m.created_at else None,
            }
            for m in rows
        ]
    except Exception as e:
        logger.error(f"get_messages error: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return []


# ── Streaming endpoint ────────────────────────────────────────────────────────

def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


GREETING_WORDS = {
    'hi', 'hello', 'hey', 'yo', 'sup', 'greetings', 'howdy',
    'hii', 'hiii', 'helo', 'hya', 'hy', 'good morning', 'good afternoon',
}

COPILOT_INTRO = """Hello! 👋 I'm the **CloudForge Deployment Copilot**, powered by Kimi K3.

I can help you with:
- 🚀 **Deployment status** — current stage, progress, elapsed time
- ❌ **Failure analysis** — what went wrong and why
- 📋 **Build logs** — container output, stderr, stdout
- 🖥️ **AWS / EC2 state** — instance status and IP
- 🧠 **AI reasoning** — what Qwen and Kimi recommended
- 🛡️ **Shadow verification** — smoke test results
- 📊 **Metrics** — CPU and memory usage per service

Just ask me anything about your deployments. What would you like to know?"""


async def stream_response(session_id: int, content: str, db: Session):
    """SSE generator — never raises unhandled exceptions."""

    def safe_rollback():
        try:
            db.rollback()
        except Exception:
            pass

    def safe_add_commit(obj):
        try:
            safe_rollback()
            db.add(obj)
            db.commit()
        except Exception as e:
            logger.error(f"safe_add_commit failed: {e}")
            safe_rollback()

    # ── 1. Load session ────────────────────────────────────────────────────
    try:
        s = db.query(CopilotSession).filter(CopilotSession.id == session_id).first()
    except Exception:
        safe_rollback()
        s = db.query(CopilotSession).filter(CopilotSession.id == session_id).first()

    if not s:
        yield sse('copilot_error', {'message': 'Session not found'})
        return

    # ── 2. Persist user message ─────────────────────────────────────────────
    safe_add_commit(CopilotMessage(session_id=session_id, role='user', content=content))

    # ── 3. Update session title ─────────────────────────────────────────────
    try:
        s.updated_at = datetime.datetime.utcnow()
        if s.title == 'New Chat' and content.strip():
            s.title = content.strip()[:45] + ('…' if len(content.strip()) > 45 else '')
        db.commit()
    except Exception:
        safe_rollback()

    # ── 4. Greeting fast-path ──────────────────────────────────────────────
    normalized = content.strip().lower().rstrip('!.,?')
    if normalized in GREETING_WORDS:
        yield sse('copilot_generating', {})
        for ch in COPILOT_INTRO:
            yield sse('copilot_token', {'token': ch})
        safe_add_commit(CopilotMessage(
            session_id=session_id, role='assistant',
            content=COPILOT_INTRO, model='deterministic',
            evidence_refs={'category': 'GREETING'}
        ))
        yield sse('copilot_done', {'tokens_in': 0, 'tokens_out': len(COPILOT_INTRO) // 4, 'model': 'deterministic'})
        return

    # ── 5. Classify ─────────────────────────────────────────────────────────
    yield sse('copilot_thinking', {'status': 'Classifying question…'})
    try:
        category = classifier.classify_question(content)
    except Exception:
        category = 'GENERAL'

    # ── 6. Conversation history ─────────────────────────────────────────────
    history_dicts = []
    try:
        history_rows = db.query(CopilotMessage).filter(
            CopilotMessage.session_id == session_id
        ).order_by(CopilotMessage.created_at.asc()).all()
        history_dicts = [{'role': m.role, 'content': m.content} for m in history_rows[:-1]]
    except Exception as e:
        logger.warning(f"History fetch failed: {e}")
        safe_rollback()

    # ── 7. Quick evidence (DB only) ─────────────────────────────────────────
    dep_status = None
    project_dict = None
    ec2_dict = None
    try:
        if s.project_id:
            dep_status = tools.get_current_deployment(db, s.project_id)
    except Exception as e:
        logger.warning(f"dep_status fetch failed: {e}")
        safe_rollback()

    try:
        if s.project_id:
            proj = db.query(Project).filter(Project.id == s.project_id).first()
            if proj:
                project_dict = {'id': proj.id, 'name': proj.name, 'framework': proj.framework}
    except Exception as e:
        logger.warning(f"project_dict fetch failed: {e}")
        safe_rollback()

    try:
        if s.project_id:
            ec2_dict = tools.get_ec2_status(db, s.project_id)
    except Exception as e:
        logger.warning(f"ec2_dict fetch failed: {e}")
        safe_rollback()

    # ── 8. Deterministic fast-path ──────────────────────────────────────────
    det_answer = None
    try:
        det_answer = deterministic.try_deterministic_answer(content, dep_status, project_dict, ec2_dict)
    except Exception:
        pass

    if det_answer and not classifier.needs_kimi(category, content):
        yield sse('copilot_generating', {})
        for ch in det_answer:
            yield sse('copilot_token', {'token': ch})
        safe_add_commit(CopilotMessage(
            session_id=session_id, role='assistant',
            content=det_answer, model='deterministic',
            evidence_refs={'category': category}
        ))
        yield sse('copilot_done', {'tokens_in': 0, 'tokens_out': len(det_answer) // 4, 'model': 'deterministic'})
        return

    # ── 9. Build rich context ───────────────────────────────────────────────
    yield sse('copilot_thinking', {'status': 'Gathering deployment evidence…'})
    dep_id = s.deployment_id
    if not dep_id and dep_status:
        dep_id = dep_status.get('id')

    ctx = {}
    tools_used = []
    try:
        ctx, tools_used = context_builder.build_context(
            db, s.project_id, dep_id, category, content, history_dicts
        )
        yield sse('copilot_context', {
            'tools_called': tools_used,
            'summary': f'{len(tools_used)} sources loaded'
        })
    except Exception as e:
        logger.warning(f"Context build error: {e}")
        safe_rollback()
        yield sse('copilot_context', {'tools_called': [], 'summary': 'Evidence unavailable'})

    # ── 10. Stream Kimi ─────────────────────────────────────────────────────
    try:
        system_prompt = context_builder.build_system_prompt(ctx, history_dicts)
    except Exception:
        system_prompt = "You are CloudForge Copilot. Answer questions about deployments."

    kimi_msgs = history_dicts[-6:] + [{'role': 'user', 'content': content}]
    tokens_in = kimi_client.get_token_estimate(system_prompt + content)

    yield sse('copilot_generating', {})
    # SSE keepalive: Render closes idle connections after ~55s.
    # Emit an SSE comment every 20s while Kimi streams. The frontend ignores comment lines.
    yield ': keepalive\n\n'
    full_response = ''
    kimi_ok = False

    try:
        async for token in kimi_client.stream_copilot_async(system_prompt, kimi_msgs):
            if token:
                full_response += token
                kimi_ok = True
                yield sse('copilot_token', {'token': token})
    except Exception as e:
        logger.error(f"Kimi stream error: {e}")

    # ── 11. Fallback if Kimi returned nothing ───────────────────────────────
    if not full_response:
        fallback = _build_fallback(dep_status, project_dict, ec2_dict, ctx)
        full_response = fallback
        for ch in fallback:
            yield sse('copilot_token', {'token': ch})

    # ── 12. Persist assistant message — always with fresh transaction ───────
    tokens_out = kimi_client.get_token_estimate(full_response)
    safe_add_commit(CopilotMessage(
        session_id=session_id, role='assistant',
        content=full_response,
        model='kimi-k3' if kimi_ok else 'local-fallback',
        evidence_refs={'tools': tools_used, 'category': category},
        tokens_in=tokens_in, tokens_out=tokens_out
    ))

    yield sse('copilot_done', {
        'tokens_in': tokens_in,
        'tokens_out': tokens_out,
        'model': 'kimi-k3' if kimi_ok else 'local-fallback'
    })


def _build_fallback(dep_status, project_dict, ec2_dict, ctx) -> str:
    lines = [
        "## CloudForge Evidence Summary\n\n",
        "> ⚠️ **Kimi K3 is unreachable** from this network. "
        "Showing real CloudForge data directly from the database:\n\n",
    ]
    if project_dict:
        lines.append(f"### 📦 Project: **{project_dict.get('name')}** (`{project_dict.get('framework')}`)\n\n")
    if dep_status:
        st = dep_status.get('status', 'unknown')
        e = dep_status.get('elapsed_seconds', 0)
        lines.append(
            f"### 🚀 Latest Deployment #{dep_status.get('id')}\n"
            f"- **Status:** `{st}`\n"
            f"- **Started:** {dep_status.get('started_at', 'unknown')}\n"
            f"- **Elapsed:** {e // 60}m {e % 60}s\n\n"
        )
    if ec2_dict:
        lines.append(
            f"### 🖥️ EC2: `{ec2_dict.get('aws_instance_id')}` — "
            f"**{ec2_dict.get('status')}** @ `{ec2_dict.get('public_ip')}`\n\n"
        )
    events = ctx.get('recent_events', [])
    if events:
        lines.append("### 📋 Recent Events\n")
        for ev in events[-5:]:
            lines.append(f"- `[{ev.get('stage')}]` {str(ev.get('detail', ''))[:120]}\n")
        lines.append("\n")
    errors = ctx.get('errors', [])
    if errors:
        lines.append("### ❌ Errors\n")
        for err in errors[:3]:
            lines.append(f"- **{err.get('error_class', 'Error')}**: {str(err.get('error_message', ''))[:200]}\n")
        lines.append("\n")
    if not dep_status and not project_dict:
        lines.append(
            "No deployment data found. Please select a project that has active deployments "
            "using the project selector at the top of the page.\n"
        )
    lines.append("---\n*To enable full AI analysis, ensure the server has outbound access to `integrate.api.nvidia.com`.*")
    return ''.join(lines)


@router.post('/sessions/{session_id}/messages')
async def send_message_endpoint(session_id: int, body: MessageBody, db: Session = Depends(get_db)):
    return StreamingResponse(
        stream_response(session_id, body.content, db),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )
