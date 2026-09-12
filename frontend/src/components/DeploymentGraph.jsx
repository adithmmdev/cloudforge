import React from 'react';

const STATUS_COLORS = {
  live: '#22c55e', building: '#f59e0b', failed: '#f43f5e',
  pending: '#8A8F98', healing: '#a78bfa', rolled_back: '#f97316',
  deployed: '#22c55e', health_check: '#f59e0b', deploying: '#6366f1',
  provisioning: '#3b82f6', detecting: '#8b5cf6',
};

function Node({ x, y, label, sublabel, port, status, isInternal }) {
  const color = STATUS_COLORS[status] || '#8A8F98';
  return (
    <g>
      <rect x={x - 64} y={y - 28} width={128} height={56} rx={16}
        fill="rgba(255,255,255,0.06)" stroke={color} strokeWidth={1}
        filter="url(#shadow)"
      />
      <circle cx={x + 50} cy={y - 18} r={4} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color}66)` }} />
      <text x={x} y={y - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#EDEDEF" fontFamily="var(--font-sans)">
        {label}
      </text>
      {sublabel && (
        <text x={x} y={y + 5} textAnchor="middle" fontSize={10} fill="#8A8F98" fontFamily="var(--font-mono)">
          {sublabel}
        </text>
      )}
      {port && (
        <text x={x} y={y + 18} textAnchor="middle" fontSize={9} fill={isInternal ? '#8A8F98' : '#818cf8'} fontFamily="var(--font-mono)">
          {isInternal ? '⬤ Internal Only' : `→ :${port}`}
        </text>
      )}
    </g>
  );
}

function AnimatedLine({ x1, y1, x2, y2, color = 'rgba(255,255,255,0.1)' }) {
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
  const W = 800, H = 260;
  const s = STATUS_COLORS[status] || '#8A8F98';

  return (
    <div className="w-full h-full relative overflow-hidden rounded-[16px]" 
      style={{ 
        background: 'rgba(255,255,255,0.03)', 
        backdropFilter: 'blur(48px)',
        WebkitBackdropFilter: 'blur(48px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15)'
      }}>
      <style>{`
        @keyframes flow {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="12" floodOpacity="0.4" floodColor="#000" />
            <feDropShadow dx="0" dy="1" stdDeviation="0" floodOpacity="0.05" floodColor="#fff" />
          </filter>
        </defs>

        {/* Internet */}
        <Node x={80} y={H / 2} label="Internet" sublabel="0.0.0.0/0" status="live" />

        {/* Arrow to EC2 */}
        <AnimatedLine x1={144} y1={H / 2} x2={230} y2={H / 2} color="#818cf8" />

        {/* EC2 Host */}
        <Node
          x={310}
          y={H / 2}
          label="EC2 Host"
          sublabel={instanceIp || '?.?.?.?'}
          status={status}
        />

        {isCompose ? (
          <>
            {/* MERN: 3 containers spread out across H=260: y=50, 130, 210 */}
            <AnimatedLine x1={374} y1={H / 2} x2={460} y2={50} color={s} />
            <AnimatedLine x1={374} y1={H / 2} x2={460} y2={130} color={s} />
            <AnimatedLine x1={374} y1={H / 2} x2={460} y2={210} color={s} />

            <Node x={540} y={50}     label="Client (React)"    sublabel="nginx:alpine"  port={deployment?.services?.find(sv => sv.service_name === 'client')?.host_port || '80'} status={status} />
            <Node x={540} y={130} label="Server (Express)"  sublabel="node:18-slim"  port="5000" isInternal status="pending" />
            <Node x={540} y={210} label="Database (Mongo)"  sublabel="mongo:7"       port="27017" isInternal status="pending" />

            {/* Internal pipe: Client +' Server */}
            <AnimatedLine x1={604} y1={65} x2={604} y2={102} color="rgba(255,255,255,0.06)" />
            {/* Internal pipe: Server +' Mongo */}
            <AnimatedLine x1={604} y1={158} x2={604} y2={182} color="rgba(255,255,255,0.06)" />
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
            { color: '#22c55e', label: 'Live' },
            { color: '#f59e0b', label: 'Building' },
            { color: '#f43f5e', label: 'Failed' },
            { color: '#8A8F98', label: 'Pending' },
          ].map(({ color, label }, i) => (
            <g key={label} transform={`translate(0, ${i * 14})`}>
              <circle cx={5} cy={5} r={4} fill={color} />
              <text x={13} y={9} fontSize={9} fill="#8A8F98" fontFamily="var(--font-sans)">{label}</text>
            </g>
          ))}
        </g>

        {status && (
          <text x={W - 10} y={H - 6} textAnchor="end" fontSize={10} fill="#8A8F98" fontFamily="var(--font-mono)">
            Deployment #{deployment?.id} · {status}
          </text>
        )}
      </svg>
    </div>
  );
}
