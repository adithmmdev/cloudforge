import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useAwsCopilotStream from '../hooks/useAwsCopilotStream';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Wave } from '../components/loading-ui/wave.jsx';

export default function AwsCopilotPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  
  const { isStreaming, streamingContent, statusMessage, error, sendMessage } = useAwsCopilotStream();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) fetchMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, statusMessage]);

  useGSAP(() => {
    if (messages.length > 0) {
      gsap.fromTo('.msg-animate-in:last-child', 
        { opacity: 0, y: 15, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power3.out' }
      );
    }
  }, { scope: containerRef, dependencies: [messages] });

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/aws-copilot/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) setActiveSessionId(data[0].id);
      }
    } catch {}
  };

  const fetchMessages = async (sid) => {
    try {
      const res = await fetch(`/api/aws-copilot/sessions/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
  };

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/aws-copilot/sessions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSessions([data, ...sessions]);
        setActiveSessionId(data.id);
        setMessages([]);
      }
    } catch {}
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    
    let sid = activeSessionId;
    if (!sid) {
      handleNewSession().then(() => {
        // Simple fallback
        setTimeout(() => handleSend(e), 500);
      });
      return;
    }

    const newMsg = { role: 'user', content: inputText };
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    
    sendMessage(sid, inputText, () => {
      fetchMessages(sid);
    });
  };

  return (
    <div ref={containerRef} className="h-[calc(100vh-40px)] flex overflow-hidden w-full" style={{ background: '#050506' }}>
      
      {/* SIDEBAR */}
      <div className="w-[260px] flex-shrink-0 flex flex-col border-r border-white/5" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)', boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.1), 8px 0 32px rgba(0,0,0,0.5)' }}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="font-semibold text-sm" style={{ color: '#EDEDEF' }}>AWS Copilot</div>
          <button 
            onClick={handleNewSession}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-white/10"
            style={{ color: '#f97316' }}
            title="New Session"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors ${
                activeSessionId === s.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {s.title || `Session ${s.id}`}
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="text-xs text-center p-4 text-gray-500">No sessions yet</div>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative items-center w-full">
        
        <div className="flex-1 overflow-y-auto w-full max-w-4xl px-4 py-8 pb-32 flex flex-col gap-6"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          
          {messages.length === 0 && !isStreaming && (
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                <span style={{ fontSize: '24px' }}>~</span>
              </div>
              <h2 className="text-xl font-medium mb-2" style={{ color: '#EDEDEF' }}>AWS Copilot</h2>
              <p className="text-sm text-center max-w-md" style={{ color: '#8A8F98' }}>
                I can help you manage your AWS infrastructure, analyze costs, list EC2 instances, and understand your cloud footprint.
              </p>
              
              <div className="mt-10 flex flex-wrap gap-2 justify-center max-w-lg">
                <button 
                  onClick={() => { setInputText("List all running EC2 instances"); }}
                  className="px-4 py-2 text-xs rounded-full transition-colors cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >List all running EC2 instances</button>
                <button 
                  onClick={() => { setInputText("Check month-to-date cost"); }}
                  className="px-4 py-2 text-xs rounded-full transition-colors cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#EDEDEF', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >Check month-to-date cost</button>
              </div>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex msg-animate-in ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl rounded-[20px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] ${m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                style={{ 
                  background: m.role === 'user' ? 'linear-gradient(to bottom, #f97316, #ea580c)' : 'rgba(255,255,255,0.03)', 
                  color: m.role === 'user' ? '#fff' : '#EDEDEF',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: m.role === 'user' ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(249,115,22,0.3)' : '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                {m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg text-xs font-mono" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="mb-2 font-bold uppercase tracking-wider" style={{ color: '#8A8F98' }}>User-Safe Decision Trace</div>
                    {m.tool_calls.map((t, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div style={{ color: '#818cf8' }}>► Tool: {t.tool}</div>
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
               <div className="max-w-3xl rounded-3xl rounded-tl-sm p-5 w-full flex items-center gap-3"
                 style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {!streamingContent && (
                    <div className="flex items-center gap-3">
                      <Wave className="h-6 w-12" />
                      <span className="text-sm font-medium" style={{ color: '#8A8F98' }}>{statusMessage || 'Analyzing...'}</span>
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
