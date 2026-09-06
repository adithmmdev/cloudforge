import { useState, useRef, useCallback, useEffect } from 'react';

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || '';

// --- GLOBAL STATE FOR PERSISTENT STREAMING ---
let globalStreamState = {
  isStreaming: false,
  streamingContent: '',
  status: 'idle',
  statusMessage: '',
  toolsUsed: [],
  error: null,
  activeSessionId: null,
};

let globalAbortController = null;
const listeners = new Set();

function notifyListeners() {
  for (const listener of listeners) {
    listener({ ...globalStreamState });
  }
}

export default function useCopilotStream() {
  const [state, setState] = useState(globalStreamState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const sendMessage = useCallback(async (sessionId, content, onComplete) => {
    if (globalAbortController) {
      globalAbortController.abort();
    }
    const controller = new AbortController();
    globalAbortController = controller;

    globalStreamState = {
      isStreaming: true,
      streamingContent: '',
      status: 'thinking',
      statusMessage: 'Analyzing question...',
      toolsUsed: [],
      error: null,
      activeSessionId: sessionId,
    };
    notifyListeners();

    let accumulatedContent = '';

    try {
      const response = await fetch(`/api/copilot/sessions/${sessionId}/messages`, {
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
                globalStreamState.status = 'thinking';
                globalStreamState.statusMessage = data.status || 'Thinking...';
                break;
              case 'copilot_context':
                globalStreamState.status = 'gathering';
                globalStreamState.toolsUsed = data.tools_called || [];
                globalStreamState.statusMessage = data.summary || 'Evidence loaded';
                break;
              case 'copilot_generating':
                globalStreamState.status = 'generating';
                globalStreamState.statusMessage = 'Generating response...';
                break;
              case 'copilot_token':
                accumulatedContent += data.token || '';
                globalStreamState.streamingContent = accumulatedContent;
                break;
              case 'copilot_done':
                globalStreamState.status = 'done';
                globalStreamState.isStreaming = false;
                if (onComplete) onComplete(accumulatedContent, data);
                break;
              case 'copilot_error':
                globalStreamState.error = data.message || 'Unknown error';
                globalStreamState.status = 'error';
                globalStreamState.isStreaming = false;
                break;
            }
            notifyListeners();
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        globalStreamState.error = err.message || 'Connection error';
        globalStreamState.status = 'error';
      }
      globalStreamState.isStreaming = false;
      notifyListeners();
    }
  }, []);

  const cancel = useCallback(() => {
    if (globalAbortController) globalAbortController.abort();
    globalStreamState.isStreaming = false;
    globalStreamState.status = 'idle';
    globalStreamState.streamingContent = '';
    notifyListeners();
  }, []);

  return { ...state, sendMessage, cancel };
}
