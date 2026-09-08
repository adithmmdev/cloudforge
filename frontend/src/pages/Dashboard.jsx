import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, CircleDot, Plus, RefreshCw, SortDesc, Trash2 } from 'lucide-react';
import MissionControlSidebar from '../components/mission-control/MissionControlSidebar.jsx';
import MissionControlSpinner from '../components/mission-control/MissionControlSpinner.jsx';
import '../components/mission-control/mission-control.css';

const ACTIVE_STATUSES = new Set(['pending', 'building', 'healing', 'provisioning', 'detecting', 'deploying', 'health_check']);
const HEALTHY_STATUSES = new Set(['live', 'deployed']);
const ATTENTION_STATUSES = new Set(['failed', 'rolled_back']);

function StatusPill({ status }) {
  const value = status || 'pending';
  return (
    <span className={`mc-status mc-status--${value}`}>
      <span className="mc-status-dot" aria-hidden="true" />
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function EmptyOperations() {
  return (
    <div className="mc-empty">
      <strong>No active deployment operation</strong>
      <p>CloudForge will surface live project state here as soon as an existing deployment enters the active pipeline.</p>
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('latest');
  const [deletingId, setDeletingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
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

      ws.onopen = () => {
        setStreamConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'global_sync' && Array.isArray(data.projects)) {
            setProjects(data.projects);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setStreamConnected(false);
        setTimeout(connectWs, 3000);
      };

      wsRef.current = ws;
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
      setStreamConnected(false);
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
    } catch (err) {
      alert('Error deleting project');
    }
    setDeletingId(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortOption === 'latest') return (b.last_deployment_id || 0) - (a.last_deployment_id || 0);
    if (sortOption === 'oldest') return (a.last_deployment_id || 0) - (b.last_deployment_id || 0);
    if (sortOption === 'az') return a.name.localeCompare(b.name);
    return 0;
  });

  const activeProjects = sortedProjects.filter(project => ACTIVE_STATUSES.has(project.status));
  const healthyProjects = sortedProjects.filter(project => HEALTHY_STATUSES.has(project.status));
  const attentionProjects = sortedProjects.filter(project => ATTENTION_STATUSES.has(project.status));
  const deployedProjects = sortedProjects.filter(project => project.last_deployment_id);
  const recentProjects = sortedProjects.filter(project => project.last_deployment_id).slice(0, 5);
  const totalProjects = Math.max(projects.length, 1);

  return (
    <div className="mc-page">
      <header className="mc-page-header">
        <div>
          <p className="mc-eyebrow">CloudForge / Operations</p>
          <h1 className="mc-page-title">Mission Control</h1>
          <p className="mc-page-subtitle">A calm operating view of the projects and deployment state already synchronized by CloudForge.</p>
        </div>
        <div className="mc-page-actions">
          <div className="mc-sort-wrap">
            <select value={sortOption} onChange={e => setSortOption(e.target.value)} className="mc-sort" aria-label="Sort projects">
              <option value="latest">Latest deployment</option>
              <option value="oldest">Oldest deployment</option>
              <option value="az">Project name</option>
            </select>
            <SortDesc className="mc-sort-icon" size={15} aria-hidden="true" />
          </div>
          <button type="button" className="mc-button mc-button-secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <MissionControlSpinner compact label="Refreshing projects" /> : <RefreshCw size={14} aria-hidden="true" />}
            Refresh
          </button>
          <button type="button" onClick={() => navigate('/upload')} className="mc-button mc-button-primary">
            <Plus size={15} aria-hidden="true" />
            Deploy project
          </button>
        </div>
      </header>

      <div className="mc-layout">
        <MissionControlSidebar />
        <main className="mc-content">
          {error && (
            <div className="mc-panel" role="alert">
              <div className="mc-panel-body mc-empty">
                <AlertTriangle size={18} color="#f00045" aria-hidden="true" />
                <strong>Project state could not be refreshed</strong>
                <p>Existing API request failed with: {error}</p>
              </div>
            </div>
          )}

          <section id="mc-overview" className="mc-overview" aria-labelledby="mc-overview-title">
            <div className="mc-overview-top">
              <div>
                <p className="mc-panel-label">System state</p>
                <h2 id="mc-overview-title" className="mc-section-title">Operational overview</h2>
                <p className="mc-section-copy">Counts update from the existing project list and global synchronization stream.</p>
              </div>
              <span className="mc-live-indicator"><span className="mc-live-dot" aria-hidden="true" />{streamConnected ? 'Project stream connected' : 'Project stream reconnecting'}</span>
            </div>

            {loading ? (
              <div className="mc-panel"><div className="mc-panel-body"><MissionControlSpinner label="Loading project state" /></div></div>
            ) : (
              <div className="mc-stat-grid">
                <div className="mc-stat"><p className="mc-stat-label">Projects</p><p className="mc-stat-value">{projects.length}<span className="mc-stat-unit">total</span></p><p className="mc-stat-copy">Registered CloudForge projects</p></div>
                <div className="mc-stat"><p className="mc-stat-label">Active</p><p className="mc-stat-value">{activeProjects.length}<span className="mc-stat-unit">now</span></p><p className="mc-stat-copy">Current pipeline operations</p></div>
                <div className="mc-stat"><p className="mc-stat-label">Healthy</p><p className="mc-stat-value">{healthyProjects.length}<span className="mc-stat-unit">live</span></p><p className="mc-stat-copy">Live or deployed projects</p></div>
                <div className="mc-stat"><p className="mc-stat-label">Attention</p><p className="mc-stat-value">{attentionProjects.length}<span className="mc-stat-unit">open</span></p><p className="mc-stat-copy">Failed or rolled-back state</p></div>
              </div>
            )}
          </section>

          <section id="mc-active" aria-labelledby="mc-active-title">
            <div className="mc-section-heading">
              <div><p className="mc-panel-label">Active operations</p><h2 id="mc-active-title" className="mc-section-title">Deployment queue</h2></div>
              <CircleDot size={18} color="#f00045" aria-hidden="true" />
            </div>
            <div className="mc-operation-grid" style={{ marginTop: 16 }}>
              <article className="mc-panel">
                <div className="mc-panel-head"><div><p className="mc-panel-label">Current work</p><h3 className="mc-panel-title">Projects in motion</h3></div><span className="mc-deployment-ref">{activeProjects.length} active</span></div>
                <div className="mc-panel-body">
                  {loading ? <MissionControlSpinner label="Loading active operations" /> : activeProjects.length === 0 ? <EmptyOperations /> : (
                    <div className="mc-queue">
                      {activeProjects.map(project => (
                        <div className="mc-queue-row" key={project.id}>
                          <div><Link className="mc-project-link mc-project-name" to={`/projects/${project.id}`}>{project.name}</Link><p className="mc-project-meta">{project.framework || 'unknown'} / {project.framework === 'mern' ? 'compose' : 'single container'}</p></div>
                          <StatusPill status={project.status} />
                          <span className="mc-deployment-ref">{project.last_deployment_id ? `DEP-${project.last_deployment_id}` : 'No deployment ref'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
              <article className="mc-panel">
                <div className="mc-panel-head"><div><p className="mc-panel-label">Release posture</p><h3 className="mc-panel-title">Observed status</h3></div></div>
                <div className="mc-panel-body mc-distribution">
                  <div className="mc-distribution-row"><span>Healthy</span><div className="mc-distribution-track"><div className="mc-distribution-fill" style={{ width: `${(healthyProjects.length / totalProjects) * 100}%` }} /></div><strong>{healthyProjects.length}</strong></div>
                  <div className="mc-distribution-row"><span>Active</span><div className="mc-distribution-track"><div className="mc-distribution-fill mc-distribution-fill--active" style={{ width: `${(activeProjects.length / totalProjects) * 100}%` }} /></div><strong>{activeProjects.length}</strong></div>
                  <div className="mc-distribution-row"><span>Attention</span><div className="mc-distribution-track"><div className="mc-distribution-fill mc-distribution-fill--attention" style={{ width: `${(attentionProjects.length / totalProjects) * 100}%` }} /></div><strong>{attentionProjects.length}</strong></div>
                  <p className="mc-note">Status bars use only the project states returned by the existing API. No inferred health or deployment telemetry is introduced here.</p>
                </div>
              </article>
            </div>
          </section>

          <section id="mc-autonomy" aria-labelledby="mc-autonomy-title">
            <div className="mc-section-heading"><div><p className="mc-panel-label">Agent activity</p><h2 id="mc-autonomy-title" className="mc-section-title">Autonomy remains project-scoped</h2><p className="mc-section-copy">Mission Control preserves its existing project-level data flow. Detailed reasoning and autonomy controls remain available on each project’s existing detail page.</p></div></div>
          </section>

          <section id="mc-observability" aria-labelledby="mc-observability-title">
            <div className="mc-section-heading"><div><p className="mc-panel-label">Observability</p><h2 id="mc-observability-title" className="mc-section-title">Recent deployment state</h2><p className="mc-section-copy">The most recent deployment reference and state for each project are presented without inventing timestamps or event details.</p></div></div>
            <div className="mc-observability-grid" style={{ marginTop: 16 }}>
              <article className="mc-panel"><div className="mc-panel-head"><div><p className="mc-panel-label">Deployment coverage</p><h3 className="mc-panel-title">Projects with a deployment reference</h3></div><span className="mc-deployment-ref">{deployedProjects.length}/{projects.length}</span></div><div className="mc-panel-body"><div className="mc-distribution-track" style={{ height: 8 }}><div className="mc-distribution-fill" style={{ width: `${(deployedProjects.length / totalProjects) * 100}%` }} /></div><p className="mc-note">A reference appears only when the current project list includes its last deployment identifier.</p></div></article>
              <article className="mc-panel"><div className="mc-panel-head"><div><p className="mc-panel-label">Refresh state</p><h3 className="mc-panel-title">Synchronized project inventory</h3></div></div><div className="mc-panel-body"><div className="mc-empty"><strong>{loading ? 'Loading current inventory' : 'Inventory available'}</strong><p>The existing global WebSocket remains the source for in-session project updates; refresh uses the existing projects request.</p></div></div></article>
            </div>
          </section>

          <section id="mc-projects" aria-labelledby="mc-projects-title">
            <div className="mc-section-heading"><div><p className="mc-panel-label">Project / deployment state</p><h2 id="mc-projects-title" className="mc-section-title">Project inventory</h2><p className="mc-section-copy">Manage projects using the same actions and routes as before.</p></div></div>
            <div className="mc-panel mc-projects-panel" style={{ marginTop: 16 }}>
              {loading ? (
                <div className="mc-panel-body"><MissionControlSpinner label="Loading project inventory" /></div>
              ) : sortedProjects.length === 0 ? (
                <div className="mc-panel-body mc-empty"><strong>No projects yet</strong><p>Deploy a project to populate Mission Control with real deployment state.</p><Link to="/upload" className="mc-button mc-button-primary"><Plus size={14} aria-hidden="true" /> Deploy project</Link></div>
              ) : (
                <div className="mc-table-wrap">
                  <table className="mc-table">
                    <thead><tr><th>ID</th><th>Project</th><th>Framework</th><th>Deployment type</th><th>Status</th><th>Last deployment</th><th>Actions</th></tr></thead>
                    <tbody>{sortedProjects.map(project => (
                      <tr key={project.id}>
                        <td className="mc-table-id">#{project.id}</td>
                        <td><Link className="mc-project-link mc-table-name" to={`/projects/${project.id}`}>{project.name}</Link></td>
                        <td><span className="mc-framework">{project.framework?.toUpperCase() || 'UNKNOWN'}</span></td>
                        <td className="mc-table-type">{project.framework === 'mern' ? 'compose' : 'single_container'}</td>
                        <td>{project.status ? <StatusPill status={project.status} /> : <span className="mc-deployment-ref">No deployments</span>}</td>
                        <td className="mc-table-id">{project.last_deployment_id ? `DEP-${project.last_deployment_id}` : '—'}</td>
                        <td><div className="mc-table-actions"><button type="button" onClick={(event) => handleDelete(event, project.id, project.name)} disabled={deletingId === project.id} className="mc-icon-button" aria-label={`Delete ${project.name}`} title="Delete project">{deletingId === project.id ? <MissionControlSpinner compact label={`Deleting ${project.name}`} /> : <Trash2 size={15} aria-hidden="true" />}</button><Link to={`/projects/${project.id}`} className="mc-view-link">View <ChevronRight size={14} aria-hidden="true" /></Link></div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {!loading && recentProjects.length > 0 && (
            <section className="mc-recent" aria-labelledby="mc-recent-title">
              <div className="mc-recent-head"><div><p className="mc-panel-label">Recent activity</p><h2 id="mc-recent-title" className="mc-section-title">Latest deployment references</h2></div></div>
              <div className="mc-recent-list">{recentProjects.map(project => <Link className="mc-recent-item mc-project-link" to={`/projects/${project.id}`} key={project.id}><span className={`mc-recent-marker mc-recent-marker--${project.status || 'pending'}`} aria-hidden="true" /><span><span className="mc-recent-title">{project.name}</span><span className="mc-recent-meta">{project.status ? project.status.replace(/_/g, ' ') : 'no deployment state'}</span></span><span className="mc-recent-id">DEP-{project.last_deployment_id}</span></Link>)}</div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
