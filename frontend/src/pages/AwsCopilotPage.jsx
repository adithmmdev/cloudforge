import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useAwsCopilotStream from '../hooks/useAwsCopilotStream';

export default function AwsCopilotPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  
  const { isStreaming, streamingContent, statusMessage, error, sendMessage } = useAwsCopilotStream();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) fetchMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, statusMessage]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/aws-copilot/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (sid) => {
    try {
      const res = await fetch(`/api/aws-copilot/sessions/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createSession = async () => {
    try {
      const res = await fetch('/api/aws-copilot/sessions', { method: 'POST' });
      if (res.ok) {
        const newSession = await res.json();
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    
    let sid = activeSessionId;
    if (!sid) {
       const res = await fetch('/api/aws-copilot/sessions', { method: 'POST' });
       if (res.ok) {
         const newSession = await res.json();
         setSessions([newSession, ...sessions]);
         setActiveSessionId(newSession.id);
         sid = newSession.id;
       }
    }
    
    const userText = inputText;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: userText, id: Date.now() }]);
    
    sendMessage(sid, userText, () => {
      fetchMessages(sid);
      fetchSessions();
    });
  };

  return (
    <div className="flex h-[calc(100vh-40px)] w-full overflow-hidden" style={{ background: '#050506' }}>
      <div className="w-64 flex-shrink-0 flex flex-col transition-all h-full" style={{ background: '#020203', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button 
            onClick={createSession}
            className="w-full py-2.5 rounded-xl font-medium text-sm transition-all outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDEF' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            + New AWS Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4" style={{ scrollbarWidth: 'none' }}>
          {sessions.length === 0 ? (
            <div className="text-center py-10 opacity-70">
              <p className="text-xs font-medium" style={{ color: '#8A8F98' }}>No history</p>
            </div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left p-2.5 rounded-lg mb-1 truncate text-sm transition-all`}
                style={{
                  background: activeSessionId === s.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: activeSessionId === s.id ? '#EDEDEF' : '#8A8F98',
                  border: `1px solid ${activeSessionId === s.id ? 'rgba(255,255,255,0.1)' : 'transparent'}`
                }}
                onMouseEnter={e => {
                  if (activeSessionId !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#EDEDEF';
                }}
                onMouseLeave={e => {
                  if (activeSessionId !== s.id) e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = activeSessionId === s.id ? '#EDEDEF' : '#8A8F98';
                }}
              >
                {s.title}
              </button>
            ))
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col relative h-full">
        <div className="flex-shrink-0 h-[60px] flex items-center justify-between px-6 z-10 w-full backdrop-blur-md"
          style={{ background: 'rgba(5,5,6,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h1 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: '#EDEDEF' }}>
            <span className="text-orange-500">☁️</span> AWS Copilot
          </h1>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
            style={{ color: '#4ade80', background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }}>
            Read-Only Safety
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 space-y-8" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {messages.length === 0 && !isStreaming && (
            <div className="h-full flex items-center justify-center flex-col mt-20">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-[28px] flex items-center justify-center shadow-2xl"
                  style={{ background: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="text-3xl text-white">☁️</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-4 tracking-tight" style={{ color: '#EDEDEF' }}>How can I help you with AWS today?</h2>
              <div className="mt-6 flex flex-col md:flex-row gap-3 text-sm">
                <button onClick={() => setInputText("List my running EC2 instances")} 
                  className="px-4 py-2.5 rounded-lg transition-all shadow-sm font-medium outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >List running EC2 instances</button>
                <button onClick={() => setInputText("What is my AWS cost for this month?")} 
                  className="px-4 py-2.5 rounded-lg transition-all shadow-sm font-medium outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >Check month-to-date cost</button>
              </div>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl rounded-3xl p-5 ${m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                style={{ 
                  background: m.role === 'user' ? '#f97316' : 'rgba(0,0,0,0.4)', 
                  color: m.role === 'user' ? '#fff' : '#EDEDEF',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)'
                }}>
                {m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg text-xs font-mono" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="mb-2 font-bold uppercase tracking-wider" style={{ color: '#8A8F98' }}>User-Safe Decision Trace</div>
                    {m.tool_calls.map((t, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div style={{ color: '#818cf8' }}>⚡ Tool: {t.tool}</div>
                        <div className="truncate" style={{ color: '#8A8F98' }}>Result: {JSON.stringify(t.result).substring(0, 100)}...</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: m.role === 'user' ? '#fff' : '#EDEDEF' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          
          {isStreaming && (
             <div className="flex justify-start">
               <div className="max-w-3xl rounded-3xl rounded-tl-sm p-5 w-full"
                 style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {statusMessage && (
                    <div className="text-sm animate-pulse flex items-center mb-3 font-medium" style={{ color: '#f59e0b' }}>
                      <span className="mr-2">⚡</span> {statusMessage}
                    </div>
                  )}
                  {streamingContent && (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: '#EDEDEF' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                  )}
               </div>
             </div>
          )}
          
          {error && (
            <div className="p-4 rounded-lg text-sm font-medium" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}>
              Error: {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 pt-10 pb-6 px-6 pointer-events-none flex justify-center w-full"
          style={{ background: 'linear-gradient(to top, #050506 50%, transparent 100%)' }}>
          <form onSubmit={handleSend} className="pointer-events-auto flex w-full max-w-4xl relative items-end gap-2 rounded-[24px] shadow-lg transition-all duration-300"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={isStreaming}
              placeholder="Ask AWS Copilot..."
              className="flex-1 bg-transparent pl-5 pr-4 py-4 text-[15px] focus:outline-none disabled:opacity-60 min-h-[56px]"
              style={{ color: '#EDEDEF' }}
            />
            <div className="flex items-center pr-3 pb-3">
              <button 
                type="submit" 
                disabled={isStreaming || !inputText.trim()}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 group disabled:cursor-not-allowed"
                style={{
                  background: !inputText.trim() ? 'rgba(255,255,255,0.05)' : '#f97316',
                  color: !inputText.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
                }}
              >
                <span className="font-bold text-lg mb-0.5" style={{ transform: 'rotate(-45deg)' }}>➔</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
