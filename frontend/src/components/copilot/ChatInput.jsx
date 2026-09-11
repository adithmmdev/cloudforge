import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square } from 'lucide-react';

export default function ChatInput({ onSend, isStreaming, onCancel }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = 5 * 24; // ~5 lines
    ta.style.height = Math.min(ta.scrollHeight, max + 40) + 'px';
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    setValue('');
    onSend(trimmed);
  };

  const charCount = value.length;
  const overLimit = charCount > 3000;

  return (
    <div className="px-4 py-4 md:px-8 w-full max-w-4xl mx-auto">
      <div
        className="relative flex items-end gap-2 rounded-[24px] shadow-lg transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${overLimit ? '#f43f5e' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: overLimit ? '0 0 0 4px rgba(244,63,94,0.1)' : '0 4px 20px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
        }}
        onMouseEnter={e => { if(!overLimit) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
        onMouseLeave={e => { if(!overLimit) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your deployments, failures, logs, or infrastructure..."
          rows={1}
          maxLength={4000}
          disabled={isStreaming}
          className="flex-1 resize-none bg-transparent pl-5 pr-4 py-4 text-[15px] focus:outline-none disabled:opacity-60 min-h-[56px] max-h-[160px] leading-relaxed"
          style={{ scrollbarWidth: 'none', color: '#EDEDEF' }}
        />

        <div className="flex items-center gap-2 pr-3 pb-3 flex-shrink-0">
          {charCount > 3000 && (
            <span className="text-xs font-mono" style={{ color: overLimit ? '#f43f5e' : '#8A8F98' }}>
              {charCount}/4000
            </span>
          )}
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
              style={{ background: '#f43f5e', color: '#fff' }}
              title="Stop generation"
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || overLimit}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 group disabled:cursor-not-allowed"
              style={{
                background: !value.trim() || overLimit ? 'rgba(255,255,255,0.05)' : '#5E6AD2',
                color: !value.trim() || overLimit ? 'rgba(255,255,255,0.3)' : '#fff',
                boxShadow: !value.trim() || overLimit ? 'none' : '0 2px 10px rgba(94,106,210,0.3)'
              }}
              onMouseEnter={e => { if(value.trim() && !overLimit) e.currentTarget.style.background = '#6872D9' }}
              onMouseLeave={e => { if(value.trim() && !overLimit) e.currentTarget.style.background = '#5E6AD2' }}
              title="Send (Enter)"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 text-[11px] font-medium tracking-wide" style={{ color: '#8A8F98' }}>
        <span>CloudForge Copilot can make mistakes. Verify critical deployment decisions.</span>
      </div>
    </div>
  );
}
