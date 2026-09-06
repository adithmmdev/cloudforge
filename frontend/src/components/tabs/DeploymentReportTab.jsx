import React, { useState, useEffect } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';

export default function DeploymentReportTab({ deploymentId, deploymentStatus }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudforge-deployment-${deploymentId}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Simple markdown to HTML (headers, bold, code, horizontal rules)
  const renderMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/^#### (.+)$/gm, '<h4 class="text-[12px] font-semibold text-gray-700 mt-4 mb-1">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="text-[13px] font-semibold text-gray-800 mt-5 mb-2 border-b border-gray-100 pb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-[15px] font-semibold text-gray-900 mt-6 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-[17px] font-bold text-gray-900 mt-2 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="font-mono text-[11px] bg-gray-100 px-1 py-0.5 rounded text-indigo-700">$1</code>')
      .replace(/^---$/gm, '<hr class="border-gray-200 my-4" />')
      .replace(/^- (.+)$/gm, '<li class="text-[12px] text-gray-700 ml-4 list-disc">$1</li>')
      .replace(/^(.+)$/gm, (_, line) => {
        if (line.startsWith('<')) return line;
        return `<p class="text-[12px] text-gray-700 leading-relaxed">${line}</p>`;
      });
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h3 className="text-[13px] font-semibold text-gray-700">Deployment Report</h3>
            {deploymentId && <span className="text-[11px] text-gray-400 font-mono">#{deploymentId}</span>}
          </div>
          {report && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download .md
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading report...
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2 p-4 bg-gray-50 border border-gray-200 rounded text-[13px] text-gray-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
            <span>{error}. Reports are generated after a successful deployment.</span>
          </div>
        )}

        {report && !loading && (
          <div className="border border-gray-200 rounded bg-white p-6 prose-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
          />
        )}
      </div>
    </div>
  );
}
