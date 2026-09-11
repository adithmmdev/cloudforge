import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Database, Sparkles, Terminal } from 'lucide-react';

/** Lightweight markdown + JSX renderer for Dark Theme */
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
        <div key={key++} className="my-4 rounded-xl overflow-hidden group" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8A8F98' }}>{lang || 'TEXT'}</span>
            <CopyButton text={codeContent} />
          </div>
          <div className="p-4 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            <code className="block text-[13px] font-mono whitespace-pre leading-relaxed" style={{ color: '#EDEDEF' }}>
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
      elements.push(<h3 key={key++} className="text-[15px] font-semibold mt-5 mb-2" style={{ color: '#EDEDEF' }}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-bold mt-6 mb-3" style={{ color: '#EDEDEF' }}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-lg font-bold mt-6 mb-4" style={{ color: '#EDEDEF' }}>{renderInline(line.slice(2))}</h1>);
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key++} className="border-l-2 px-4 py-3 my-4 rounded-r-xl text-[14px] leading-relaxed italic"
          style={{ borderColor: '#6872D9', background: 'rgba(94,106,210,0.1)', color: '#818cf8' }}>
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
      elements.push(<ul key={key++} className="list-disc list-outside ml-5 space-y-1 my-3 text-[14px]" style={{ color: '#8A8F98' }}>{listItems}</ul>);
      continue;
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(<li key={i} className="mb-1.5 leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={key++} className="list-decimal list-outside ml-5 space-y-1 my-3 text-[14px]" style={{ color: '#8A8F98' }}>{listItems}</ol>);
      continue;
    }
    // Horizontal rule
    else if (line === '---' || line === '***') {
      elements.push(<hr key={key++} className="my-6" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />);
    }
    // Blank line + spacing
    else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-3" />);
    }
    // Paragraph
    else {
      elements.push(<p key={key++} className="text-[14px] leading-relaxed mb-1" style={{ color: '#8A8F98' }}>{renderInline(line)}</p>);
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
    if (match[2]) parts.push(<strong key={key++} className="font-bold italic" style={{ color: '#EDEDEF' }}>{match[2]}</strong>);
    else if (match[3]) parts.push(<strong key={key++} className="font-semibold" style={{ color: '#EDEDEF' }}>{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={key++} className="italic" style={{ color: '#8A8F98' }}>{match[4]}</em>);
    else if (match[5]) parts.push(
      <code key={key++} className="px-1.5 py-0.5 rounded text-[12px] font-mono mx-0.5"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}>
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
    <button onClick={handleCopy} className="p-1 rounded-md transition-colors"
      style={{ color: copied ? '#4ade80' : '#8A8F98' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
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
          <div className="px-5 py-3.5 rounded-3xl rounded-tr-sm text-[14px] leading-relaxed shadow-sm"
            style={{ background: '#5E6AD2', color: '#ffffff' }}>
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
      <div className="flex-shrink-0 w-9 h-9 rounded-[14px] flex items-center justify-center shadow-md mt-1"
        style={{ background: 'linear-gradient(135deg, #5E6AD2 0%, #a78bfa 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Sparkles size={16} className="text-white fill-white/20" />
      </div>

      <div className="flex-1 min-w-0 max-w-[850px]">
        {/* Name Header */}
        <div className="flex items-center gap-2 mb-1.5 ml-1">
          <span className="font-semibold text-[14px]" style={{ color: '#EDEDEF' }}>Niggex</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border"
            style={{ color: '#818cf8', background: 'rgba(94,106,210,0.15)', borderColor: 'rgba(94,106,210,0.3)' }}>
            AI
          </span>
          {message.created_at && (
            <span className="text-[11px] font-medium ml-1" style={{ color: '#8A8F98' }}>{timeAgo(message.created_at)}</span>
          )}
        </div>

        {/* Evidence Block (Premium dark style) */}
        {hasEvidence && (
          <div className="mb-4 ml-1">
            <button
              onClick={() => setEvidenceOpen(!evidenceOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors shadow-sm focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#8A8F98' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <Database size={12} style={{ color: '#6872D9' }} />
              Analyzed {tools.length} evidence source{tools.length !== 1 ? 's' : ''}
              {evidenceOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            
            {evidenceOpen && (
              <div className="mt-2 pl-3 space-y-2 py-1" style={{ borderLeft: '2px solid rgba(94,106,210,0.3)' }}>
                {tools.map((tool, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Terminal size={12} className="mt-0.5" style={{ color: '#8A8F98' }} />
                    <div>
                      <p className="text-[12px] font-mono" style={{ color: '#EDEDEF' }}>{tool.name}</p>
                      {tool.args && Object.keys(tool.args).length > 0 && (
                        <p className="text-[11px] font-mono mt-0.5 truncate max-w-md" style={{ color: '#8A8F98' }}>
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

        {/* Content */}
        <div className="ml-1 text-sm">
          {content ? renderMarkdown(content) : null}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 rounded-sm align-middle animate-pulse" style={{ background: '#6872D9' }} />
          )}
        </div>
      </div>
    </div>
  );
}
