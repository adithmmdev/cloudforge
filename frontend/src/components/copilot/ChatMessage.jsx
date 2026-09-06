import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Database, Sparkles, Terminal } from 'lucide-react';

/** Lightweight markdown + JSX renderer */
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeContent = codeLines.join('\n');
      elements.push(
        <div key={key++} className="my-4 rounded-xl overflow-hidden bg-[#0d1117] border border-gray-800 shadow-sm group">
          <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-800">
            <span className="text-[11px] text-gray-400 font-mono uppercase tracking-wider">{lang || 'TEXT'}</span>
            <CopyButton text={codeContent} />
          </div>
          <div className="p-4 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#30363d transparent' }}>
            <code className="block text-[13px] text-gray-300 font-mono whitespace-pre leading-relaxed">
              {codeContent}
            </code>
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-[15px] font-semibold text-slate-900 mt-5 mb-2">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-bold text-slate-900 mt-6 mb-3">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-lg font-bold text-slate-900 mt-6 mb-4">{renderInline(line.slice(2))}</h1>);
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key++} className="border-l-2 border-indigo-400 bg-indigo-50/50 px-4 py-3 my-4 rounded-r-xl text-[14px] text-indigo-900 leading-relaxed italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    }
    // Bullet list
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(<li key={i} className="mb-1.5 leading-relaxed">{renderInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={key++} className="list-disc list-outside ml-5 space-y-1 my-3 text-[15px] text-slate-700">{listItems}</ul>);
      continue;
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(<li key={i} className="mb-1.5 leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={key++} className="list-decimal list-outside ml-5 space-y-1 my-3 text-[15px] text-slate-700">{listItems}</ol>);
      continue;
    }
    // Horizontal rule
    else if (line === '---' || line === '***') {
      elements.push(<hr key={key++} className="my-6 border-gray-100" />);
    }
    // Blank line + spacing
    else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-3" />);
    }
    // Paragraph
    else {
      elements.push(<p key={key++} className="text-[15px] text-slate-700 leading-relaxed mb-1">{renderInline(line)}</p>);
    }
    i++;
  }
  return elements;
}

function renderInline(text) {
  const parts = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={key++} className="font-bold italic text-slate-900">{match[2]}</strong>);
    else if (match[3]) parts.push(<strong key={key++} className="font-semibold text-slate-900">{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={key++} className="italic text-slate-600">{match[4]}</em>);
    else if (match[5]) parts.push(
      <code key={key++} className="bg-slate-100/80 border border-slate-200/60 text-slate-800 px-1.5 py-0.5 rounded-[6px] text-[13px] font-mono mx-0.5">
        {match[5]}
      </code>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-md hover:bg-gray-700/50">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ChatMessage({ message, isStreaming = false }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const isUser = message.role === 'user';
  const content = message.content || '';
  const tools = message.evidence_refs?.tools || [];
  const hasEvidence = tools.length > 0;

  if (isUser) {
    return (
      <div className="flex justify-end mb-8 px-4 md:px-8">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-slate-100 text-slate-800 px-5 py-3.5 rounded-3xl rounded-tr-sm text-[15px] leading-relaxed shadow-sm hover:shadow transition-shadow">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-4 mb-10 px-4 md:px-8 group">
      {/* Premium Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-[14px] bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-md mt-1 ring-1 ring-indigo-500/20">
        <Sparkles size={16} className="text-white fill-white/20" />
      </div>

      <div className="flex-1 min-w-0 max-w-[850px]">
        {/* Name Header */}
        <div className="flex items-center gap-2 mb-1.5 ml-1">
          <span className="font-semibold text-slate-800 text-[14px]">Niggex</span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
            AI
          </span>
          {message.created_at && (
            <span className="text-[11px] text-gray-400 font-medium ml-1">{timeAgo(message.created_at)}</span>
          )}
        </div>

        {/* Evidence Block (Premium style) */}
        {hasEvidence && (
          <div className="mb-4 ml-1">
            <button
              onClick={() => setEvidenceOpen(!evidenceOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Database size={12} className="text-indigo-500" />
              Analyzed {tools.length} evidence source{tools.length !== 1 ? 's' : ''}
              {evidenceOpen ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
            </button>
            
            {evidenceOpen && (
              <div className="mt-2 pl-3 border-l-2 border-indigo-100 space-y-2 py-1 animate-in fade-in slide-in-from-top-2 duration-300">
                {tools.map((tool, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Terminal size={12} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-mono text-slate-700">{tool.name}</p>
                      {tool.args && Object.keys(tool.args).length > 0 && (
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5 truncate max-w-md">
                          {JSON.stringify(tool.args)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content - Document style */}
        <div className="text-slate-800 ml-1">
          {content ? renderMarkdown(content) : null}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-1 rounded-sm align-middle animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
