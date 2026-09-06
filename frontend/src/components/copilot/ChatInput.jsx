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
      <div className={`relative flex items-end gap-2 bg-white rounded-[24px] shadow-sm transition-all duration-300 border ${
        overLimit ? 'border-red-300 ring-4 ring-red-50' : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50/50 hover:border-gray-300 hover:shadow-md'
      }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your deployments, failures, logs, or infrastructure..."
          rows={1}
          maxLength={4000}
          disabled={isStreaming}
          className="flex-1 resize-none bg-transparent pl-5 pr-4 py-4 text-[15px] text-slate-800 placeholder-gray-400 focus:outline-none disabled:opacity-60 min-h-[56px] max-h-[160px] leading-relaxed"
          style={{ scrollbarWidth: 'none' }}
        />

        <div className="flex items-center gap-2 pr-3 pb-3 flex-shrink-0">
          {charCount > 3000 && (
            <span className={`text-xs font-mono ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {charCount}/4000
            </span>
          )}
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-900 flex items-center justify-center transition-all duration-200 shadow shadow-slate-900/10 active:scale-95"
              title="Stop generation"
            >
              <Square size={14} className="text-white fill-white" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || overLimit}
              className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 shadow shadow-indigo-600/20 active:scale-95 group"
              title="Send (Enter)"
            >
              <ArrowUp size={18} className={`transition-colors ${value.trim() && !overLimit ? 'text-white' : 'text-gray-300'}`} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-gray-400 font-medium tracking-wide">
        <span>CloudForge Copilot can make mistakes. Verify critical deployment decisions.</span>
      </div>
    </div>
  );
}
