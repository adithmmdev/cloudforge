import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ExternalLink, Play, Loader2, ChevronRight, RefreshCw,
  AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
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

const TABS = [
  { key: 'timeline',     label: 'Timeline' },
  { key: 'reasoning',    label: 'Agent Reasoning' },
  { key: 'disclosure',   label: 'Disclosure Ledger' },
  { key: 'shadow',       label: 'Shadow Verification' },
  { key: 'logs',         label: 'Logs' },
  { key: 'metrics',      label: 'Metrics' },
  { key: 'health',       label: 'Health Analytics' },
  { key: 'services',     label: 'Service List' },
  { key: 'report',       label: 'Deployment Report' },
];

const STATUS_STYLES = {
  live:        'text-emerald-700 bg-emerald-50 border-emerald-200',
  building:    'text-amber-700 bg-amber-50 border-amber-200',
  failed:      'text-red-700 bg-red-50 border-red-200',
  pending:     'text-gray-600 bg-gray-50 border-gray-200',
  healing:     'text-purple-700 bg-purple-50 border-purple-200',
  rolled_back: 'text-orange-700 bg-orange-50 border-orange-200',
  deployed:    'text-emerald-700 bg-emerald-50 border-emerald-200',
};

export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [autonomyMode, setAutonomyMode] = useState('approve_each');

  // WS state
  const [stageEvents, setStageEvents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [remediationAction, setRemediationAction] = useState(null);
  const [disclosures, setDisclosures] = useState([]);
  const [shadowTests, setShadowTests] = useState([]);
  const [shadowState, setShadowState] = useState('idle');
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const deploymentIdRef = useRef(null);

  // Fetch project & latest deployment
  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects`, { cache: 'no-store' });
      const data = await res.json();
      const proj = Array.isArray(data) ? data.find(p => String(p.id) === String(projectId)) : null;
      if (proj) {
        setProject(proj);
        if (proj.last_deployment_id) {
          // Fetch the full deployment object
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

  // WebSocket connection
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
            if (payload.stage === 'live') {
              setActiveTab('timeline');
              fetchProject();
            }
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
            break;
          case 'remediation_rejected':
            setRemediationAction(prev => prev ? { ...prev, status: 'rejected' } : prev);
            break;
          case 'deployment_complete':
            setDeployment(prev => prev ? { ...prev, status: 'live', app_url: payload.app_url } : prev);
            fetchProject();
            break;
          case 'deployment_failed':
            setDeployment(prev => prev ? { ...prev, status: payload.rolled_back ? 'rolled_back' : 'failed' } : prev);
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

  // Hydrate historical data when a deployment is loaded (for failed/live deployments visited after the fact)
  useEffect(() => {
    if (!deployment?.id) return;
    const depId = deployment.id;
    (async () => {
      try {
        const [diagData, discData, shadowData, stageData, remActData] = await Promise.all([
          fetch(`/api/deployments/${depId}/diagnoses`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/disclosures`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/shadow-tests`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/stage-events`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch(`/api/deployments/${depId}/remediation-actions`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        ]);
        // Only hydrate if no live data yet
        if (diagData.length > 0) setDiagnosis(prev => prev || diagData[diagData.length - 1]);
        if (discData.length > 0) setDisclosures(prev => prev.length === 0 ? discData : prev);
        if (shadowData.length > 0) {
          setShadowTests(prev => prev.length === 0 ? shadowData : prev);
          setShadowState(shadowData.every(t => t.passed) ? 'passed' : 'failed');
        }
        if (stageData.length > 0) {
          const nonLogEvents = stageData.filter(e => e.stage !== 'log');
          const logEvents = stageData.filter(e => e.stage === 'log');
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
        // Hydrate remediation action for approve/reject buttons
        if (remActData.length > 0) {
          const pending = remActData.find(a => a.status === 'awaiting_approval');
          const latest = remActData[remActData.length - 1];
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
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [deployment?.id, connectWS]);

  const handleDeploy = async () => {
    setDeploying(true);
    setStageEvents([]);
    setLogs([]);
    setLiveMetrics([]);
    setDiagnosis(null);
    setShadowTests([]);
    setShadowState('idle');
    setDisclosures([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, { method: 'POST' });
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
    setDiagnosis(null);
    setRemediationAction(null);
    setShadowState('idle');
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/resume`, { method: 'POST' });
      if (res.ok) {
        setDeployment(prev => ({ ...prev, status: 'pending' }));
      }
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

  const status = deployment?.status || 'none';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const isCompose = project?.framework === 'mern';
  const isActive = ['pending', 'building', 'deploying', 'health_check', 'healing'].includes(status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>Project #{projectId} not found</span>
        </div>
        <Link to="/" className="mt-3 inline-block text-[12px] text-indigo-600 hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-44px)]">
      {/* Project Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-4 flex-shrink-0">
        <Link to="/" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
          Dashboard <ChevronRight className="w-3 h-3" />
        </Link>
        <span className="text-[13px] font-semibold text-gray-900">{project.name}</span>
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-gray-50 text-gray-600 border-gray-200">
          {project.framework?.toUpperCase()}
        </span>
        {deployment && (
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${statusStyle} flex items-center gap-1`}>
            {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
            {status}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {deployment?.app_url && status === 'live' && (
            <a href={deployment.app_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-emerald-600 hover:text-emerald-800 font-medium font-mono">
              {deployment.app_url} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <AutonomyDial projectId={projectId} currentMode={autonomyMode} onChange={handleAutonomyChange} />
          
          {(status === 'failed' || status === 'cancelled' || status === 'rolled_back' || status === 'remediation_proposed') && (
            <button
              onClick={handleResume}
              disabled={deploying || isActive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-50 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Resume
            </button>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || isActive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </div>

      {/* Topology Graph */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white" style={{ height: '220px' }}>
        <DeploymentGraph
          deployment={deployment}
          services={deployment?.services || []}
          instanceIp={project.instance_ip}
          status={status}
          isCompose={isCompose}
        />
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 flex items-end overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'timeline'   && <TimelineTab events={stageEvents} currentStage={stageEvents.length > 0 ? stageEvents[stageEvents.length - 1].stage : status} deployment={deployment} />}
        {activeTab === 'reasoning'  && (
          <AgentReasoningTab
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
    </div>
  );
}
