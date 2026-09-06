import React from 'react';
import { Server, Database, Globe, Cpu } from 'lucide-react';

const SERVICE_ICONS = { client: Globe, server: Server, mongo: Database, app: Cpu };
const SERVICE_COLORS = {
  client: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  server: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  mongo:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700' },
  app:    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
};

export default function ServiceListTab({ services }) {
  if (!services || services.length === 0) {
    return (
      <div className="p-6 text-[13px] text-gray-400 italic">
        No service information available. Deploy to see services.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-[13px] font-semibold text-gray-700 mb-4">
        Service List <span className="text-gray-400 font-normal">({services.length} services)</span>
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {services.map(svc => {
          const svcName = svc.name || svc.service_name || 'app';
          const Icon = SERVICE_ICONS[svcName] || Server;
          const c = SERVICE_COLORS[svcName] || SERVICE_COLORS.app;
          return (
            <div key={svcName} className={`rounded border ${c.border} ${c.bg} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${c.text}`} />
                <span className={`text-[13px] font-semibold ${c.text}`}>
                  {svcName}
                </span>
                <span className={`ml-auto w-2 h-2 rounded-full ${
                  svc.status === 'running' ? 'bg-emerald-500' :
                  svc.status === 'stopped' ? 'bg-red-400' : 'bg-gray-300'
                }`} />
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Image</span>
                  <span className="font-mono text-gray-700 truncate max-w-[140px]">{svc.image_tag || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Port</span>
                  <span className="font-mono">
                    {svc.host_port
                      ? <span className={`${c.text} font-medium`}>:{svc.host_port} (public)</span>
                      : <span className="text-gray-400">Internal Only</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Memory</span>
                  <span className="font-mono text-gray-700">256 MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CPU</span>
                  <span className="font-mono text-gray-700">0.5 cores</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
