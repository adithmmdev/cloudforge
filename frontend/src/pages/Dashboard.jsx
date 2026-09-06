import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, ChevronRight, Loader2, Trash2, SortDesc } from 'lucide-react';

const FRAMEWORK_COLORS = {
  react:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  express: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  flask:   { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200'  },
  fastapi: { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   },
  mern:    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200'  },
};

const STATUS_CONFIG = {
  live:        { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Live' },
  building:    { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Building' },
  failed:      { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Failed' },
  pending:     { dot: 'bg-gray-400',    text: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200',    label: 'Pending' },
  healing:     { dot: 'bg-purple-500',  text: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200',  label: 'Healing' },
  rolled_back: { dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  label: 'Rolled Back' },
  deployed:    { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Deployed' },
};

function FrameworkBadge({ framework }) {
  const c = FRAMEWORK_COLORS[framework] || FRAMEWORK_COLORS.react;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium font-mono border ${c.bg} ${c.text} ${c.border}`}>
      {framework?.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'building' || status === 'healing' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('latest');
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const wsRef = useRef(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/global`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'global_sync' && Array.isArray(data.projects)) {
            setProjects(data.projects);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setTimeout(connectWs, 3000);
      };

      wsRef.current = ws;
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchProjects]);

  const handleDelete = async (e, id, name) => {
    e.preventDefault();
    if (!confirm(`Are you sure you want to completely delete project "${name}"?\nThis will wipe all deployments, logs, and database records. This cannot be undone.`)) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(p => p.filter(proj => proj.id !== id));
      } else {
        alert('Failed to delete project');
      }
    } catch(err) {
      alert('Error deleting project');
    }
    setDeletingId(null);
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortOption === 'latest') return (b.last_deployment_id || 0) - (a.last_deployment_id || 0);
    if (sortOption === 'oldest') return (a.last_deployment_id || 0) - (b.last_deployment_id || 0);
    if (sortOption === 'az') return a.name.localeCompare(b.name);
    return 0;
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mission Control</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time overview of your deployments and infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={sortOption} 
              onChange={e => setSortOption(e.target.value)}
              className="appearance-none bg-white border border-gray-200 text-gray-700 text-[13px] font-medium py-2 pl-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="latest">Sort by Latest Deploy</option>
              <option value="oldest">Sort by Oldest Deploy</option>
              <option value="az">Sort A-Z</option>
            </select>
            <SortDesc className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
          
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Deploy New Project
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 shadow-sm">
          Failed to load projects: {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">ID</th>
              <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Project Name</th>
              <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Framework</th>
              <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Type</th>
              <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Last Deploy</th>
              <th className="px-5 py-3.5 text-right font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
            ) : sortedProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm">
                      <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900">No projects yet</p>
                      <p className="text-[13px] text-gray-500 mt-1">Deploy your first project to get started</p>
                    </div>
                    <Link to="/upload" className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-all mt-2">
                      <Plus className="w-4 h-4" /> Deploy Project
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              sortedProjects.map(project => (
                <tr key={project.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-5 py-4 font-mono text-[12px] text-gray-400">#{project.id}</td>
                  <td className="px-5 py-4">
                    <span className="font-semibold text-gray-900">{project.name}</span>
                  </td>
                  <td className="px-5 py-4">
                    <FrameworkBadge framework={project.framework} />
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[12px] text-gray-500 font-mono">
                      {project.framework === 'mern' ? 'compose' : 'single_container'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {project.status ? (
                      <StatusBadge status={project.status} />
                    ) : (
                      <span className="text-[12px] text-gray-400">No deployments</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-[11px] text-gray-400">
                    {project.last_deployment_id
                      ? `#${project.last_deployment_id}`
                      : '—'}
                  </td>
                  <td className="px-5 py-4 flex items-center justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDelete(e, project.id, project.name)}
                      disabled={deletingId === project.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete Project"
                    >
                      {deletingId === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <Link
                      to={`/projects/${project.id}`}
                      className="flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1.5 hover:bg-indigo-50 rounded transition-colors"
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
