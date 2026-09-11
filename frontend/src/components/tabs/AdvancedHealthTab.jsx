import React, { useState, useEffect } from 'react';
import { Activity, Zap, Server, Database, Globe, ArrowUpRight, ShieldCheck, Cpu } from 'lucide-react';

// ── Dark metric card ──────────────────────────────────────────
function MetricCard({ icon: Icon, iconColor, label, value, unit, note, noteColor }) {
  return (
    <div
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    >
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-[0.07em]" style={{ color: '#8A8F98' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} /> {label}
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: '#EDEDEF', letterSpacing: '-0.02em' }}>
        {value}
        {unit && <span className="text-sm font-normal ml-1" style={{ color: '#8A8F98' }}>{unit}</span>}
      </div>
      {note && (
        <div className="text-xs mt-1 flex items-center gap-1" style={{ color: noteColor || '#8A8F98' }}>
          {noteColor === '#22c55e' && <ArrowUpRight className="w-3 h-3" />}
          {note}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function AdvancedHealthTab({ deploymentId, deploymentStatus }) {
  // ── Unchanged data fetching (setTimeout simulation) ───────
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    if (!deploymentId) return;
    setTimeout(() => {
      setHealthData({
        uptime:        '99.99%',
        latency:       '45ms',
        reqPerSec:     142,
        errorRate:     '0.01%',
        lastPing:      'Just now',
        securityScore: 'A+',
        appIndex:      98,
        geoNode:       'us-east-1a',
      });
    }, 1500);
  }, [deploymentId]);

  if (!healthData) {
    return (
      <div className="p-6 h-64 flex flex-col items-center justify-center" style={{ color: '#8A8F98' }}>
        <Activity className="w-8 h-8 mb-3 animate-pulse" style={{ color: '#5E6AD2' }} />
        <p className="text-sm">Aggregating live health telemetry...</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-full">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 mb-6 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <ShieldCheck className="w-5 h-5" style={{ color: '#5E6AD2' }} />
        <h2 className="text-sm font-bold tracking-tight" style={{ color: '#EDEDEF' }}>
          Advanced Health Analytics
        </h2>
        <span
          className="ml-auto px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
          Monitoring Active
        </span>
      </div>

      {/* ── Metric grid ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Globe}    iconColor="#60a5fa" label="Network Latency" value={healthData.latency}   note="p99 across all edge nodes" />
        <MetricCard icon={Zap}      iconColor="#f59e0b" label="Throughput"       value={healthData.reqPerSec} unit="req/s" note="Sustainable load" />
        <MetricCard icon={Server}   iconColor="#5E6AD2" label="Uptime SLA"       value={healthData.uptime}   note="Meeting target" noteColor="#22c55e" />
        <MetricCard icon={Database} iconColor="#f43f5e" label="Error Rate"       value={healthData.errorRate} note="5xx server errors" />
      </div>

      {/* ── Detail panels ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Instance topology */}
        <div className="rounded-xl p-5" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#EDEDEF' }}>
            <Cpu className="w-4 h-4" style={{ color: '#8A8F98' }} /> Instance Topology
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Primary Node',      value: healthData.geoNode,       mono: true },
              { label: 'Security Posture',  value: healthData.securityScore, color: '#22c55e' },
              { label: 'App Health Index',  value: `${healthData.appIndex} / 100`, color: '#5E6AD2' },
            ].map(({ label, value, mono, color }) => (
              <div
                key={label}
                className="flex justify-between items-center text-xs pb-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span style={{ color: '#8A8F98' }}>{label}</span>
                <span
                  className={mono ? 'font-mono' : 'font-semibold'}
                  style={{
                    color: color || '#EDEDEF',
                    background: mono ? 'rgba(255,255,255,0.06)' : 'transparent',
                    borderRadius: mono ? '4px' : '0',
                    padding: mono ? '2px 8px' : '0',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Automated optimization */}
        <div
          className="rounded-xl p-5"
          style={{
            border: '1px solid rgba(94,106,210,0.2)',
            background: 'linear-gradient(135deg, rgba(94,106,210,0.07) 0%, rgba(255,255,255,0.02) 100%)',
          }}
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#EDEDEF' }}>Automated Optimization</h3>
          <p className="text-xs mb-4 leading-relaxed" style={{ color: '#8A8F98' }}>
            CloudForge continuously profiles the deployment. Memory leaks, unhandled rejections, and slow DB queries are proactively diagnosed by the LLM subsystem.
          </p>
          <div
            className="p-3 rounded text-xs font-mono leading-relaxed"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(94,106,210,0.2)',
              color: '#818cf8',
            }}
          >
            &gt; Neural profiling active...<br/>
            &gt; Baseline memory usage: 142MB<br/>
            &gt; No anomalies detected.
          </div>
        </div>
      </div>
    </div>
  );
}
