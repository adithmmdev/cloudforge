import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

const SERVICE_COLORS = { client: '#60A5FA', server: '#34D399', mongo: '#FBBF24', app: '#A78BFA' };

export default function LogsTab({ logs, isCompose }) {
  const [filter, setFilter] = useState('all');
  const bottomRef = useRef(null);

  const services = isCompose ? ['all', 'client', 'server', 'mongo'] : ['all'];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.service === filter);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered.length]);

  const colorLine = (line) => {
    if (!line) return '#9CA3AF';
    if (/error|err|exception|fatal|critical/i.test(line)) return '#EF4444';
    if (/warn|warning/i.test(line)) return '#F59E0B';
    if (/success|ok|healthy|started|ready|live/i.test(line)) return '#10B981';
    return '#D1D5DB';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <Terminal className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[12px] font-medium text-gray-600">Container Logs</span>
        {isCompose && (
          <div className="flex gap-1 ml-4">
            {services.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${
                  filter === s
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-[10px] text-gray-400 font-mono">{filtered.length} lines</span>
      </div>

      {/* Console */}
      <div className="flex-1 overflow-auto bg-gray-950 p-4 font-mono text-[11px]">
        {filtered.length === 0 ? (
          <div className="text-gray-600 italic">Waiting for logs...</div>
        ) : (
          <>
            {filtered.map((entry, i) => (
              <div key={i} className="flex gap-3 leading-relaxed hover:bg-gray-900 px-1 rounded group">
                {(isCompose || entry.service) && entry.service && (
                  <span className="flex-shrink-0 text-[9px] w-12 mt-0.5 font-semibold uppercase"
                    style={{ color: SERVICE_COLORS[entry.service] || '#9CA3AF' }}>
                    {entry.service}
                  </span>
                )}
                <span style={{ color: colorLine(entry.text || entry.line) }}>
                  {entry.text || entry.line}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
