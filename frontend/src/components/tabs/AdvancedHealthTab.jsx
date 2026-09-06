import React, { useState, useEffect } from 'react';
import { Activity, Zap, Server, Database, Globe, ArrowUpRight, ShieldCheck, Cpu } from 'lucide-react';

export default function AdvancedHealthTab({ deploymentId, deploymentStatus }) {
  const [healthData, setHealthData] = useState(null);
  
  useEffect(() => {
    // Simulate fetching advanced health metrics
    if (!deploymentId) return;
    setTimeout(() => {
      setHealthData({
        uptime: '99.99%',
        latency: '45ms',
        reqPerSec: 142,
        errorRate: '0.01%',
        lastPing: 'Just now',
        securityScore: 'A+',
        appIndex: 98,
        geoNode: 'us-east-1a'
      });
    }, 1500);
  }, [deploymentId]);

  if (!healthData) {
    return (
      <div className="p-6 h-64 flex flex-col items-center justify-center text-gray-400 bg-white">
        <Activity className="w-8 h-8 mb-3 text-indigo-400 animate-pulse" />
        <p className="text-[13px]">Aggregating live health telemetry...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-full">
      <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
        <ShieldCheck className="w-5 h-5 text-indigo-600" />
        <h2 className="text-[15px] font-bold text-gray-800 tracking-tight">Advanced Health Analytics</h2>
        <span className="ml-auto px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
          Monitoring Active
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 hover:shadow-sm transition-all">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-blue-500" /> Network Latency
          </div>
          <div className="text-2xl font-bold text-gray-900">{healthData.latency}</div>
          <div className="text-[10px] text-gray-400 mt-1">p99 across all edge nodes</div>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 hover:shadow-sm transition-all">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Throughput
          </div>
          <div className="text-2xl font-bold text-gray-900">{healthData.reqPerSec} <span className="text-sm font-normal text-gray-500">req/s</span></div>
          <div className="text-[10px] text-gray-400 mt-1">Sustainable load</div>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 hover:shadow-sm transition-all">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-indigo-500" /> Uptime SLA
          </div>
          <div className="text-2xl font-bold text-gray-900">{healthData.uptime}</div>
          <div className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3"/> Meeting target</div>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 hover:shadow-sm transition-all">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-rose-500" /> Error Rate
          </div>
          <div className="text-2xl font-bold text-gray-900">{healthData.errorRate}</div>
          <div className="text-[10px] text-gray-400 mt-1">5xx server errors</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-xl p-5">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-400" /> Instance Topology
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[12px] border-b border-gray-100 pb-2">
              <span className="text-gray-500">Primary Node</span>
              <span className="font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{healthData.geoNode}</span>
            </div>
            <div className="flex justify-between items-center text-[12px] border-b border-gray-100 pb-2">
              <span className="text-gray-500">Security Posture</span>
              <span className="font-semibold text-emerald-600">{healthData.securityScore}</span>
            </div>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-gray-500">App Health Index</span>
              <span className="font-semibold text-indigo-600">{healthData.appIndex} / 100</span>
            </div>
          </div>
        </div>
        
        <div className="border border-gray-200 rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-white">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-2">Automated Optimization</h3>
          <p className="text-[12px] text-gray-600 mb-4 leading-relaxed">
            CloudForge continuously profiles the deployment. Memory leaks, unhandled rejections, and slow DB queries are proactively diagnosed by the LLM subsystem.
          </p>
          <div className="bg-white p-3 rounded border border-indigo-100 text-[11px] font-mono text-indigo-800">
            &gt; Neural profiling active...<br/>
            &gt; Baseline memory usage: 142MB<br/>
            &gt; No anomalies detected.
          </div>
        </div>
      </div>
    </div>
  );
}
