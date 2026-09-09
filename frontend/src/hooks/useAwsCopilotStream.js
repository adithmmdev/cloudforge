import { useState, useCallback, useEffect } from 'react';

let globalStreamState = {
  isStreaming: false,
  streamingContent: '',
  statusMessage: '',
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

export default function useAwsCopilotStream() {
  const [state, setState] = useState(globalStreamState);

  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);

  const sendMessage = useCallback(async (sessionId, content, onComplete) => {
    if (globalAbortController) globalAbortController.abort();
    
    const controller = new AbortController();
    globalAbortController = controller;

    globalStreamState = {
      isStreaming: true,
      streamingContent: '',
      statusMessage: 'Connecting...',
      error: null,
      activeSessionId: sessionId,
    };
    notifyListeners();

    let accumulatedContent = '';

    try {
      const response = await fetch(`/api/aws-copilot/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

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
              case 'status':
                globalStreamState.statusMessage = data.message;
                break;
              case 'token':
                accumulatedContent += data.token || '';
                globalStreamState.streamingContent = accumulatedContent;
                globalStreamState.statusMessage = ''; // Clear status once streaming starts
                break;
              case 'done':
                globalStreamState.isStreaming = false;
                if (onComplete) onComplete(accumulatedContent, data);
                break;
              case 'error':
                globalStreamState.error = data.message;
                globalStreamState.isStreaming = false;
                break;
            }
            notifyListeners();
          } catch (e) {
            console.error('Parse error', e);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        globalStreamState.error = err.message || 'Connection error';
      }
      globalStreamState.isStreaming = false;
      notifyListeners();
    }
  }, []);

  const cancel = useCallback(() => {
    if (globalAbortController) globalAbortController.abort();
    globalStreamState.isStreaming = false;
    notifyListeners();
  }, []);

  return { ...state, sendMessage, cancel };
}
