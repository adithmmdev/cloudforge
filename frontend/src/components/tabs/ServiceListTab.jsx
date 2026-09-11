import React from 'react';
import { Server, Database, Globe, Cpu } from 'lucide-react';

// ── Service config ────────────────────────────────────────────
const SERVICE_ICONS = { client: Globe, server: Server, mongo: Database, app: Cpu };

const SERVICE_COLORS = {
  client: { accent: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
  server: { accent: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  mongo:  { accent: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
  app:    { accent: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)' },
};

// ─────────────────────────────────────────────────────────────
export default function ServiceListTab({ services }) {
  if (!services || services.length === 0) {
    return (
      <div className="p-6 text-sm italic" style={{ color: '#8A8F98' }}>
        No service information available. Deploy to see services.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#EDEDEF' }}>
        Service List{' '}
        <span className="font-normal" style={{ color: '#8A8F98' }}>({services.length} services)</span>
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {services.map(svc => {
          const svcName = svc.name || svc.service_name || 'app';
          const Icon    = SERVICE_ICONS[svcName] || Server;
          const c       = SERVICE_COLORS[svcName] || SERVICE_COLORS.app;
          const statusColor = svc.status === 'running'
            ? '#22c55e' : svc.status === 'stopped' ? '#f43f5e' : '#8A8F98';

          return (
            <div
              key={svcName}
              className="rounded-lg p-4"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" style={{ color: c.accent }} />
                <span className="text-sm font-semibold" style={{ color: c.accent }}>
                  {svcName}
                </span>
                <span
                  className="ml-auto w-2 h-2 rounded-full"
                  style={{ background: statusColor }}
                />
              </div>
              <div className="space-y-1.5 text-xs" style={{ color: '#8A8F98' }}>
                <div className="flex justify-between">
                  <span>Image</span>
                  <span className="font-mono truncate max-w-[140px]" style={{ color: '#EDEDEF' }}>
                    {svc.image_tag || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Port</span>
                  <span className="font-mono">
                    {svc.host_port
                      ? <span style={{ color: c.accent, fontWeight: 500 }}>:{svc.host_port} (public)</span>
                      : <span>Internal Only</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span className="font-mono" style={{ color: '#EDEDEF' }}>256 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>CPU</span>
                  <span className="font-mono" style={{ color: '#EDEDEF' }}>0.5 cores</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
