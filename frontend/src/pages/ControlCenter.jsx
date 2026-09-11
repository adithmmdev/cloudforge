import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Play, Square, RefreshCcw, Activity, Server, ActivitySquare, BrainCircuit, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
};

export default function ControlCenter() {
  // ── Original State Logic ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('deployments');
  const [deployments, setDeployments] = useState([]);
  const [instances, setInstances] = useState([]);
  const [instanceMetrics, setInstanceMetrics] = useState([]);
  const [depMetrics, setDepMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const wsRef = useRef(null);

  const fetchAll = async () => {
    try {
      const [depsRes, instRes, imRes, dmRes] = await Promise.all([
        fetch('/api/deployments/status/active', { cache: 'no-store' }),
        fetch('/api/instances', { cache: 'no-store' }),
        fetch('/api/monitoring/instances', { cache: 'no-store' }),
        fetch('/api/monitoring/deployments', { cache: 'no-store' })
      ]);
      if (depsRes.ok) setDeployments(await depsRes.json());
      if (instRes.ok) setInstances(await instRes.json());
      if (imRes.ok) setInstanceMetrics(await imRes.json());
      if (dmRes.ok) setDepMetrics(await dmRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/global`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'global_sync') {
            if (Array.isArray(data.active_deployments)) setDeployments(data.active_deployments);
            if (Array.isArray(data.instances)) {
              setInstances(prev => {
                if (prev.length === 0) return data.instances;
                const merged = prev.map(p => {
                  const update = data.instances.find(i => i.id === p.id || i.id === p.aws_id);
                  return update ? { ...p, state: update.state, public_ip: update.public_ip } : p;
                });
                data.instances.forEach(wsInst => {
                  const exists = merged.find(p => p.id === wsInst.id || p.aws_id === wsInst.id);
                  if (!exists) merged.push(wsInst);
                });
                return merged;
              });
            }
          }
        } catch (e) {}
      };

      ws.onclose = () => setTimeout(connectWs, 3000);
      wsRef.current = ws;
    };
    connectWs();
    
    const int = setInterval(fetchAll, 10000);
    return () => {
      clearInterval(int);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleCancelDeployment = async (id) => {
    if (!confirm('Are you sure you want to cancel this deployment?')) return;
    setDeployments(prev => prev.filter(d => d.id !== id));
    await fetch(`/api/deployments/${id}/cancel`, { method: 'POST' });
    fetchAll();
  };

  const handleCancelAll = async () => {
    if (!confirm('Are you sure you want to cancel ALL active deployments?')) return;
    setDeployments([]);
    await fetch('/api/deployments/action/cancel-all', { method: 'POST' });
    fetchAll();
  };

  const handleInstanceAction = async (id, action) => {
    if (!confirm(`Are you sure you want to ${action} instance ${id}?`)) return;
    const newState = action === 'stop' ? 'stopping' : action === 'start' ? 'pending' : 'rebooting';
    setInstances(prev => prev.map(i => i.id === id ? { ...i, state: newState } : i));
    await fetch(`/api/instances/${id}/${action}`, { method: 'POST' });
    fetchAll();
  };

  const handleStopAllInstances = async () => {
    if (!confirm('EMERGENCY: Are you sure you want to STOP ALL CloudForge-managed EC2 instances? This will disrupt active apps.')) return;
    setInstances(prev => prev.map(i => ({ ...i, state: 'stopping' })));
    await fetch('/api/instances/action/stop-all', { method: 'POST' });
    fetchAll();
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/monitoring/analyze', { method: 'POST' });
      if (res.ok) {
        setAnalysis(await res.json());
      } else {
        throw new Error('Failed to analyze');
      }
    } catch (e) {
      setAnalysis({
        executive_summary: "Analysis failed.",
        performance_insights: ["Could not connect to analysis endpoint."],
        cost_optimization: [],
        security_risks: [],
        recommendations: []
      });
    }
    setAnalyzing(false);
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <motion.div 
      className="p-8 max-w-[1400px] mx-auto font-sans"
      initial="hidden"
      animate="visible"
      variants={fadeUp}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#EDEDEF]">Resource Control Center</h1>
          <p className="text-sm mt-1" style={{ color: '#8A8F98' }}>Manage deployments, instances, and monitor global usage in real-time.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleCancelAll} 
            className="px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all"
            style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.15)'}
          >
            Stop All Deployments
          </button>
          <button 
            onClick={handleStopAllInstances} 
            className="px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all"
            style={{ background: 'rgba(225,29,72,0.15)', color: '#fda4af', border: '1px solid rgba(225,29,72,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(225,29,72,0.15)'}
          >
            Stop All CF Instances
          </button>
          <button 
            onClick={fetchAll} 
            className="px-4 py-2 rounded-lg text-sm transition-all flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-8 p-1 rounded-lg w-max" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {['deployments', 'instances', 'monitoring', 'analysis'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className="px-5 py-2 text-xs font-medium capitalize rounded-md transition-all relative"
            style={{ 
              color: activeTab === tab ? '#EDEDEF' : '#8A8F98',
            }}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="control-tab-active"
                className="absolute inset-0 rounded-md"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.05)' }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>

      {loading && deployments.length === 0 && (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: '#5E6AD2' }} />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'deployments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#EDEDEF]">Active &amp; Live Deployments</h3>
                <span className="text-xs font-mono text-[#8A8F98]">{deployments.length} total</span>
              </div>
              {deployments.length === 0 ? (
                <div className="p-8 rounded-xl border text-center shadow-sm cf-card flex flex-col items-center justify-center min-h-[160px]">
                  <Activity className="w-8 h-8 mb-3" style={{ color: '#5E6AD2', opacity: 0.5 }} />
                  <p className="font-medium text-[#EDEDEF]">No active deployments.</p>
                  <p className="text-xs mt-1" style={{ color: '#8A8F98' }}>All deployments are in a terminal state (cancelled, failed, or rolled back).</p>
                </div>
              ) : deployments.map(d => {
                const isLive = d.status === 'live';
                const isRemediation = d.status === 'remediation_proposed';
                
                let badgeStyle = { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)', dot: '#f59e0b' };
                if (isLive) badgeStyle = { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)', dot: '#22c55e' };
                if (isRemediation) badgeStyle = { bg: 'rgba(196,181,253,0.15)', text: '#c4b5fd', border: 'rgba(196,181,253,0.3)', dot: '#a78bfa' };

                return (
                  <div key={d.id} className="p-5 rounded-xl flex justify-between items-center shadow-sm cf-card" 
                    style={{ borderColor: isLive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)' }}
                  >
                    <div>
                      <p className="font-semibold text-[#EDEDEF]">
                        Deployment <span className="font-mono text-[#8A8F98]">#{d.id}</span> 
                        <span className="text-xs font-normal ml-2" style={{ color: '#8A8F98' }}>Project {d.project_id}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium text-[11px]"
                          style={{ background: badgeStyle.bg, color: badgeStyle.text, borderColor: badgeStyle.border }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${!isLive ? 'animate-pulse' : ''}`} style={{ background: badgeStyle.dot }} />
                          {d.status.toUpperCase().replace('_', ' ')}
                        </span>
                        {d.started_at && <span style={{ color: '#8A8F98' }}>Started: {new Date(d.started_at).toLocaleString()}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelDeployment(d.id)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                      style={{ background: 'rgba(244,63,94,0.1)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.2)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}
                    >
                      <Square className="w-3.5 h-3.5"/> {isLive ? 'Stop Live' : 'Cancel'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'instances' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#EDEDEF]">CloudForge-Managed EC2 Instances</h3>
              {instances.length === 0 ? (
                <div className="p-8 rounded-xl border text-center shadow-sm cf-card text-[#8A8F98] min-h-[120px] flex items-center justify-center">
                  No managed instances found.
                </div>
              ) : instances.map(i => (
                <div key={i.id} className="p-5 rounded-xl shadow-sm space-y-4 cf-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold font-mono text-[#EDEDEF]">{i.id}</p>
                        <span 
                          className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border"
                          style={{
                            background: i.state === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                            color: i.state === 'running' ? '#4ade80' : '#8A8F98',
                            borderColor: i.state === 'running' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          {i.state.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#8A8F98' }}>IP: {i.public_ip || 'N/A'} &bull; Type: {i.instance_type}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleInstanceAction(i.id, 'start')} 
                        disabled={i.state !== 'stopped'} 
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
                        onMouseEnter={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}}
                        onMouseLeave={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}}
                      >
                        <Play className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => handleInstanceAction(i.id, 'stop')} 
                        disabled={i.state !== 'running'} 
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}
                        onMouseEnter={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(244,63,94,0.2)'}}
                        onMouseLeave={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}}
                      >
                        <Square className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => handleInstanceAction(i.id, 'restart')} 
                        disabled={i.state !== 'running'} 
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
                        onMouseEnter={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}}
                        onMouseLeave={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}}
                      >
                        <RefreshCcw className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A8F98' }}>Active Containers</p>
                    <div className="flex flex-wrap gap-2">
                      {!i.containers || i.containers.length === 0 ? <span className="text-xs text-[#8A8F98]">None</span> : i.containers.map((c, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 text-[11px] font-mono rounded"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${c.status.includes('Up') ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {c.service_name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl shadow-sm cf-card">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[#EDEDEF]">
                  <Server className="w-4 h-4" style={{ color: '#5E6AD2' }}/> Instance Metrics
                </h3>
                {instanceMetrics.length === 0 ? <p className="text-xs text-center py-4" style={{ color: '#8A8F98' }}>No data available</p> : instanceMetrics.map(m => (
                  <div key={m.aws_instance_id} className="mb-4 pb-4 last:border-0 last:mb-0 last:pb-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex justify-between items-center">
                      <p className="font-mono text-xs font-medium text-[#EDEDEF]">{m.aws_instance_id} <span className="font-sans ml-1 text-[#8A8F98]">({m.public_ip})</span></p>
                      {m.is_idle && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>Auto-stop in {m.auto_stop_countdown_minutes}m</span>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#8A8F98' }}>CPU Load</span> 
                        <span className="text-sm font-semibold text-[#EDEDEF] font-mono">{m.total_cpu_percent.toFixed(1)}%</span>
                      </div>
                      <div className="p-3 rounded-lg border" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#8A8F98' }}>Memory Used</span> 
                        <span className="text-sm font-semibold text-[#EDEDEF] font-mono">{m.total_mem_mb.toFixed(1)} MB</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-xl shadow-sm cf-card">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[#EDEDEF]">
                  <ActivitySquare className="w-4 h-4" style={{ color: '#5E6AD2' }}/> Deployment Telemetry
                </h3>
                {depMetrics.length === 0 ? <p className="text-xs text-center py-4" style={{ color: '#8A8F98' }}>No data available</p> : depMetrics.map(d => (
                  <div key={d.deployment_id} className="mb-4 pb-4 last:border-0 last:mb-0 last:pb-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-xs font-semibold text-[#EDEDEF]">Deploy #{d.deployment_id} <span className="text-[10px] font-normal ml-2 px-2 py-0.5 rounded uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.05)', color: '#8A8F98' }}>{d.status}</span></p>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg border text-center" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#8A8F98' }}>Time</span> 
                        <span className="text-sm font-semibold text-[#EDEDEF] font-mono">{Math.round(d.elapsed_seconds)}s</span>
                      </div>
                      <div className="p-3 rounded-lg border text-center" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#8A8F98' }}>Failures</span> 
                        <span className="text-sm font-semibold text-[#EDEDEF] font-mono">{d.failures}</span>
                      </div>
                      <div className="p-3 rounded-lg border text-center" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#8A8F98' }}>Remediations</span> 
                        <span className="text-sm font-semibold text-[#EDEDEF] font-mono">{d.remediations}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="max-w-4xl">
              <div className="p-8 rounded-xl shadow-sm cf-card">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.2)' }}>
                    <BrainCircuit className="w-6 h-6" style={{ color: '#6872D9' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#EDEDEF]">Advanced AI Analysis</h3>
                    <p className="text-xs mt-0.5" style={{ color: '#8A8F98' }}>Predictive insights, cost optimizations, and security scans.</p>
                  </div>
                </div>

                {analysis ? (
                  <div className="space-y-6">
                    <div className="p-6 rounded-xl shadow-inner" style={{ background: 'linear-gradient(135deg, rgba(94,106,210,0.15) 0%, rgba(94,106,210,0.05) 100%)', border: '1px solid rgba(94,106,210,0.2)' }}>
                      <h4 className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: '#818cf8' }}>Executive Summary</h4>
                      <p className="text-sm leading-relaxed font-medium text-[#EDEDEF]">{analysis.executive_summary}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="rounded-xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 className="text-xs font-bold mb-3 flex items-center gap-2 text-[#EDEDEF]">
                          ⚡ Performance Insights
                        </h4>
                        <ul className="space-y-2">
                          {analysis.performance_insights?.map((item, i) => (
                            <li key={i} className="text-xs leading-snug flex items-start gap-2 text-[#8A8F98]">
                              <span className="mt-0.5" style={{ color: '#60a5fa' }}>•</span> <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="rounded-xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 className="text-xs font-bold mb-3 flex items-center gap-2 text-[#EDEDEF]">
                          💰 Cost Optimization
                        </h4>
                        <ul className="space-y-2">
                          {analysis.cost_optimization?.map((item, i) => (
                            <li key={i} className="text-xs leading-snug flex items-start gap-2 text-[#8A8F98]">
                              <span className="mt-0.5" style={{ color: '#22c55e' }}>•</span> <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 className="text-xs font-bold mb-3 flex items-center gap-2 text-[#EDEDEF]">
                          🛡️ Security Risks
                        </h4>
                        <ul className="space-y-2">
                          {analysis.security_risks?.map((item, i) => (
                            <li key={i} className="text-xs leading-snug flex items-start gap-2 text-[#8A8F98]">
                              <span className="mt-0.5" style={{ color: '#f43f5e' }}>•</span> <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="rounded-xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 className="text-xs font-bold mb-3 flex items-center gap-2 text-[#EDEDEF]">
                          💡 Recommendations
                        </h4>
                        <ul className="space-y-2">
                          {analysis.recommendations?.map((item, i) => (
                            <li key={i} className="text-xs leading-snug flex items-start gap-2 text-[#8A8F98]">
                              <span className="mt-0.5" style={{ color: '#f59e0b' }}>•</span> <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button 
                        onClick={() => setAnalysis(null)} 
                        className="px-4 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={{ color: '#8A8F98', background: 'transparent' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#EDEDEF'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#8A8F98'; e.currentTarget.style.background = 'transparent' }}
                      >
                        Clear Results
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8">
                    <button 
                      onClick={runAnalysis}
                      disabled={analyzing}
                      className="w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: '#5E6AD2', color: '#fff' }}
                      onMouseEnter={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = '#6872D9' }}
                      onMouseLeave={e => { if(!e.currentTarget.disabled) e.currentTarget.style.background = '#5E6AD2' }}
                    >
                      {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                      {analyzing ? 'Analyzing Infrastructure...' : 'Generate Full Analysis Report'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
