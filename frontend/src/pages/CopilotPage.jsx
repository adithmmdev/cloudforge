import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BrainCircuit, AlertTriangle, Loader2, Sparkles, ChevronDown
} from 'lucide-react';
import useCopilotStream from '../hooks/useCopilotStream';
import SessionSidebar from '../components/copilot/SessionSidebar';
import ChatMessage from '../components/copilot/ChatMessage';
import ChatInput from '../components/copilot/ChatInput';
import QuickActions from '../components/copilot/QuickActions';

// When VITE_BACKEND_URL is set, all copilot REST calls target the Render backend.
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || '';
const api = (path) => `${BACKEND_BASE}${path}`;

/** Animated thinking dots shown while streaming */
function ThinkingIndicator({ status, message, toolsUsed }) {
  const icons = { thinking: '🧠', gathering: '🔍', generating: '✨' };
  const icon = icons[status] || '⚡';
  return (
    <div className="flex items-start gap-3 mb-4 px-4 md:px-8">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm mt-0.5">
        <Loader2 size={14} className="text-white animate-spin" />
      </div>
      <div className="flex-1">
        <div className="inline-flex items-center gap-2 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-sm text-slate-700 font-medium">{message || 'Thinking…'}</p>
            {toolsUsed.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                {toolsUsed.slice(0, 4).join(' · ')}{toolsUsed.length > 4 ? ' …' : ''}
              </p>
            )}
          </div>
          {/* Animated dots */}
          <div className="flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Status badge for the current deployment */
function DeploymentBadge({ deployment }) {
  if (!deployment) return null;
  const s = (deployment.status || '').toLowerCase();
  const cfg = s.includes('live') || s.includes('success')
    ? { dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
    : s.includes('fail') || s.includes('error') || s.includes('cancel')
    ? { dot: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50 border-red-200' }
    : s.includes('build') || s.includes('deploy')
    ? { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
    : { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      #{deployment.id} · {deployment.status}
    </div>
  );
}

/** Project selector with search */
function ProjectSelector({ projects, selectedId, onChange }) {
  const selected = projects.find(p => p.id === selectedId);

  // Only show projects that have some data (status set or many entries)
  // Group by name with unique entries preferred
  const displayProjects = projects.filter(p => p.status || p.last_deployment_id)
    .concat(projects.filter(p => !p.status && !p.last_deployment_id).slice(0, 20));
  const unique = Array.from(new Map(displayProjects.map(p => [p.id, p])).values());

  return (
    <div className="relative">
      <select
        value={selectedId || ''}
        onChange={e => onChange(parseInt(e.target.value))}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 cursor-pointer transition-colors hover:border-gray-300"
      >
        {unique.length === 0 ? (
          <option value="">No projects</option>
        ) : (
          unique.map(p => (
            <option key={p.id} value={p.id}>
              #{p.id} · {p.name} ({p.framework})
            </option>
          ))
        )}
        {/* Also include all other projects in a group */}
        <optgroup label="All projects">
          {projects
            .filter(p => !unique.find(u => u.id === p.id))
            .map(p => (
              <option key={p.id} value={p.id}>
                #{p.id} · {p.name}
              </option>
            ))
          }
        </optgroup>
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

export default function CopilotPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [currentDeployment, setCurrentDeployment] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const {
    isStreaming, streamingContent, status: streamStatus,
    statusMessage, toolsUsed, error: streamError, sendMessage, cancel
  } = useCopilotStream();

  // ------ Data fetching ------

  useEffect(() => {
    setLoadingProjects(true);
    fetch(api('/api/projects'))
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.projects || data.data || []);
        setProjects(arr);
        // Auto-select first project that has a deployment
        const withDep = arr.find(p => p.status || p.last_deployment_id);
        if (withDep) setSelectedProjectId(withDep.id);
        else if (arr.length > 0) setSelectedProjectId(arr[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setCurrentDeployment(null);

    // Fetch latest deployment
    fetch(api(`/api/deployments?project_id=${selectedProjectId}&limit=1`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setCurrentDeployment(data[0]);
        else if (data?.deployments?.length > 0) setCurrentDeployment(data.deployments[0]);
      })
      .catch(() => {});

    // Fetch sessions
    fetch(api(`/api/copilot/projects/${selectedProjectId}/sessions`))
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setSessions(Array.isArray(data) ? data : []);
        setActiveSessionId(null);
        setMessages([]);
      })
      .catch(() => setSessions([]));
  }, [selectedProjectId]);

  const loadSessionMessages = useCallback((sessionId) => {
    setLoadingMessages(true);
    fetch(api(`/api/copilot/sessions/${sessionId}`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.messages) {
          setMessages(data.messages);
          setActiveSessionId(sessionId);
          setAutoScroll(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, []);

  const handleProjectChange = (id) => {
    setSelectedProjectId(id);
    setMessages([]);
    setActiveSessionId(null);
  };

  const createSession = async (titleHint = 'New Chat') => {
    if (!selectedProjectId) return null;
    const res = await fetch(api(`/api/copilot/projects/${selectedProjectId}/sessions`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleHint }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  };

  const handleNewChat = async () => {
    try {
      const session = await createSession('New Chat');
      if (session) {
        setSessions(prev => [session, ...prev]);
        setActiveSessionId(session.id);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = (sessionId) => {
    fetch(api(`/api/copilot/sessions/${sessionId}`), { method: 'DELETE' }).then(() => {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    });
  };

  // ------ Send flow ------

  const handleSend = async (content) => {
    if (!content.trim() || isStreaming) return;

    let sid = activeSessionId;
    if (!sid) {
      try {
        const session = await createSession(content.slice(0, 45));
        if (!session) return;
        setSessions(prev => [session, ...prev]);
        sid = session.id;
        setActiveSessionId(sid);
      } catch {
        return;
      }
    }

    // Optimistic: add user message
    const optimisticUser = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);
    setAutoScroll(true);

    // Update session title optimistically
    setSessions(prev => prev.map(s =>
      s.id === sid && s.title === 'New Chat'
        ? { ...s, title: content.slice(0, 45) }
        : s
    ));

    sendMessage(sid, content, (finalContent) => {
      // On complete: reload messages from server for accurate DB state
      loadSessionMessages(sid);
    });
  };

  // ------ Auto-scroll ------

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  };

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, streamStatus, autoScroll]);

  // ------ Render ------

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="ml-[240px] mt-11 h-[calc(100vh-44px)] bg-white flex overflow-hidden">

      {/* Left: Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={loadSessionMessages}
        onDeleteSession={handleDeleteSession}
        projectId={selectedProjectId}
      />

      {/* Right: Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top Header */}
        <div className="flex-shrink-0 h-14 border-b border-gray-100 bg-white flex items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <BrainCircuit size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">CloudForge Copilot</p>
              <p className="text-[10px] text-gray-400 leading-tight">Powered by Kimi K3</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {loadingProjects ? (
              <Loader2 size={14} className="text-gray-400 animate-spin" />
            ) : (
              <ProjectSelector
                projects={projects}
                selectedId={selectedProjectId}
                onChange={handleProjectChange}
              />
            )}
            <DeploymentBadge deployment={currentDeployment} />
          </div>
        </div>

        {/* Stream Status Bar */}
        {isStreaming && streamStatus !== 'generating' && (
          <div className="flex-shrink-0 bg-indigo-50 border-b border-indigo-100 px-5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-indigo-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              <span className="font-medium">{statusMessage}</span>
            </div>
            {toolsUsed.length > 0 && (
              <span className="text-[10px] text-indigo-400 font-mono hidden sm:block">
                {toolsUsed.slice(0, 3).join(' · ')}
              </span>
            )}
          </div>
        )}

        {/* Error Banner */}
        {streamError && (
          <div className="flex-shrink-0 bg-red-50 border-b border-red-100 px-5 py-2.5 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={15} />
            <span>{streamError}</span>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#E5E7EB transparent' }}
        >
          {!hasMessages ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center px-8 pb-16">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
                  <BrainCircuit size={36} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow">
                  <Sparkles size={12} className="text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How can I help you?</h2>
              <p className="text-gray-500 text-sm mb-8 text-center max-w-md leading-relaxed">
                Ask anything about your deployments — failures, logs, AWS state, pipeline stages, remediation attempts.
                {!selectedProjectId && <span className="text-amber-600 block mt-1">← Select a project first</span>}
              </p>
              {selectedProjectId && <QuickActions onAction={handleSend} />}
            </div>
          ) : (
            <div className="py-6 max-w-4xl mx-auto w-full">
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="text-indigo-400 animate-spin" size={24} />
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id || idx}
                    message={msg}
                    isStreaming={false}
                  />
                ))
              )}

              {/* Streaming states */}
              {isStreaming && streamStatus !== 'generating' && !streamingContent && (
                <ThinkingIndicator
                  status={streamStatus}
                  message={statusMessage}
                  toolsUsed={toolsUsed}
                />
              )}
              {isStreaming && streamingContent && (
                <ChatMessage
                  message={{
                    role: 'assistant',
                    content: streamingContent,
                    model: 'kimi-k3',
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming={true}
                />
              )}

              <div ref={messagesEndRef} className="h-6" />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {!autoScroll && hasMessages && (
          <button
            onClick={() => {
              setAutoScroll(true);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="absolute bottom-24 right-8 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors z-10"
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            onCancel={cancel}
          />
        </div>
      </div>
    </div>
  );
}
