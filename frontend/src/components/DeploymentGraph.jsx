import React from 'react';

const STATUS_COLORS = {
  live: '#10B981', building: '#F59E0B', failed: '#EF4444',
  pending: '#94A3B8', healing: '#A855F7', rolled_back: '#F97316',
  deployed: '#10B981', health_check: '#F59E0B', deploying: '#6366F1',
  provisioning: '#3B82F6', detecting: '#8B5CF6',
};

function Node({ x, y, label, sublabel, port, status, isInternal }) {
  const color = STATUS_COLORS[status] || '#94A3B8';
  return (
    <g>
      <rect x={x - 64} y={y - 28} width={128} height={56} rx={4}
        fill="white" stroke={color} strokeWidth={1.5}
        filter="url(#shadow)"
      />
      <circle cx={x + 50} cy={y - 18} r={5} fill={color} />
      <text x={x} y={y - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0F172A" fontFamily="Inter, sans-serif">
        {label}
      </text>
      {sublabel && (
        <text x={x} y={y + 5} textAnchor="middle" fontSize={10} fill="#6B7280" fontFamily="'JetBrains Mono', monospace">
          {sublabel}
        </text>
      )}
      {port && (
        <text x={x} y={y + 18} textAnchor="middle" fontSize={9} fill={isInternal ? '#9CA3AF' : '#4F46E5'} fontFamily="'JetBrains Mono', monospace">
          {isInternal ? '⬤ Internal Only' : `→ :${port}`}
        </text>
      )}
    </g>
  );
}

function AnimatedLine({ x1, y1, x2, y2, color = '#CBD5E1' }) {
  const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} opacity={0.3} />
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={1.5}
        strokeDasharray="6 4"
        style={{ animation: 'flow 1.5s linear infinite' }}
      />
      <polygon
        points={`${x2},${y2} ${x2 - 6},${y2 - 3} ${x2 - 6},${y2 + 3}`}
        fill={color} opacity={0.6}
        transform={`rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI} ${x2} ${y2})`}
      />
    </g>
  );
}

export default function DeploymentGraph({ deployment, services, instanceIp, status, isCompose }) {
  const W = 800, H = 200;
  const s = STATUS_COLORS[status] || '#94A3B8';

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden">
      <style>{`
        @keyframes flow {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.06" />
          </filter>
        </defs>

        {/* Internet */}
        <Node x={80} y={H / 2} label="Internet" sublabel="0.0.0.0/0" status="live" />

        {/* Arrow to EC2 */}
        <AnimatedLine x1={144} y1={H / 2} x2={230} y2={H / 2} color="#4F46E5" />

        {/* EC2 Host */}
        <Node
          x={310}
          y={H / 2}
          label="EC2 Host"
          sublabel={instanceIp || '—.—.—.—'}
          status={status}
        />

        {isCompose ? (
          <>
            {/* MERN: 3 containers */}
            <AnimatedLine x1={374} y1={H / 2} x2={460} y2={60} color={s} />
            <AnimatedLine x1={374} y1={H / 2} x2={460} y2={H / 2} color={s} />
            <AnimatedLine x1={374} y1={H / 2} x2={460} y2={H - 60} color={s} />

            <Node x={540} y={60}     label="Client (React)"    sublabel="nginx:alpine"  port={deployment?.services?.find(s => s.service_name === 'client')?.host_port || '80'} status={status} />
            <Node x={540} y={H / 2} label="Server (Express)"  sublabel="node:18-slim"  port="5000" isInternal status="pending" />
            <Node x={540} y={H - 60} label="Database (Mongo)"  sublabel="mongo:7"       port="27017" isInternal status="pending" />

            {/* Internal pipe: Client → Server */}
            <AnimatedLine x1={604} y1={75} x2={604} y2={H / 2 - 28} color="#E5E7EB" />
            {/* Internal pipe: Server → Mongo */}
            <AnimatedLine x1={604} y1={H / 2 + 28} x2={604} y2={H - 88} color="#E5E7EB" />
          </>
        ) : (
          <>
            {/* Single container */}
            <AnimatedLine x1={374} y1={H / 2} x2={480} y2={H / 2} color={s} />
            <Node
              x={560}
              y={H / 2}
              label="App Container"
              sublabel={services?.[0]?.image_tag || 'cloudforge-image'}
              port={services?.[0]?.host_port || deployment?.allocated_port}
              status={status}
            />
          </>
        )}

        {/* Legend */}
        <g transform="translate(12, 12)">
          {[
            { color: '#10B981', label: 'Live' },
            { color: '#F59E0B', label: 'Building' },
            { color: '#EF4444', label: 'Failed' },
            { color: '#94A3B8', label: 'Pending' },
          ].map(({ color, label }, i) => (
            <g key={label} transform={`translate(0, ${i * 14})`}>
              <circle cx={5} cy={5} r={4} fill={color} />
              <text x={13} y={9} fontSize={9} fill="#6B7280" fontFamily="Inter, sans-serif">{label}</text>
            </g>
          ))}
        </g>

        {status && (
          <text x={W - 10} y={H - 6} textAnchor="end" fontSize={10} fill="#9CA3AF" fontFamily="'JetBrains Mono', monospace">
            Deployment #{deployment?.id} · {status}
          </text>
        )}
      </svg>
    </div>
  );
}
