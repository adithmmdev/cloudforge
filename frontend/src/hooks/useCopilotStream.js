import { useState, useRef, useCallback } from 'react';

// When VITE_BACKEND_URL is set (e.g. https://cloudforge-backend.onrender.com),
// Copilot calls go directly to the Render backend so Kimi K3 is reachable.
// Leave unset to use the local NGINX proxy (default local dev mode).
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || '';

export default function useCopilotStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [toolsUsed, setToolsUsed] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (sessionId, content, onComplete) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setStreamingContent('');
    setStatus('thinking');
    setStatusMessage('Analyzing question…');
    setError(null);
    setToolsUsed([]);

    let accumulatedContent = '';

    try {
      const response = await fetch(`${BACKEND_BASE}/api/copilot/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const block of parts) {
          let eventType = '';
          let dataStr = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }
          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            switch (eventType) {
              case 'copilot_thinking':
                setStatus('thinking');
                setStatusMessage(data.status || 'Thinking…');
                break;
              case 'copilot_context':
                setStatus('gathering');
                setToolsUsed(data.tools_called || []);
                setStatusMessage(data.summary || 'Evidence loaded');
                break;
              case 'copilot_generating':
                setStatus('generating');
                setStatusMessage('Generating response…');
                break;
              case 'copilot_token':
                accumulatedContent += data.token || '';
                setStreamingContent(accumulatedContent);
                break;
              case 'copilot_done':
                setStatus('done');
                setIsStreaming(false);
                if (onComplete) onComplete(accumulatedContent, data);
                break;
              case 'copilot_error':
                setError(data.message || 'Unknown error');
                setStatus('error');
                setIsStreaming(false);
                break;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Connection error');
        setStatus('error');
      }
      setIsStreaming(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsStreaming(false);
    setStatus('idle');
    setStreamingContent('');
  }, []);

  return { isStreaming, streamingContent, status, statusMessage, toolsUsed, error, sendMessage, cancel };
}
