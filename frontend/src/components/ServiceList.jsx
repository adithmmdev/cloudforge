import React from 'react';

export default function ServiceList({ services }) {
  if (!services || services.length === 0) {
    return <div className="text-gray-500">No services active.</div>;
  }

  return (
    <div className="space-y-4">
      {services.map((svc, idx) => (
        <div key={idx} className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
          <div>
            <h4 className="font-semibold text-gray-800">{svc.name}</h4>
            <span className="text-xs text-gray-500 font-mono">{svc.image}</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm mr-2 text-gray-600">{svc.status}</span>
            <div className={`w-3 h-3 rounded-full ${svc.status === 'running' ? 'bg-green-500' : svc.status === 'stopped' ? 'bg-red-500' : 'bg-yellow-500'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
