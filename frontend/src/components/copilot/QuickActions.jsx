import { Activity, Clock, AlertCircle, GitBranch, Server } from 'lucide-react';

const ACTIONS = [
  { 
    title: 'Why is this slow?', 
    desc: 'Investigate performance and bottlenecks',
    query: 'Why is this slow?', 
    icon: Clock, 
    color: 'text-amber-500', bg: 'bg-amber-50' 
  },
  { 
    title: 'Explain the latest failure', 
    desc: 'Diagnose errors and log events',
    query: 'Explain the latest failure', 
    icon: AlertCircle, 
    color: 'text-red-500', bg: 'bg-red-50' 
  },
  { 
    title: 'Show deployment timeline', 
    desc: 'Review recent stages and events',
    query: 'Show deployment timeline', 
    icon: GitBranch, 
    color: 'text-indigo-500', bg: 'bg-indigo-50' 
  },
  { 
    title: 'What is Kimi doing?', 
    desc: 'Review recent reasoning and actions',
    query: 'What is Kimi doing?', 
    icon: Activity, 
    color: 'text-purple-500', bg: 'bg-purple-50' 
  },
  { 
    title: 'Check infrastructure health', 
    desc: 'Inspect EC2 state and telemetry',
    query: 'Check infrastructure health', 
    icon: Server, 
    color: 'text-cyan-500', bg: 'bg-cyan-50' 
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
            className="group flex flex-col items-start gap-2 p-4 rounded-2xl border border-gray-100 bg-white text-left transition-all duration-200 hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg}` }>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
