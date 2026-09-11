import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

// ── Unchanged service colors (already dark) ───────────────────
const SERVICE_COLORS = {
  client: '#60A5FA',
  server: '#34D399',
  mongo:  '#FBBF24',
  app:    '#A78BFA',
};

export default function LogsTab({ logs, isCompose }) {
  // ── Unchanged state and logic ─────────────────────────────
  const [filter, setFilter] = useState('all');
  const bottomRef = useRef(null);

  const services = isCompose ? ['all', 'client', 'server', 'mongo'] : ['all'];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.service === filter);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered.length]);

  const colorLine = (line) => {
    if (!line) return '#6b7280';
    if (/error|err|exception|fatal|critical/i.test(line)) return '#f43f5e';
    if (/warn|warning/i.test(line)) return '#f59e0b';
    if (/success|ok|healthy|started|ready|live/i.test(line)) return '#22c55e';
    return 'rgba(237,237,239,0.8)';
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Controls bar ── */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(5,5,6,0.8)',
        }}
      >
        <Terminal className="w-3.5 h-3.5" style={{ color: '#8A8F98' }} />
        <span className="text-xs font-semibold" style={{ color: '#8A8F98' }}>Container Logs</span>

        {isCompose && (
          <div className="flex gap-1 ml-4">
            {services.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-2.5 py-0.5 rounded text-xs font-semibold border transition-all duration-150"
                style={{
                  background:   filter === s ? 'rgba(94,106,210,0.15)' : 'transparent',
                  color:        filter === s ? '#5E6AD2' : '#8A8F98',
                  borderColor:  filter === s ? 'rgba(94,106,210,0.3)' : 'rgba(255,255,255,0.09)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto text-xs font-mono" style={{ color: '#8A8F98' }}>
          {filtered.length} lines
        </span>
      </div>

      {/* ── Console ── */}
      <div
        className="flex-1 overflow-auto p-4 font-mono text-xs"
        style={{
          background: 'rgba(0,0,0,0.55)',
          color: 'rgba(237,237,239,0.8)',
        }}
      >
        {filtered.length === 0 ? (
          <div className="italic" style={{ color: '#8A8F98' }}>Waiting for logs...</div>
        ) : (
          <>
            {filtered.map((entry, i) => (
              <div
                key={i}
                className="flex gap-3 leading-relaxed px-1 rounded"
                style={{ transition: 'background 100ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {(isCompose || entry.service) && entry.service && (
                  <span
                    className="flex-shrink-0 w-12 mt-0.5 font-semibold uppercase"
                    style={{ color: SERVICE_COLORS[entry.service] || '#8A8F98', fontSize: '9px' }}
                  >
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
