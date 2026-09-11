import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Activity, Cpu, Server, HardDrive } from 'lucide-react';

// CF design system colors for chart lines
const COLORS = ['#5E6AD2', '#22c55e', '#f59e0b', '#f43f5e', '#a78bfa'];


export default function MetricsTab({ deploymentId, liveMetrics }) {
  const [historical, setHistorical] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deploymentId) return;
    setLoading(true);
    fetch('/api/deployments/'+deploymentId+'/metrics')
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        const arr = Array.isArray(d) ? d : Object.entries(d).map(([service, m]) => ({ service, ...m }));
        setHistorical(arr);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [deploymentId]);

  const allData = [...historical, ...(liveMetrics || [])];
  const services = [...new Set(allData.map(m => m.service).filter(Boolean))];

  // Group by timestamp for recharts
  const chartData = useMemo(() => {
    const grouped = {};
    allData.forEach(m => {
      const t = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : 'Unknown';
      if (!grouped[t]) grouped[t] = { t };
      if (m.service) {
        grouped[t][m.service+'_cpu'] = typeof m.cpu_percent === 'number' ? parseFloat(m.cpu_percent.toFixed(2)) : null;
        grouped[t][m.service+'_mem'] = typeof m.mem_usage_mb === 'number' ? parseFloat(m.mem_usage_mb.toFixed(1)) : null;
      }
    });
    return Object.values(grouped).slice(-60); // Last 60 points
  }, [allData]);

  return (
    <div className="p-6 bg-gray-900 min-h-full text-white rounded-b-md pb-12">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-indigo-400" />
        <h3 className="text-[14px] font-semibold text-gray-100">Advanced Telemetry</h3>
        <span className="ml-auto text-[11px] font-mono text-emerald-400 border border-emerald-900 bg-emerald-950/30 px-2 py-0.5 rounded animate-pulse">
          LIVE DATA STREAM
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-inner">
          <div className="text-[11px] text-gray-400 mb-1 flex items-center gap-1.5"><Cpu className="w-3 h-3"/> Peak CPU</div>
          <div className="text-xl font-mono text-indigo-400">
            {allData.length ? Math.max(...allData.map(m => m.cpu_percent || 0)).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-inner">
          <div className="text-[11px] text-gray-400 mb-1 flex items-center gap-1.5"><Server className="w-3 h-3"/> Peak RAM</div>
          <div className="text-xl font-mono text-emerald-400">
            {allData.length ? Math.max(...allData.map(m => m.mem_usage_mb || 0)).toFixed(0) : 0} MB
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-inner">
          <div className="text-[11px] text-gray-400 mb-1 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Avg Load</div>
          <div className="text-xl font-mono text-amber-400">
            {allData.length ? (allData.reduce((a,b)=>a+(b.cpu_percent||0),0)/allData.length).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-inner">
          <div className="text-[11px] text-gray-400 mb-1 flex items-center gap-1.5"><HardDrive className="w-3 h-3"/> Datapoints</div>
          <div className="text-xl font-mono text-blue-400">{chartData.length}</div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-[13px] text-gray-500 border border-gray-800 rounded bg-gray-800/50">
          {loading ? 'Initializing advanced telemetry...' : 'Awaiting sensor data...'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-700 bg-gray-800/50 rounded-lg p-4">
            <p className="text-[12px] font-medium text-gray-300 mb-4 tracking-wide uppercase">Compute (CPU %)</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  {services.map((s, i) => (
                    <linearGradient key={s} id={"colorCpu"+s} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#6B7280' }} unit="%" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', fontSize: 12, color: '#fff' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                {services.map((s, i) => (
                  <Area key={s} type="monotone" name={s} dataKey={s+"_cpu"} stroke={COLORS[i % COLORS.length]} fillOpacity={1} fill={"url(#colorCpu"+s+")"} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="border border-gray-700 bg-gray-800/50 rounded-lg p-4">
            <p className="text-[12px] font-medium text-gray-300 mb-4 tracking-wide uppercase">Memory (MB)</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  {services.map((s, i) => (
                    <linearGradient key={s} id={"colorMem"+s} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[(i+2) % COLORS.length]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS[(i+2) % COLORS.length]} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} unit="M" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', fontSize: 12, color: '#fff' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                {services.map((s, i) => (
                  <Area key={s} type="monotone" name={s} dataKey={s+"_mem"} stroke={COLORS[(i+2) % COLORS.length]} fillOpacity={1} fill={"url(#colorMem"+s+")"} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
