import { Activity, Clock, AlertCircle, GitBranch, Server } from 'lucide-react';

const ACTIONS = [
  { 
    title: 'Why is this slow?', 
    desc: 'Investigate performance and bottlenecks',
    query: 'Why is this slow?', 
    icon: Clock, 
    color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' 
  },
  { 
    title: 'Explain the latest failure', 
    desc: 'Diagnose errors and log events',
    query: 'Explain the latest failure', 
    icon: AlertCircle, 
    color: '#fb7185', bg: 'rgba(244,63,94,0.1)' 
  },
  { 
    title: 'Show deployment timeline', 
    desc: 'Review recent stages and events',
    query: 'Show deployment timeline', 
    icon: GitBranch, 
    color: '#818cf8', bg: 'rgba(99,102,241,0.1)' 
  },
  { 
    title: 'What is Kimi doing?', 
    desc: 'Review recent reasoning and actions',
    query: 'What is Kimi doing?', 
    icon: Activity, 
    color: '#c084fc', bg: 'rgba(168,85,247,0.1)' 
  },
  { 
    title: 'Check infrastructure health', 
    desc: 'Inspect EC2 state and telemetry',
    query: 'Check infrastructure health', 
    icon: Server, 
    color: '#22d3ee', bg: 'rgba(6,182,212,0.1)' 
  },
];

export default function QuickActions({ onAction }) {
  return (
    <div className="w-full max-w-3xl mx-auto mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ACTIONS.map(({ title, desc, query, icon: Icon, color, bg }) => (
          <button
            key={title}
            onClick={() => onAction(query)}
            className="group flex flex-col items-start gap-3 p-4 rounded-2xl transition-all duration-300 outline-none hover:-translate-y-0.5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = 'rgba(94,106,210,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: bg }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold transition-colors" style={{ color: '#EDEDEF' }}>{title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#8A8F98' }}>{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
