from sqlalchemy.orm import Session
from app.models.deployment import Deployment
from app.models.stage_event import StageEvent
from app.models.container import Container
from app.models.shadow_test import ShadowTest
from app.models.remediation_action import RemediationAction
from app.models.deployment_report import DeploymentReport
from app.models.failure import Failure
from app.models.disclosure import Disclosure
from app.models.project import Project
from typing import List, Dict, Any, Optional
import os
import re
import datetime


def serialize_dt(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def calc_elapsed(started_at, finished_at=None) -> int:
    """Safely compute elapsed seconds, stripping tzinfo to avoid naive/aware mismatch."""
    if not started_at:
        return 0
    try:
        start = started_at.replace(tzinfo=None) if started_at.tzinfo else started_at
        if finished_at:
            end = finished_at.replace(tzinfo=None) if finished_at.tzinfo else finished_at
        else:
            end = datetime.datetime.utcnow()
        return max(0, int((end - start).total_seconds()))
    except Exception:
        return 0


def get_current_deployment(db: Session, project_id: int) -> Optional[Dict[str, Any]]:
    dep = db.query(Deployment).filter(
        Deployment.project_id == project_id
    ).order_by(Deployment.started_at.desc()).first()
    if not dep:
        return None
    return {
        'id': dep.id,
        'status': dep.status,
        'deployment_type': dep.deployment_type,
        'started_at': serialize_dt(dep.started_at),
        'elapsed_seconds': calc_elapsed(dep.started_at, dep.finished_at),
        'finished_at': serialize_dt(dep.finished_at)
    }


def get_deployment_status(db: Session, dep_id: int) -> Optional[Dict[str, Any]]:
    dep = db.query(Deployment).filter(Deployment.id == dep_id).first()
    if not dep:
        return None
    return {
        'id': dep.id,
        'status': dep.status,
        'project_id': dep.project_id,
        'deployment_type': dep.deployment_type,
        'started_at': serialize_dt(dep.started_at),
        'elapsed_seconds': calc_elapsed(dep.started_at, dep.finished_at),
        'finished_at': serialize_dt(dep.finished_at),
        'instance_id': dep.instance_id
    }


def get_deployment_timeline(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    events = db.query(StageEvent).filter(
        StageEvent.deployment_id == dep_id
    ).order_by(StageEvent.created_at.asc()).all()
    return [{'id': e.id, 'stage': e.stage, 'detail': e.detail, 'created_at': serialize_dt(e.created_at)} for e in events]


def get_stage_timings(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    events = db.query(StageEvent).filter(
        StageEvent.deployment_id == dep_id
    ).order_by(StageEvent.created_at.asc()).all()
    if not events:
        return []
    stages = {}
    for e in events:
        if e.stage not in stages:
            stages[e.stage] = {'stage': e.stage, 'started_at': e.created_at, 'ended_at': e.created_at}
        else:
            stages[e.stage]['ended_at'] = e.created_at
    result = []
    for stage, data in stages.items():
        duration = calc_elapsed(data['started_at'], data['ended_at'])
        result.append({
            'stage': stage,
            'started_at': serialize_dt(data['started_at']),
            'ended_at': serialize_dt(data['ended_at']),
            'duration_seconds': duration
        })
    return result


def get_recent_events(db: Session, dep_id: int, n: int = 20) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    events = db.query(StageEvent).filter(
        StageEvent.deployment_id == dep_id
    ).order_by(StageEvent.created_at.desc()).limit(n).all()
    return [{'stage': e.stage, 'detail': e.detail, 'created_at': serialize_dt(e.created_at)} for e in reversed(events)]


def get_recent_errors(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    failures = db.query(Failure).filter(Failure.deployment_id == dep_id).all()
    return [{
        'id': f.id,
        'error_class': f.error_class,
        'error_message': (f.error_message or '')[:500],
        'detected_at': serialize_dt(f.detected_at)
    } for f in failures]


def get_build_logs(db: Session, dep_id: int, n: int = 150) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    log_stages = ('log', 'build_log', 'container_log', 'stdout', 'stderr')
    events = db.query(StageEvent).filter(
        StageEvent.deployment_id == dep_id,
        StageEvent.stage.in_(log_stages)
    ).order_by(StageEvent.created_at.desc()).limit(n).all()
    return [{'stage': e.stage, 'detail': e.detail, 'created_at': serialize_dt(e.created_at)} for e in reversed(events)]


def get_deployment_metrics(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    try:
        from app.models.metric import ContainerMetric
        metrics = db.query(ContainerMetric).filter(
            ContainerMetric.deployment_id == dep_id
        ).order_by(ContainerMetric.timestamp.desc()).limit(100).all()
        return [{'service_name': m.service_name, 'cpu_percent': m.cpu_percent,
                 'mem_usage_mb': m.mem_usage_mb, 'timestamp': serialize_dt(m.timestamp)} for m in metrics]
    except Exception:
        return []


def get_ec2_status(db: Session, project_id: int) -> Optional[Dict[str, Any]]:
    if not project_id:
        return None
    dep = db.query(Deployment).filter(
        Deployment.project_id == project_id
    ).order_by(Deployment.started_at.desc()).first()
    if not dep or not dep.instance_id:
        return None
    # Try to get real instance from DB
    try:
        from app.models.instance import Instance
        inst = db.query(Instance).filter(Instance.aws_instance_id == dep.instance_id).first()
        if inst:
            return {
                'aws_instance_id': inst.aws_instance_id,
                'public_ip': inst.public_ip or 'Unknown',
                'status': inst.status or 'unknown'
            }
    except Exception:
        pass
    return {
        'aws_instance_id': dep.instance_id,
        'public_ip': 'Unknown',
        'status': 'unknown'
    }


def get_service_status(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    containers = db.query(Container).filter(Container.deployment_id == dep_id).all()
    return [{
        'id': c.id,
        'service_name': c.service_name,
        'image_tag': c.image_tag,
        'host_port': c.host_port,
        'status': c.status,
        'started_at': serialize_dt(c.started_at)
    } for c in containers]


def get_shadow_results(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    try:
        tests = db.query(ShadowTest).filter(ShadowTest.deployment_id == dep_id).all()
        return [{
            'id': t.id,
            'test_name': t.test_name,
            'passed': t.passed,
            'output': (t.output or '')[:300],
            'ran_at': serialize_dt(t.ran_at)
        } for t in tests]
    except Exception:
        return []


def get_remediation_history(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    try:
        actions = db.query(RemediationAction).filter(
            RemediationAction.deployment_id == dep_id
        ).order_by(RemediationAction.created_at.desc()).all()
        return [{
            'id': a.id,
            'action_type': a.action_type,
            'status': a.status,
            'created_at': serialize_dt(a.created_at)
        } for a in actions]
    except Exception:
        return []


def get_qwen_result(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    try:
        from app.models.diagnosis import Diagnosis
        failures = db.query(Failure).filter(Failure.deployment_id == dep_id).all()
        fids = [f.id for f in failures]
        if not fids:
            return []
        diags = db.query(Diagnosis).filter(
            Diagnosis.failure_id.in_(fids),
            Diagnosis.model_tier == 'local'
        ).all()
        return [{
            'id': d.id,
            'action_type': d.action_type,
            'confidence': d.confidence,
            'reasoning': (d.reasoning or '')[:500],
            'created_at': serialize_dt(d.created_at)
        } for d in diags]
    except Exception:
        return []


def get_kimi_result(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    try:
        from app.models.diagnosis import Diagnosis
        failures = db.query(Failure).filter(Failure.deployment_id == dep_id).all()
        fids = [f.id for f in failures]
        if not fids:
            return []
        diags = db.query(Diagnosis).filter(
            Diagnosis.failure_id.in_(fids),
            Diagnosis.model_tier == 'cloud'
        ).all()
        return [{
            'id': d.id,
            'action_type': d.action_type,
            'confidence': d.confidence,
            'reasoning': (d.reasoning or '')[:500],
            'created_at': serialize_dt(d.created_at)
        } for d in diags]
    except Exception:
        return []


def get_disclosure_summary(db: Session, dep_id: int) -> List[Dict[str, Any]]:
    if not dep_id:
        return []
    try:
        failures = db.query(Failure).filter(Failure.deployment_id == dep_id).all()
        fids = [f.id for f in failures]
        if not fids:
            return []
        disclosures = db.query(Disclosure).filter(Disclosure.failure_id.in_(fids)).all()
        return [{
            'id': d.id,
            'destination': d.destination,
            'content_sent': re.sub(r'(key|token|secret|password)\s*=\s*\S+', r'\1=[REDACTED]',
                                   (d.content_sent or '')[:200], flags=re.IGNORECASE),
            'created_at': serialize_dt(d.created_at)
        } for d in disclosures]
    except Exception:
        return []


def get_deployment_history(db: Session, project_id: int, n: int = 10) -> List[Dict[str, Any]]:
    if not project_id:
        return []
    deps = db.query(Deployment).filter(
        Deployment.project_id == project_id
    ).order_by(Deployment.started_at.desc()).limit(n).all()
    return [{
        'id': d.id,
        'status': d.status,
        'deployment_type': d.deployment_type,
        'started_at': serialize_dt(d.started_at),
        'finished_at': serialize_dt(d.finished_at),
        'elapsed_seconds': calc_elapsed(d.started_at, d.finished_at)
    } for d in deps]


def get_report_summary(db: Session, dep_id: int) -> Optional[Dict[str, Any]]:
    if not dep_id:
        return None
    report = db.query(DeploymentReport).filter(DeploymentReport.deployment_id == dep_id).first()
    if not report:
        return None
    return {
        'deployment_id': report.deployment_id,
        'report_markdown': (report.report_markdown or '')[:1500],
        'generated_at': serialize_dt(report.generated_at)
    }


def list_project_files(db: Session, project_id: int, subpath: str = '') -> List[str]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return []
    base = f'/app/uploads/{project.name}'
    target = os.path.normpath(os.path.join(base, subpath))
    if not target.startswith(base):
        raise ValueError('Path outside project directory')
    result = []
    try:
        for root, dirs, files in os.walk(target):
            dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '__pycache__', '.venv')]
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, base)
                result.append(rel)
                if len(result) >= 100:
                    return result
    except Exception:
        pass
    return result


def search_project_code(db: Session, project_id: int, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return []
    base = f'/app/uploads/{project.name}'
    results = []
    skip_dirs = {'.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build'}
    skip_exts = {'.png', '.jpg', '.gif', '.ico', '.woff', '.ttf', '.map', '.min.js'}
    skip_files = {'.env', '.env.local', '.env.production'}
    try:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for fname in files:
                if fname in skip_files or any(fname.endswith(e) for e in skip_exts):
                    continue
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, base)
                try:
                    with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f, 1):
                            if query.lower() in line.lower():
                                results.append({'file': rel, 'line_number': i, 'line_content': line.rstrip()[:200]})
                                if len(results) >= max_results:
                                    return results
                except Exception:
                    continue
    except Exception:
        pass
    return results


def read_project_file(db: Session, project_id: int, file_path: str, start_line: int = 1, end_line: int = 200) -> Dict[str, Any]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError('Project not found')
    base = f'/app/uploads/{project.name}'
    target = os.path.normpath(os.path.join(base, file_path))
    if not target.startswith(base):
        raise ValueError('Path outside project directory')
    fname = os.path.basename(target)
    if fname in {'.env', '.env.local', '.env.production', 'id_rsa', 'credentials'}:
        raise ValueError('Access to this file is restricted')
    try:
        with open(target, 'r', encoding='utf-8', errors='ignore') as f:
            all_lines = f.readlines()
        total = len(all_lines)
        start = max(1, start_line) - 1
        end = min(total, end_line)
        content = ''.join(all_lines[start:end])
        if len(content) > 50000:
            content = content[:50000] + '\n... [truncated]'
        return {'file': file_path, 'start_line': start + 1, 'end_line': end, 'content': content, 'total_lines': total}
    except FileNotFoundError:
        raise ValueError(f'File not found: {file_path}')
