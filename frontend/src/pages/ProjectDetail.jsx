import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ExternalLink, Play, Loader2, ChevronRight, RefreshCw,
  AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import DeploymentGraph from '../components/DeploymentGraph.jsx';
import TimelineTab from '../components/tabs/TimelineTab.jsx';
import LogsTab from '../components/tabs/LogsTab.jsx';
import MetricsTab from '../components/tabs/MetricsTab.jsx';
import ServiceListTab from '../components/tabs/ServiceListTab.jsx';
import AgentReasoningTab from '../components/tabs/AgentReasoningTab.jsx';
import DisclosureLedgerTab from '../components/tabs/DisclosureLedgerTab.jsx';
import ShadowVerificationTab from '../components/tabs/ShadowVerificationTab.jsx';
import DeploymentReportTab from '../components/tabs/DeploymentReportTab.jsx';
import AdvancedHealthTab from '../components/tabs/AdvancedHealthTab.jsx';
import AutonomyDial from '../components/AutonomyDial.jsx';

// ── Tab definitions (unchanged) ───────────────────────────────
const TABS = [
  { key: 'timeline',   label: 'Timeline' },
  { key: 'reasoning',  label: 'Agent Reasoning' },
  { key: 'disclosure', label: 'Disclosure Ledger' },
  { key: 'shadow',     label: 'Shadow Verification' },
  { key: 'logs',       label: 'Logs' },
  { key: 'metrics',    label: 'Metrics' },
  { key: 'health',     label: 'Health Analytics' },
  { key: 'services',   label: 'Service List' },
  { key: 'report',     label: 'Deployment Report' },
];

// ── Dark status styles ────────────────────────────────────────
const STATUS_STYLES = {
  live:        'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  building:    'text-amber-400 bg-amber-500/10 border-amber-500/25',
  failed:      'text-rose-400 bg-rose-500/10 border-rose-500/25',
  pending:     'text-slate-400 bg-white/[0.04] border-white/[0.10]',

  healing:     'text-violet-400 bg-violet-500/10 border-violet-500/25',
  rolled_back: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  deployed:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
};

