import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Play, Square, RefreshCcw, Activity, Server, ActivitySquare, BrainCircuit, Loader2 } from 'lucide-react';

export default function ControlCenter() {
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
            // Always update deployments from WS (includes live now)
            if (Array.isArray(data.active_deployments)) setDeployments(data.active_deployments);
            if (Array.isArray(data.instances)) {
              setInstances(prev => {
                if (prev.length === 0) return data.instances;
                // Merge: update state/ip from WS, but keep full container info from REST fetch
                const merged = prev.map(p => {
                  const update = data.instances.find(i => i.id === p.id || i.id === p.aws_id);
                  return update ? { ...p, state: update.state, public_ip: update.public_ip } : p;
                });
                // Also add any NEW instances from WS not in prev
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
    
    // Also poll full metrics every 10s
    const int = setInterval(fetchAll, 10000);
    return () => {
      clearInterval(int);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleCancelDeployment = async (id) => {
    if (!confirm('Are you sure you want to cancel this deployment?')) return;
    // Optimistic update: immediately remove from list
    setDeployments(prev => prev.filter(d => d.id !== id));
    await fetch(`/api/deployments/${id}/cancel`, { method: 'POST' });
    fetchAll();
  };

  const handleCancelAll = async () => {
    if (!confirm('Are you sure you want to cancel ALL active deployments?')) return;
    // Optimistic update: clear all
    setDeployments([]);
    await fetch('/api/deployments/action/cancel-all', { method: 'POST' });
    fetchAll();
  };

  const handleInstanceAction = async (id, action) => {
    if (!confirm(`Are you sure you want to ${action} instance ${id}?`)) return;
    // Optimistic update: reflect new state immediately
    const newState = action === 'stop' ? 'stopping' : action === 'start' ? 'pending' : 'rebooting';
    setInstances(prev => prev.map(i => i.id === id ? { ...i, state: newState } : i));
    await fetch(`/api/instances/${id}/${action}`, { method: 'POST' });
    fetchAll();
  };

  const handleStopAllInstances = async () => {
    if (!confirm('EMERGENCY: Are you sure you want to STOP ALL CloudForge-managed EC2 instances? This will disrupt active apps.')) return;
    // Optimistic update: mark all as stopping
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

  return (
    <div className="p-8 max-w-[1400px] mx-auto font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Resource Control Center</h1>
          <p className="text-sm text-gray-500 mt-1">Manage deployments, instances, and monitor global usage in real-time.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCancelAll} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[13px] font-medium shadow hover:bg-red-700 transition-all">Stop All Deployments</button>
          <button onClick={handleStopAllInstances} className="px-4 py-2 bg-red-800 text-white rounded-lg text-[13px] font-medium shadow hover:bg-red-900 transition-all">Stop All CF Instances</button>
          <button onClick={fetchAll} className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-all"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-1 mb-8 p-1 bg-gray-100 rounded-lg w-max">
        {['deployments', 'instances', 'monitoring', 'analysis'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`px-5 py-2 text-[13px] font-medium capitalize rounded-md transition-all ${
              activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading && deployments.length === 0 && <div className="text-center py-10"><Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500"/></div>}

      {activeTab === 'deployments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Active &amp; Live Deployments</h3>
            <span className="text-[12px] text-gray-400 font-mono">{deployments.length} total</span>
          </div>
          {deployments.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 shadow-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No active deployments.</p>
              <p className="text-[13px] mt-1">All deployments are in a terminal state (cancelled, failed, or rolled back).</p>
            </div>
          ) : deployments.map(d => {
            const isLive = d.status === 'live';
            const isBuilding = ['pending', 'building', 'deploying', 'health_check', 'healing'].includes(d.status);
            const isRemediation = d.status === 'remediation_proposed';
            let badgeCls = 'bg-amber-50 text-amber-700 border-amber-200';
            let dotCls = 'bg-amber-500 animate-pulse';
            if (isLive) { badgeCls = 'bg-emerald-50 text-emerald-700 border-emerald-200'; dotCls = 'bg-emerald-500'; }
            if (isRemediation) { badgeCls = 'bg-purple-50 text-purple-700 border-purple-200'; dotCls = 'bg-purple-500 animate-pulse'; }
            return (
              <div key={d.id} className={`border p-5 rounded-xl bg-white flex justify-between items-center shadow-sm ${isLive ? 'border-emerald-200' : 'border-gray-200'}`}>
                <div>
                  <p className="font-semibold text-gray-900">Deployment <span className="font-mono">#{d.id}</span> <span className="text-gray-400 font-normal ml-2">Project {d.project_id}</span></p>
                  <div className="flex items-center gap-3 mt-1.5 text-[13px]">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium text-[11px] ${badgeCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                      {d.status.toUpperCase().replace('_', ' ')}
                    </span>
                    {d.started_at && <span className="text-gray-400">Started: {new Date(d.started_at).toLocaleString()}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancelDeployment(d.id)}
                  className="px-4 py-2 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[13px] font-medium hover:bg-red-100 flex items-center gap-1.5 transition-all"
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
          <h3 className="text-lg font-semibold text-gray-800">CloudForge-Managed EC2 Instances</h3>
          {instances.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 shadow-sm">No managed instances found.</div>
          ) : instances.map(i => (
            <div key={i.id} className="border border-gray-200 p-5 rounded-xl bg-white shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 font-mono">{i.id}</p>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${i.state === 'running' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {i.state.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-500 mt-1">IP: {i.public_ip || 'N/A'} &bull; Type: {i.instance_type}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleInstanceAction(i.id, 'start')} disabled={i.state !== 'stopped'} className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"><Play className="w-4 h-4"/></button>
                  <button onClick={() => handleInstanceAction(i.id, 'stop')} disabled={i.state !== 'running'} className="px-3 py-1.5 bg-red-50 border border-red-100 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"><Square className="w-4 h-4"/></button>
                  <button onClick={() => handleInstanceAction(i.id, 'restart')} disabled={i.state !== 'running'} className="px-3 py-1.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"><RefreshCcw className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Containers</p>
                <div className="flex flex-wrap gap-2">
                  {!i.containers || i.containers.length === 0 ? <span className="text-[12px] text-gray-400">None</span> : i.containers.map((c, idx) => (
                    <span key={idx} className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded shadow-sm">
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
          <div className="border border-gray-200 rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-indigo-500"/> Instance Metrics</h3>
            {instanceMetrics.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No data available</p> : instanceMetrics.map(m => (
              <div key={m.aws_instance_id} className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <p className="font-mono text-[13px] font-medium text-gray-800">{m.aws_instance_id} <span className="text-gray-400 font-sans ml-1">({m.public_ip})</span></p>
                  {m.is_idle && <span className="text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Auto-stop in {m.auto_stop_countdown_minutes}m</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block text-[11px] font-medium uppercase tracking-wider mb-1">CPU Load</span> 
                    <span className="text-[16px] font-semibold text-gray-900">{m.total_cpu_percent.toFixed(1)}%</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="text-gray-500 block text-[11px] font-medium uppercase tracking-wider mb-1">Memory Used</span> 
                    <span className="text-[16px] font-semibold text-gray-900">{m.total_mem_mb.toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2"><ActivitySquare className="w-4 h-4 text-indigo-500"/> Deployment Telemetry</h3>
            {depMetrics.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No data available</p> : depMetrics.map(d => (
              <div key={d.deployment_id} className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                <p className="text-[13px] font-semibold text-gray-800">Deploy #{d.deployment_id} <span className="text-[11px] font-normal text-gray-500 ml-2 bg-gray-100 px-2 py-0.5 rounded">{d.status}</span></p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                    <span className="text-gray-500 block text-[10px] font-medium uppercase tracking-wider mb-1">Time</span> 
                    <span className="text-[15px] font-semibold text-gray-900">{Math.round(d.elapsed_seconds)}s</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                    <span className="text-gray-500 block text-[10px] font-medium uppercase tracking-wider mb-1">Failures</span> 
                    <span className="text-[15px] font-semibold text-gray-900">{d.failures}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                    <span className="text-gray-500 block text-[10px] font-medium uppercase tracking-wider mb-1">Remediations</span> 
                    <span className="text-[15px] font-semibold text-gray-900">{d.remediations}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="max-w-4xl">
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Advanced AI Analysis</h3>
                <p className="text-[14px] text-gray-500 mt-0.5">Predictive insights, cost optimizations, and security scans.</p>
              </div>
            </div>

            {analysis ? (
              <div className="space-y-6">
                <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-inner">
                  <h4 className="text-[11px] uppercase tracking-wider text-indigo-300 font-semibold mb-2">Executive Summary</h4>
                  <p className="text-[14px] leading-relaxed font-medium">{analysis.executive_summary}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
                    <h4 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                      ⚡ Performance Insights
                    </h4>
                    <ul className="space-y-2">
                      {analysis.performance_insights?.map((item, i) => (
                        <li key={i} className="text-[13px] text-gray-700 leading-snug flex items-start gap-2">
                          <span className="text-indigo-400 mt-0.5">•</span> <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
                    <h4 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                      💰 Cost Optimization
                    </h4>
                    <ul className="space-y-2">
                      {analysis.cost_optimization?.map((item, i) => (
                        <li key={i} className="text-[13px] text-gray-700 leading-snug flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span> <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
                    <h4 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                      🛡️ Security Risks
                    </h4>
                    <ul className="space-y-2">
                      {analysis.security_risks?.map((item, i) => (
                        <li key={i} className="text-[13px] text-gray-700 leading-snug flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span> <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
                    <h4 className="text-[13px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                      💡 Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {analysis.recommendations?.map((item, i) => (
                        <li key={i} className="text-[13px] text-gray-700 leading-snug flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span> <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={() => setAnalysis(null)} 
                    className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[14px] font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-3 transition-colors shadow-sm"
                >
                  {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                  {analyzing ? 'Analyzing Infrastructure...' : 'Generate Full Analysis Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
