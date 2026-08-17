import React, { useEffect, useState, useRef } from 'react';

export default function LogConsole({ deploymentId }) {
  const [logs, setLogs] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!deploymentId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsRef.current = new WebSocket(`${protocol}//${window.location.host}/api/ws/deployments/${deploymentId}`);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs(prev => [...prev, data.message]);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [deploymentId]);

  return (
    <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
      {logs.length === 0 ? (
        <span className="text-gray-500">Waiting for logs...</span>
      ) : (
        logs.map((log, i) => <div key={i}>{log}</div>)
      )}
    </div>
  );
}
