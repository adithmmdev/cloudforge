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
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <button 
            onClick={createSession}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-medium"
          >
            + New AWS Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`w-full text-left p-2 rounded mb-1 truncate ${activeSessionId === s.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-750'}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center">
            <span className="text-orange-500 mr-2">??</span> AWS Copilot
          </h1>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">Read-Only Safety</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="h-full flex items-center justify-center text-gray-500 flex-col">
              <span className="text-4xl mb-4">??</span>
              <p className="text-lg">How can I help you with AWS today?</p>
              <div className="mt-8 flex gap-4 text-sm">
                <button onClick={() => setInputText("List my running EC2 instances")} className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700">List running EC2 instances</button>
                <button onClick={() => setInputText("What is my AWS cost for this month?")} className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700">Check month-to-date cost</button>
              </div>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl rounded-lg p-4 ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-800 border border-gray-700'}`}>
                {m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="mb-3 p-3 bg-gray-900 rounded text-xs border border-gray-700 font-mono">
                    <div className="text-gray-400 mb-1 font-semibold uppercase tracking-wider">User-Safe Decision Trace</div>
                    {m.tool_calls.map((t, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div className="text-indigo-400">? Tool: {t.tool}</div>
                        <div className="text-gray-500 truncate">Result: {JSON.stringify(t.result).substring(0, 100)}...</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          
          {isStreaming && (
             <div className="flex justify-start">
               <div className="max-w-3xl bg-gray-800 border border-gray-700 rounded-lg p-4 w-full">
                  {statusMessage && (
                    <div className="text-indigo-400 text-sm animate-pulse flex items-center mb-2">
                      <span className="mr-2">?</span> {statusMessage}
                    </div>
                  )}
                  {streamingContent && (
                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                  )}
               </div>
             </div>
          )}
          
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-100 p-3 rounded">
              Error: {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={isStreaming}
              placeholder="Ask AWS Copilot..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={isStreaming || !inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-6 py-3 rounded font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