// ─────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  // ── All state (completely unchanged) ─────────────────────
  const { id: projectId } = useParams();
  const [project, setProject]           = useState(null);
  const [deployment, setDeployment]     = useState(null);
  const [activeTab, setActiveTab]       = useState('timeline');
  const [loading, setLoading]           = useState(true);
  const [deploying, setDeploying]       = useState(false);
  const [autonomyMode, setAutonomyMode] = useState('approve_each');

  // WS state (completely unchanged)
  const [stageEvents, setStageEvents]             = useState([]);
  const [logs, setLogs]                           = useState([]);
  const [liveMetrics, setLiveMetrics]             = useState([]);
  const [diagnosis, setDiagnosis]                 = useState(null);
  const [diagnoses, setDiagnoses]                 = useState([]);
  const [remediationAction, setRemediationAction] = useState(null);
  const [disclosures, setDisclosures]             = useState([]);
  const [shadowTests, setShadowTests]             = useState([]);
  const [shadowState, setShadowState]             = useState('idle');
  const wsRef         = useRef(null);
  const reconnectRef  = useRef(null);
  const deploymentIdRef = useRef(null);

  // ── Fetch project & latest deployment (completely unchanged) ──
  const fetchProject = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects`, { cache: 'no-store' });
      const data = await res.json();
      const proj = Array.isArray(data) ? data.find(p => String(p.id) === String(projectId)) : null;
      if (proj) {
        setProject(proj);
        if (proj.last_deployment_id) {
          const depRes = await fetch(`/api/deployments/${proj.last_deployment_id}`, { cache: 'no-store' });
          if (depRes.ok) {
            const dep = await depRes.json();
            setDeployment(dep);
            deploymentIdRef.current = dep.id;
          }
        }
      }
    } catch {}
    setLoading(false);
  }, [projectId]);

  const fetchAutonomy = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/autonomy`);
      if (res.ok) { const d = await res.json(); setAutonomyMode(d.mode); }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchAutonomy();
  }, [fetchProject, fetchAutonomy]);

  // ── WebSocket (completely unchanged) ──────────────────────
  const connectWS = useCallback((depId) => {
    if (wsRef.current) wsRef.current.close();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws/deployments/${depId}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const { event, ...payload } = data;

        switch (event) {
          case 'stage_update':
            setStageEvents(prev => [...prev, { ...payload, timestamp: new Date().toISOString() }]);
            setDeployment(prev => prev ? { ...prev, status: payload.stage === 'live' ? 'live' : prev.status } : prev);
            if (payload.stage === 'shadow_testing') setShadowState('building');
            if (payload.stage === 'live') { setActiveTab('timeline'); fetchProject(); }
            break;
          case 'build_log':
          case 'container_log':
            setLogs(prev => [...prev.slice(-500), payload]);
            break;
          case 'log_line':
            setLogs(prev => [...prev.slice(-500), { text: payload.text, service: payload.service || 'app', timestamp: payload.created_at }]);
            break;
          case 'metrics':
            setLiveMetrics(prev => [...prev.slice(-200), payload]);
            break;
          case 'diagnosis_proposed':
            setDiagnosis(payload);
            setActiveTab('reasoning');
            break;
          case 'disclosure_logged':
            setDisclosures(prev => [...prev, { ...payload, timestamp: payload.timestamp || new Date().toISOString() }]);
            break;
          case 'shadow_test_result':
            setShadowTests(prev => {
              const copy = [...prev];
              const idx = copy.findIndex(t => t.test_name === payload.test_name && t.remediation_action_id === payload.remediation_action_id);
              if (idx >= 0) copy[idx] = payload;
              else copy.push(payload);
              return copy;
            });
            if (payload.passed) setActiveTab('shadow');
            break;
          case 'awaiting_approval':
            setRemediationAction({ id: payload.remediation_action_id, status: 'awaiting_approval' });
            setActiveTab('reasoning');
            break;
          case 'remediation_promoted':
            setRemediationAction(prev => prev ? { ...prev, status: 'promoted' } : prev);
            setShadowState('passed');
            break;
          case 'remediation_shadow_testing':
            setRemediationAction(prev => prev ? { ...prev, status: 'shadow_testing' } : prev);
            setShadowState('building');
            break;
          case 'remediation_rejected':
            setRemediationAction(prev => prev ? { ...prev, status: 'rejected' } : prev);
            setShadowState('failed');
            break;
          case 'deployment_complete':
            setDeployment(prev => prev ? { ...prev, status: 'live', app_url: payload.app_url } : prev);
            fetchProject();
            break;
          case 'deployment_failed':
            setDeployment(prev => prev ? { ...prev, status: payload.rolled_back ? 'rolled_back' : 'failed' } : prev);
            setShadowState(prev => (prev === 'building' || prev === 'testing') ? 'failed' : prev);
            break;
          case 'deployment_resumed':
            if (payload.deployment_id === depId) {
              setDeployment(prev => prev ? { ...prev, status: 'pending' } : prev);
              setDiagnosis(null);
              setRemediationAction(null);
            }
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(() => {
        if (deploymentIdRef.current) connectWS(deploymentIdRef.current);
      }, 5000);
    };
  }, [fetchProject]);

  // ── Hydrate historical data (completely unchanged) ─────────
  useEffect(() => {
    if (!deployment?.id) return;
    const depId = deployment.id;
    (async () => {
      try {
        const [diagData, discData, shadowData, stageData, remActData] = await Promise.all([
          fetch(`/api/deployments/${depId}/diagnoses`,            { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/disclosures`,          { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/shadow-tests`,         { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/stage-events`,         { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/remediation-actions`,  { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        ]);
        if (diagData.length > 0) {
          setDiagnoses(prev => prev.length === 0 ? diagData : prev);
          setDiagnosis(diagData[diagData.length - 1]);
        }
        if (discData.length > 0)   setDisclosures(prev => prev.length === 0 ? discData : prev);
        if (shadowData.length > 0) {
          setShadowTests(prev => prev.length === 0 ? shadowData : prev);
          setShadowState(shadowData.every(t => t.passed) ? 'passed' : 'failed');
        }
        if (stageData.length > 0) {
          const nonLogEvents = stageData.filter(e => e.stage !== 'log');
          const logEvents    = stageData.filter(e => e.stage === 'log');
          setStageEvents(prev => prev.length === 0 ? nonLogEvents : prev);
          setLogs(prev => prev.length === 0 ? logEvents.map(e => {
            const detail = e.detail || '';
            if (detail.includes(':')) {
              const [svc, ...rest] = detail.split(':');
              return { text: rest.join(':').trim(), service: svc.trim(), timestamp: e.created_at };
            }
            return { text: detail, service: 'app', timestamp: e.created_at };
          }) : prev);
        }
        if (remActData.length > 0) {
          const pending = remActData.find(a => a.status === 'awaiting_approval');
          const latest  = remActData[remActData.length - 1];
          setRemediationAction(prev => prev || pending || latest || null);
        }
      } catch {}
    })();
  }, [deployment?.id]);

  useEffect(() => {
    if (deployment?.id) {
      deploymentIdRef.current = deployment.id;
      connectWS(deployment.id);
    }
    return () => {
      if (wsRef.current)        wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [deployment?.id, connectWS]);

  // ── Action handlers (completely unchanged) ─────────────────
  const handleDeploy = async () => {
    setDeploying(true);
    setStageEvents([]);
    setLogs([]);
    setLiveMetrics([]);
    setDiagnoses([]);
    setDiagnosis(null);
    setShadowTests([]);
    setShadowState('idle');
    setDisclosures([]);
    try {
      const res  = await fetch(`/api/projects/${projectId}/deploy`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDeployment({ id: data.deployment_id, status: 'pending' });
        deploymentIdRef.current = data.deployment_id;
      }
    } catch {}
    setDeploying(false);
  };

  const handleResume = async () => {
    if (!deployment?.id) return;
    setDeploying(true);
    setDiagnoses([]);
    setDiagnosis(null);
    setRemediationAction(null);
    setShadowState('idle');
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/resume`, { method: 'POST' });
      if (res.ok) { setDeployment(prev => ({ ...prev, status: 'pending' })); }
    } catch {}
    setDeploying(false);
  };

  const handleAutonomyChange = async (mode) => {
    setAutonomyMode(mode);
    await fetch(`/api/projects/${projectId}/autonomy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  };

  // ── Derived state (completely unchanged) ──────────────────
  const status      = deployment?.status || 'none';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const isCompose   = project?.framework === 'mern';
  const isActive    = ['pending', 'building', 'deploying', 'health_check', 'healing'].includes(status);

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        style={{ color: '#8A8F98' }}
      >
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // ── 404 state ─────────────────────────────────────────────
  if (!project) {
    return (
      <div className="p-6" style={{ color: '#8A8F98' }}>
        <div className="flex items-center gap-2" style={{ color: '#f43f5e' }}>
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Project #{projectId} not found</span>
        </div>
        <Link
          to="/"
          className="mt-3 inline-block text-xs"
          style={{ color: '#5E6AD2' }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  return (
    <motion.div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 40px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Project Header ── */}
      <div
        className="px-5 py-2.5 flex items-center gap-4 flex-shrink-0"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,10,12,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Link
          to="/"
          className="text-xs flex items-center gap-1 transition-colors duration-150"
          style={{ color: '#8A8F98' }}
          onMouseEnter={e => e.currentTarget.style.color = '#EDEDEF'}
          onMouseLeave={e => e.currentTarget.style.color = '#8A8F98'}
        >
          Dashboard <ChevronRight className="w-3 h-3" />
        </Link>

        <span className="text-sm font-semibold" style={{ color: '#EDEDEF', letterSpacing: '-0.01em' }}>
          {project.name}
        </span>

        <span
          className="px-2 py-0.5 rounded text-xs font-mono font-semibold border"
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.09)',
            color: '#8A8F98',
          }}
        >
          {project.framework?.toUpperCase()}
        </span>

        {deployment && (
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold border flex items-center gap-1.5 ${statusStyle}`}
          >
            {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
            {status}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {deployment?.app_url && status === 'live' && (
            <a
              href={deployment.app_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono font-medium transition-colors duration-150"
              style={{ color: '#4ade80' }}
              onMouseEnter={e => e.currentTarget.style.color = '#86efac'}
              onMouseLeave={e => e.currentTarget.style.color = '#4ade80'}
            >
              {deployment.app_url} <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <AutonomyDial projectId={projectId} currentMode={autonomyMode} onChange={handleAutonomyChange} />

          {(status === 'failed' || status === 'cancelled' || status === 'rolled_back' || status === 'remediation_proposed') && (
            <button
              onClick={handleResume}
              disabled={deploying || isActive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition-all duration-150 disabled:opacity-40"
              style={{
                color: '#5E6AD2',
                background: 'rgba(94,106,210,0.1)',
                borderColor: 'rgba(94,106,210,0.25)',
              }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(94,106,210,0.18)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(94,106,210,0.1)'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Resume
            </button>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || isActive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded border transition-all duration-150 disabled:opacity-40"
            style={{
              background: '#5E6AD2',
              borderColor: 'rgba(94,106,210,0.5)',
              boxShadow: '0 0 12px rgba(94,106,210,0.25)',
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#6872D9'; e.currentTarget.style.boxShadow = '0 0 20px rgba(94,106,210,0.4)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#5E6AD2'; e.currentTarget.style.boxShadow = '0 0 12px rgba(94,106,210,0.25)'; }}
          >
            {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </div>

      {/* ── Topology Graph ── */}
      <div
        className="flex-shrink-0"
        style={{
          height: '210px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(2,2,3,0.6)',
        }}
      >
        <DeploymentGraph
          deployment={deployment}
          services={deployment?.services || []}
          instanceIp={project.instance_ip}
          status={status}
          isCompose={isCompose}
        />
      </div>

      {/* ── Tab Bar ── */}
      <div
        className="flex-shrink-0 px-5 flex items-end overflow-x-auto"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(5,5,6,0.9)',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all duration-150"
            style={{
              borderBottomColor: activeTab === tab.key ? '#5E6AD2' : 'transparent',
              color: activeTab === tab.key ? '#5E6AD2' : '#8A8F98',
            }}
            onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#EDEDEF'; }}
            onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = '#8A8F98'; }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'rgba(2,2,3,0.3)' }}
      >
        {activeTab === 'timeline'   && <TimelineTab events={stageEvents} currentStage={['failed', 'rolled_back', 'cancelled', 'live'].includes(deployment?.status) ? deployment.status : (stageEvents.length > 0 ? stageEvents[stageEvents.length - 1].stage : status)} deployment={deployment} />}
        {activeTab === 'reasoning'  && (
          <AgentReasoningTab
            diagnoses={diagnoses}
            diagnosis={diagnosis}
            remediationAction={remediationAction}
            autonomyMode={autonomyMode}
            isLocalActive={isActive}
            deploymentId={deployment?.id}
          />
        )}
        {activeTab === 'disclosure' && <DisclosureLedgerTab deploymentId={deployment?.id} liveDisclosures={disclosures} />}
        {activeTab === 'shadow'     && (
          <ShadowVerificationTab
            deploymentId={deployment?.id}
            shadowTests={shadowTests}
            shadowState={shadowState}
          />
        )}
        {activeTab === 'logs'       && <LogsTab logs={logs} isCompose={isCompose} />}
        {activeTab === 'metrics'    && <MetricsTab deploymentId={deployment?.id} liveMetrics={liveMetrics} />}
        {activeTab === 'health'     && <AdvancedHealthTab deploymentId={deployment?.id} deploymentStatus={deployment?.status} />}
        {activeTab === 'services'   && <ServiceListTab services={deployment?.services || []} />}
        {activeTab === 'report'     && <DeploymentReportTab deploymentId={deployment?.id} deploymentStatus={deployment?.status} />}
      </div>
    </motion.div>
  );
}
