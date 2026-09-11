import React, { useState, useEffect } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';

export default function DeploymentReportTab({ deploymentId, deploymentStatus }) {
  // ── Unchanged data fetching logic ─────────────────────────
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!deploymentId) return;
    if (['pending', 'building', 'deploying', 'verifying', 'health_check', 'healing'].includes(deploymentStatus)) return;
    setLoading(true);
    fetch(`/api/deployments/${deploymentId}/report`)
      .then(r => {
        if (r.status === 404) throw new Error('Report not yet generated');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        try {
          const d = JSON.parse(text);
          setReport(d.markdown || d.report || d);
        } catch {
          setReport(text);
        }
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [deploymentId, deploymentStatus]);

  // ── Download handler (completely unchanged) ────────────────
  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cloudforge-deployment-${deploymentId}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Dark markdown renderer (same regex, dark Tailwind classes) ──
  const renderMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/^#### (.+)$/gm, '<h4 class="text-xs font-semibold mt-4 mb-1" style="color:#EDEDEF">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-5 mb-2 pb-1" style="color:#EDEDEF;border-bottom:1px solid rgba(255,255,255,0.07)">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-6 mb-2" style="color:#EDEDEF">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-2 mb-3" style="color:#EDEDEF">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#EDEDEF">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="font-mono text-xs px-1 py-0.5 rounded" style="background:rgba(94,106,210,0.15);color:#818cf8">$1</code>')
      .replace(/^---$/gm, '<hr style="border-color:rgba(255,255,255,0.08);margin:16px 0" />')
      .replace(/^- (.+)$/gm, '<li class="text-xs ml-4 list-disc" style="color:#8A8F98">$1</li>')
      .replace(/^(.+)$/gm, (_, line) => {
        if (line.startsWith('<')) return line;
        return `<p class="text-xs leading-relaxed" style="color:#8A8F98">${line}</p>`;
      });
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="max-w-3xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: '#8A8F98' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#EDEDEF' }}>Deployment Report</h3>
            {deploymentId && (
              <span className="text-xs font-mono" style={{ color: '#8A8F98' }}>#{deploymentId}</span>
            )}
          </div>
          {report && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition-all duration-150"
              style={{
                color: '#8A8F98',
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.09)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#EDEDEF';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#8A8F98';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
              }}
            >
              <Download className="w-3.5 h-3.5" /> Download .md
            </button>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: '#8A8F98' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#5E6AD2' }} />
            Loading report...
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div
            className="flex items-start gap-2 p-4 rounded text-sm"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#8A8F98',
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8A8F98' }} />
            <span>{error}. Reports are generated after a successful deployment.</span>
          </div>
        )}

        {/* ── Report content ── */}
        {report && !loading && (
          <div
            className="rounded-lg p-6"
            style={{
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.02)',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
          />
        )}

      </div>
    </div>
  );
}
