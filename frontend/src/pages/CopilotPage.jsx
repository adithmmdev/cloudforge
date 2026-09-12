import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BrainCircuit, AlertTriangle, Loader2, Sparkles, ChevronDown, CheckCircle2, Terminal
} from 'lucide-react';
import useCopilotStream from '../hooks/useCopilotStream';
import SessionSidebar from '../components/copilot/SessionSidebar';
import ChatMessage from '../components/copilot/ChatMessage';
import ChatInput from '../components/copilot/ChatInput';
import QuickActions from '../components/copilot/QuickActions';
import NebulaIntro from '../components/copilot/NebulaIntro';

function ThinkingIndicator({ status, message, toolsUsed }) {
  const steps = [
    { key: 'analyzing', label: 'Analyzing request...' },
    { key: 'gathering', label: 'Inspecting telemetry & logs...' },
    { key: 'generating', label: 'Generating insights...' }
  ];

  let activeIndex = 0;
  if (status === 'gathering') activeIndex = 1;
  if (status === 'generating') activeIndex = 2;

  return (
    <div className="flex items-start gap-4 mb-8 px-4 md:px-8 max-w-4xl mx-auto w-full">
      <div className="flex-shrink-0 w-9 h-9 rounded-[14px] flex items-center justify-center shadow-sm mt-1"
        style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.3)' }}>
        <Loader2 size={16} className="animate-spin" style={{ color: '#818cf8' }} />
      </div>
      <div className="flex-1 mt-1">
        <div className="flex flex-col gap-2">
          {steps.map((step, idx) => {
            const isPast = idx < activeIndex;
            const isActive = idx === activeIndex;
            const isFuture = idx > activeIndex;

            if (isFuture) return null;

            return (
              <div key={step.key} className={`flex items-center gap-2 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-60 -translate-y-1'}`}>
                {isPast ? (
                  <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
                ) : (
                  <span className="relative flex h-2 w-2 ml-1 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#818cf8' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#5E6AD2' }} />
                  </span>
                )}
                <span className={`text-[13px] font-medium transition-colors`} style={{ color: isActive ? '#818cf8' : '#8A8F98' }}>
                  {isActive && message ? message : step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeploymentBadge({ deployment }) {
  if (!deployment) return null;
  const s = (deployment.status || '').toLowerCase();
  
  let cfg = { dot: '#94a3b8', text: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', pulse: false };
  if (s.includes('live') || s.includes('success')) {
    cfg = { dot: '#22c55e', text: '#4ade80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', pulse: false };
  } else if (s.includes('fail') || s.includes('error') || s.includes('cancel')) {
    cfg = { dot: '#ef4444', text: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', pulse: false };
  } else if (s.includes('build') || s.includes('deploy')) {
    cfg = { dot: '#f59e0b', text: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', pulse: true };
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.pulse ? 'animate-pulse' : ''}`} style={{ background: cfg.dot }} />
      #{deployment.id} {deployment.status}
    </div>
  );
}

function ProjectSelector({ projects, selectedId, onChange }) {
  const selected = projects.find(p => p.id === selectedId);
  const displayProjects = projects;
  const unique = Array.from(new Map(displayProjects.map(p => [p.id, p])).values());

  return (
    <div className="relative group">
      <select
        value={selectedId || ''}
        onChange={e => onChange(parseInt(e.target.value))}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium rounded-lg cursor-pointer transition-all outline-none focus:ring-2 focus:ring-indigo-500/50"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {unique.length === 0 ? (
          <option value="" style={{ background: '#0a0a0c', color: '#EDEDEF' }}>No projects</option>
        ) : (
          unique.map(p => (
            <option key={p.id} value={p.id} style={{ background: '#0a0a0c', color: '#EDEDEF' }}>
              #{p.id} — {p.name} {p.framework ? `(${p.framework})` : ''}
            </option>
          ))
        )}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: '#8A8F98' }} />
    </div>
  );
}

export default function CopilotPage() {
  const [introShown, setIntroShown] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    parseInt(localStorage.getItem('copilot_project_id')) || null
  );
  const [currentDeployment, setCurrentDeployment] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(
    localStorage.getItem('copilot_session_id') || null
  );
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const {
    isStreaming, streamingContent, status: streamStatus,
    statusMessage, toolsUsed, error: streamError, sendMessage, cancel, activeSessionId: streamSessionId
  } = useCopilotStream();

  useEffect(() => {
    setLoadingProjects(true);
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.projects || data.data || []);
        setProjects(arr);
        
        // Only auto-select if we don't have one in localStorage
        if (!selectedProjectId) {
          const withDep = arr.find(p => p.status || p.last_deployment_id);
          if (withDep) {
            setSelectedProjectId(withDep.id);
            localStorage.setItem('copilot_project_id', withDep.id);
          } else if (arr.length > 0) {
            setSelectedProjectId(arr[0].id);
            localStorage.setItem('copilot_project_id', arr[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []); // Only on mount

  useEffect(() => {
    if (!selectedProjectId) return;
    setCurrentDeployment(null);
    fetch(`/api/deployments?project_id=${selectedProjectId}&limit=1`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setCurrentDeployment(data[0]);
        else if (data?.deployments?.length > 0) setCurrentDeployment(data.deployments[0]);
      })
      .catch(() => {});

    fetch(`/api/copilot/projects/${selectedProjectId}/sessions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const sess = Array.isArray(data) ? data : [];
        setSessions(sess);
        
        // Re-load messages if we have an activeSessionId stored
        if (activeSessionId) {
          // Verify it belongs to this project
          const exists = sess.find(s => s.id === activeSessionId);
          if (exists) {
            loadSessionMessages(activeSessionId);
          } else {
            setActiveSessionId(null);
            localStorage.removeItem('copilot_session_id');
            setMessages([]);
          }
        }
      })
      .catch(() => setSessions([]));
  }, [selectedProjectId]);

  const loadSessionMessages = useCallback((sessionId) => {
    setLoadingMessages(true);
    fetch(`/api/copilot/sessions/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.messages) {
          setMessages(data.messages);
          setActiveSessionId(sessionId);
          localStorage.setItem('copilot_session_id', sessionId);
          setAutoScroll(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, []);

  const handleProjectChange = (id) => {
    setSelectedProjectId(id);
    localStorage.setItem('copilot_project_id', id);
    setMessages([]);
    setActiveSessionId(null);
    localStorage.removeItem('copilot_session_id');
  };

  const createSession = async (titleHint = 'New Chat') => {
    if (!selectedProjectId) return null;
    const res = await fetch(`/api/copilot/projects/${selectedProjectId}/sessions`, {
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
        localStorage.setItem('copilot_session_id', session.id);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = (sessionId) => {
    fetch(`/api/copilot/sessions/${sessionId}`, { method: 'DELETE' }).then(() => {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        localStorage.removeItem('copilot_session_id');
        setMessages([]);
      }
    });
  };

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
        localStorage.setItem('copilot_session_id', sid);
      } catch {
        return;
      }
    }

    const optimisticUser = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);
    setAutoScroll(true);

    setSessions(prev => prev.map(s =>
      s.id === sid && s.title === 'New Chat'
        ? { ...s, title: content.slice(0, 45) }
        : s
    ));

    sendMessage(sid, content, () => {
      loadSessionMessages(sid);
    });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAutoScroll(atBottom);
  };

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, streamStatus, autoScroll]);

  const hasMessages = messages.length > 0 || (isStreaming && streamSessionId === activeSessionId);

  if (!introShown) {
    return <NebulaIntro onComplete={() => setIntroShown(true)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="h-[calc(100vh-40px)] flex overflow-hidden w-full"
      style={{ background: '#050506' }}
    >
      
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={loadSessionMessages}
        onDeleteSession={handleDeleteSession}
        projectId={selectedProjectId}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative items-center w-full" style={{ background: '#050506' }}>
        <div className="flex-shrink-0 h-[60px] flex items-center justify-center px-6 z-10 w-full"
          style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)', borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between w-full max-w-5xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #5E6AD2 0%, #a78bfa 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold leading-none" style={{ color: '#EDEDEF' }}>Nebula AI</p>
                </div>
              </div>
            </div>

          <div className="flex items-center gap-4">
            {loadingProjects ? (
              <Loader2 size={16} className="text-gray-400 animate-spin" />
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
        </div>

        {streamError && streamSessionId === activeSessionId && (
          <div className="flex-shrink-0 bg-red-50 border-b border-red-100 px-6 py-3 flex items-center justify-center gap-2 text-sm text-red-700 shadow-sm z-10 w-full">
            <AlertTriangle size={16} />
            <span className="font-medium">{streamError}</span>
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto w-full flex flex-col items-center"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          <div className="w-full max-w-4xl px-4 flex flex-col h-full">
            {!hasMessages ? (
              <div className="flex-1 flex flex-col items-center justify-center pb-20 mt-20">
                <div className="relative mb-8 animate-in fade-in zoom-in duration-500 delay-150 fill-mode-both">
                  <div className="w-24 h-24 rounded-[32px] flex items-center justify-center shadow-2xl"
                    style={{ background: 'linear-gradient(135deg, #5E6AD2 0%, #a78bfa 100%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(94,106,210,0.3)' }}>
                    <Sparkles size={40} className="text-white fill-white/20" />
                  </div>
                </div>
                <h2 className="text-[28px] font-bold mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both" style={{ color: '#EDEDEF' }}>How can I help you?</h2>
                <div className="text-[15px] text-center max-w-lg leading-relaxed flex flex-col gap-1 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both" style={{ color: '#8A8F98' }}>
                  <p>Understand your deployments. Diagnose failures.</p>
                  <p>Explore your infrastructure.</p>
                  {!selectedProjectId && <span className="font-medium mt-2 px-3 py-1 rounded-full w-max mx-auto" style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.15)' }}>Please select a project first</span>}
                </div>
                <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 delay-700 fill-mode-both">
                  {selectedProjectId && <QuickActions onAction={handleSend} />}
                </div>
              </div>
            ) : (
              <div className="py-8 w-full pb-32 flex-1">
                {loadingMessages ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="text-indigo-400 animate-spin" size={28} />
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={msg.id || idx} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <ChatMessage
                        message={msg}
                        isStreaming={false}
                      />
                    </div>
                  ))
                )}

                {isStreaming && streamSessionId === activeSessionId && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {streamStatus !== 'generating' && !streamingContent ? (
                      <ThinkingIndicator
                        status={streamStatus}
                        message={statusMessage}
                        toolsUsed={toolsUsed}
                      />
                    ) : (
                      <ChatMessage
                        message={{ role: 'assistant', content: streamingContent, evidence_refs: { tools: toolsUsed } }}
                        isStreaming={true}
                      />
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 pt-10 pb-6 px-4 pointer-events-none flex justify-center w-full"
          style={{ background: 'linear-gradient(to top, #050506 50%, transparent 100%)' }}>
          <div className="pointer-events-auto w-full max-w-4xl">
            <ChatInput 
              onSend={handleSend} 
              isStreaming={isStreaming && streamSessionId === activeSessionId} 
              onCancel={cancel} 
            />
          </div>
        </div>

      </div>
    </motion.div>
  );
}
