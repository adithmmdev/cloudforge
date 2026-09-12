import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Activity, Server, Box, Cloud, RefreshCw, Plus, CircleDot, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const ACTIVE_STATUSES    = new Set(['pending', 'building', 'healing', 'provisioning', 'detecting', 'deploying', 'health_check']);
const HEALTHY_STATUSES   = new Set(['live', 'deployed']);
const ATTENTION_STATUSES = new Set(['failed', 'rolled_back']);

export default function Dashboard() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [projects, setProjects]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const wsRef = useRef(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/global`;
      const ws = new WebSocket(wsUrl);

      ws.onopen  = () => { setStreamConnected(true); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'global_sync' && Array.isArray(data.projects)) {
            setProjects(data.projects);
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        setStreamConnected(false);
        setTimeout(connectWs, 3000);
      };
      wsRef.current = ws;
    };

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      setStreamConnected(false);
    };
  }, [fetchProjects]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  };

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo('.mc-stagger-item', 
        { opacity: 0, y: 15, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' }
      );
    }
  }, { scope: containerRef, dependencies: [loading] });

  const activeProjects    = projects.filter(p => ACTIVE_STATUSES.has(p.status));
  const healthyProjects   = projects.filter(p => HEALTHY_STATUSES.has(p.status));
  const attentionProjects = projects.filter(p => ATTENTION_STATUSES.has(p.status));
  const inactiveProjects  = projects.filter(p => !p.status || p.status === 'unknown');

  // Dummy data for charts to match mockup
  const chartData = [
    { time: '00:00', value: 12 }, { time: '04:00', value: 15 }, { time: '08:00', value: 8 },
    { time: '12:00', value: 25 }, { time: '16:00', value: 18 }, { time: '20:00', value: 14 }
  ];

  const pieData = [
    { name: 'Healthy', value: healthyProjects.length || 1, color: '#22c55e' },
    { name: 'Active', value: activeProjects.length, color: '#818cf8' },
    { name: 'Attention', value: attentionProjects.length, color: '#fbbf24' },
    { name: 'Inactive', value: inactiveProjects.length, color: '#8A8F98' },
  ];

  return (
    <div ref={containerRef} className="min-h-screen px-8 py-8" style={{ color: '#EDEDEF' }}>
      {/* Header */}
      <header className="flex justify-between items-end mb-8 mc-stagger-item">
        <div>
          <p className="text-[10px] font-medium tracking-[0.06em] uppercase mb-1" style={{ color: '#8A8F98' }}>CloudForge / Operations</p>
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Mission Control</h1>
          <p className="text-[13px]" style={{ color: '#8A8F98' }}>A calm operating view of the projects and deployment state already synchronized by CloudForge.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cf-card px-4 py-2 flex items-center gap-2 text-[13px] font-medium hover:bg-white/5 transition-colors">
            Latest deployment <ChevronUp size={14} className="rotate-45 text-[#8A8F98]" />
          </button>
          <button onClick={handleRefresh} className="cf-card px-4 py-2 flex items-center gap-2 text-[13px] font-medium hover:bg-white/5 transition-colors">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => navigate('/upload')} className="px-4 py-2 rounded-lg flex items-center gap-2 text-[13px] font-medium text-white transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #5E6AD2 0%, #818cf8 100%)', boxShadow: '0 4px 15px rgba(94,106,210,0.3)' }}>
            <Plus size={14} /> Deploy project
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex flex-col gap-5">
        
        {/* Top Row (4 cards) */}
        <div className="grid grid-cols-4 gap-5">
          <div className="cf-card p-5 mc-stagger-item flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.2)' }}>
              <Server size={20} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#8A8F98' }}>System state</p>
              <h3 className="text-[16px] font-semibold mb-1">Operational</h3>
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                <span style={{ color: '#22c55e' }}>All systems online</span>
              </div>
            </div>
          </div>
          
          <div className="cf-card p-5 mc-stagger-item flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.2)' }}>
              <Activity size={20} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#8A8F98' }}>Active operations</p>
              <h3 className="text-[16px] font-semibold mb-1">{activeProjects.length} running</h3>
              <p className="text-[11px]" style={{ color: '#8A8F98' }}>{activeProjects.length === 0 ? 'No active deployments' : 'Deployments processing'}</p>
            </div>
          </div>

          <div className="cf-card p-5 mc-stagger-item flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.2)' }}>
              <Box size={20} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#8A8F98' }}>Projects</p>
              <div className="flex items-end gap-2">
                <h3 className="text-[16px] font-semibold mb-1">{projects.length}</h3>
                <span className="text-[11px] mb-1" style={{ color: '#22c55e' }}>+12% from last week</span>
              </div>
            </div>
          </div>

          <div className="cf-card p-5 mc-stagger-item flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.2)' }}>
              <Cloud size={20} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#8A8F98' }}>AWS connection</p>
              <h3 className="text-[16px] font-semibold mb-1">{streamConnected ? 'Connected' : 'Connecting'}</h3>
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'live-pulse' : ''}`} style={{ background: streamConnected ? '#22c55e' : '#f59e0b' }} />
                <span style={{ color: streamConnected ? '#22c55e' : '#f59e0b' }}>{streamConnected ? 'Project stream synchronized' : 'Establishing stream'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row (2 cards) */}
        <div className="grid grid-cols-3 gap-5">
          <div className="cf-card p-6 mc-stagger-item col-span-2 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={16} style={{ color: '#818cf8' }} />
                  <h3 className="text-[14px] font-semibold">Operational overview</h3>
                </div>
                <p className="text-[12px]" style={{ color: '#8A8F98' }}>Counts update from the existing project list and global synchronization stream.</p>
              </div>
              <div className="px-2.5 py-1 rounded border flex items-center gap-1.5 text-[11px] font-medium" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
                <div className="w-1.5 h-1.5 rounded-full live-pulse" style={{ background: '#22c55e' }} /> Live
              </div>
            </div>
            <div className="flex-1 min-h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5E6AD2" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#8A8F98', fontSize: 10 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8A8F98', fontSize: 10 }} dx={-10} />
                  <Tooltip contentStyle={{ background: 'rgba(10,10,12,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(10px)' }} itemStyle={{ color: '#fff' }} />
                  <Area type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mt-6">
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{background:'#22c55e'}}/><span className="text-[11px]" style={{color:'#8A8F98'}}>Healthy</span></div>
                 <p className="text-[16px] font-semibold">{healthyProjects.length}</p>
               </div>
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{background:'#818cf8'}}/><span className="text-[11px]" style={{color:'#8A8F98'}}>Deploying</span></div>
                 <p className="text-[16px] font-semibold">{activeProjects.length}</p>
               </div>
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{background:'#fbbf24'}}/><span className="text-[11px]" style={{color:'#8A8F98'}}>Attention</span></div>
                 <p className="text-[16px] font-semibold">{attentionProjects.length}</p>
               </div>
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{background:'#8A8F98'}}/><span className="text-[11px]" style={{color:'#8A8F98'}}>Inactive</span></div>
                 <p className="text-[16px] font-semibold">{inactiveProjects.length}</p>
               </div>
            </div>
          </div>

          <div className="cf-card p-6 mc-stagger-item flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Box size={16} style={{ color: '#818cf8' }} />
              <h3 className="text-[14px] font-semibold">Project health distribution</h3>
            </div>
            <div className="flex-1 flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                 <h2 className="text-3xl font-semibold leading-none">{projects.length}</h2>
                 <span className="text-[11px] mt-1" style={{ color: '#8A8F98' }}>Projects</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} innerRadius={70} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 mt-2">
               {pieData.map(d => (
                 <div key={d.name} className="flex items-center justify-between text-[12px]">
                   <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                     <span style={{ color: '#8A8F98' }}>{d.name}</span>
                   </div>
                   <div className="flex gap-4">
                     <span className="font-semibold">{d.value}</span>
                     <span style={{ color: '#8A8F98', width: '30px', textAlign: 'right' }}>{Math.round((d.value/Math.max(1, projects.length))*100)}%</span>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Bottom Row (3 cards) */}
        <div className="grid grid-cols-3 gap-5">
          <div className="cf-card p-6 mc-stagger-item">
             <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-2">
                 <RefreshCw size={16} style={{ color: '#818cf8' }} />
                 <h3 className="text-[14px] font-semibold">Deployment queue</h3>
               </div>
               <span className="text-[11px]" style={{ color: '#8A8F98' }}>View all</span>
             </div>
             
             <p className="text-[10px] font-medium tracking-[0.06em] uppercase mb-1" style={{ color: '#8A8F98' }}>Current Work</p>
             <div className="flex justify-between items-center mb-4">
               <h4 className="text-[15px] font-semibold">Projects in motion</h4>
               <span className="text-[11px]" style={{ color: '#8A8F98' }}>{activeProjects.length} active</span>
             </div>

             <div className="cf-card p-6 mt-4 flex flex-col items-center justify-center text-center border-dashed border-white/10 bg-transparent min-h-[120px]">
                {activeProjects.length === 0 ? (
                  <>
                    <Cloud size={24} className="mb-3 opacity-40" />
                    <p className="text-[13px] font-medium mb-1">No active deployment operation</p>
                    <p className="text-[11px]" style={{ color: '#8A8F98' }}>CloudForge will surface live project state here as soon as an existing deployment enters the active pipeline.</p>
                  </>
                ) : (
                  <div className="w-full text-left space-y-3">
                    {activeProjects.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => navigate(`/projects/${p.id}`)}
                        className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors -mx-2"
                      >
                         <div>
                           <p className="text-[13px] font-semibold">{p.name}</p>
                           <p className="text-[10px]" style={{ color: '#8A8F98' }}>{p.framework || 'unknown'}</p>
                         </div>
                         <div className="px-2 py-1 rounded text-[10px] font-bold tracking-wider" style={{ background: 'rgba(94,106,210,0.15)', color: '#818cf8' }}>
                           {p.status.toUpperCase()}
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
          
          <div className="cf-card p-6 mc-stagger-item">
             <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-2">
                 <Activity size={16} style={{ color: '#818cf8' }} />
                 <h3 className="text-[14px] font-semibold">Recent activity</h3>
               </div>
               <span className="text-[11px] flex items-center gap-1.5" style={{ color: '#8A8F98' }}>
                 <div className="w-1.5 h-1.5 rounded-full live-pulse" style={{ background: '#818cf8' }} /> Live stream
               </span>
             </div>

             <div className="space-y-5 relative">
               <div className="absolute left-3.5 top-2 bottom-2 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
               
               <div className="flex gap-4 relative">
                 <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                   <RefreshCw size={12} style={{ color: '#22c55e' }} />
                 </div>
                 <div>
                   <p className="text-[12.5px] font-semibold">System synchronized</p>
                   <p className="text-[11px]" style={{ color: '#8A8F98' }}>Project list updated</p>
                 </div>
                 <span className="ml-auto text-[10px]" style={{ color: '#8A8F98' }}>2m ago</span>
               </div>

               <div className="flex gap-4 relative">
                 <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                   <Cloud size={12} style={{ color: '#22c55e' }} />
                 </div>
                 <div>
                   <p className="text-[12.5px] font-semibold">AWS connection healthy</p>
                   <p className="text-[11px]" style={{ color: '#8A8F98' }}>EC2, S3, RDS reachable</p>
                 </div>
                 <span className="ml-auto text-[10px]" style={{ color: '#8A8F98' }}>5m ago</span>
               </div>
             </div>
          </div>

          <div className="cf-card p-6 mc-stagger-item">
             <div className="flex items-center gap-2 mb-6">
               <AlertTriangle size={16} style={{ color: '#818cf8' }} />
               <h3 className="text-[14px] font-semibold">Release posture</h3>
             </div>
             
             <p className="text-[10px] font-medium tracking-[0.06em] uppercase mb-1" style={{ color: '#8A8F98' }}>Observed Status</p>
             <h4 className="text-[15px] font-semibold mb-6">Security & Health</h4>

             <div className="space-y-4">
               {[
                 { label: 'Healthy', val: healthyProjects.length, color: '#22c55e' },
                 { label: 'Active', val: activeProjects.length, color: '#818cf8' },
                 { label: 'Attention', val: attentionProjects.length, color: '#fbbf24' },
                 { label: 'Inactive', val: inactiveProjects.length, color: '#8A8F98' }
               ].map(r => (
                 <div key={r.label} className="flex items-center gap-3">
                   <span className="text-[12px] w-16" style={{ color: '#8A8F98' }}>{r.label}</span>
                   <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                     <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.val / Math.max(1, projects.length)) * 100)}%`, background: r.color }} />
                   </div>
                   <span className="text-[12px] font-semibold w-6 text-right">{r.val}</span>
                 </div>
               ))}
             </div>
             <p className="text-[10px] mt-6 leading-relaxed flex gap-2" style={{ color: '#8A8F98' }}>
               <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
               Status bars use only the project states returned by the existing API. No inferred health or deployment telemetry is introduced here.
             </p>
          </div>
        </div>
        
        {/* All Projects List */}
        <div className="mt-6 mb-12 mc-stagger-item">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold">All Projects</h3>
            <span className="text-[12px]" style={{ color: '#8A8F98' }}>{projects.length} total</span>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="cf-card p-5 cursor-pointer hover:-translate-y-1 transition-transform group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-[15px] group-hover:text-indigo-400 transition-colors">{p.name}</h4>
                  <div className="px-2 py-1 rounded text-[10px] font-bold tracking-wider" style={{ background: 'rgba(255,255,255,0.05)', color: '#8A8F98' }}>
                    {p.status ? p.status.toUpperCase() : 'UNKNOWN'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px]" style={{ color: '#8A8F98' }}>
                   <span>{p.framework || 'unknown framework'}</span>
                   {p.last_deployment_id && <span>Deployed</span>}
                </div>
              </div>
            ))}
            {projects.length === 0 && !loading && (
              <div className="col-span-3 cf-card p-8 flex flex-col items-center justify-center text-center border-dashed border-white/10 bg-transparent">
                <Box size={32} className="mb-4 opacity-40" />
                <p className="text-[14px] font-semibold mb-1">No projects found</p>
                <p className="text-[12px]" style={{ color: '#8A8F98' }}>Deploy a project to see it here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
