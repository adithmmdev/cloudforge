import React, { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';

const DEST_STYLES = {
  anthropic_api:  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Anthropic' },
  anthropic:      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Anthropic' },
  openai:         { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  label: 'OpenAI' },
  glm_api:        { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   label: 'GLM / Z.ai' },
  nvidia_nim_api: { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  label: 'NVIDIA NIM' },
  nvidia_nim:     { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  label: 'NVIDIA NIM' },
  kimi_api:       { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', label: 'Moonshot (Kimi)' },
  kimi:           { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', label: 'Moonshot (Kimi)' },
  moonshotai:     { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', label: 'Moonshot (Kimi)' },
  ollama:         { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', label: 'Local (Ollama)' },
};

function DisclosureRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const d = DEST_STYLES[entry.destination] || DEST_STYLES.anthropic;
  let parsed;
  try { parsed = JSON.parse(entry.content_sent); } catch { parsed = null; }

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-2.5 font-mono text-[11px] text-gray-400">
          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${d.bg} ${d.border} ${d.text}`}>
            {d.label}
          </span>
        </td>
        <td className="px-4 py-2.5 font-mono text-[11px] text-gray-600 max-w-xs truncate">
          {typeof entry.content_sent === 'string' ? entry.content_sent.slice(0, 80) + '...' : '—'}
        </td>
        <td className="px-4 py-2.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={4} className="px-4 py-3">
            <div className="bg-gray-900 rounded p-3 font-mono text-[10px] text-gray-300 overflow-auto max-h-48">
              {parsed
                ? JSON.stringify(parsed, null, 2)
                : entry.content_sent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DisclosureLedgerTab({ deploymentId, liveDisclosures }) {
  const [disclosures, setDisclosures] = useState([]);

  // Normalize disclosure record from either REST or WS shape
  const normalize = (d) => ({
    ...d,
    // REST: provider_name / redacted_signature  |  WS: destination / content_sent
    destination:  d.destination  || d.provider_name  || d.provider || 'unknown',
    content_sent: d.content_sent || d.redacted_signature || d.payload || '',
    id: d.id || Math.random().toString(36).substr(2, 9),
  });

  useEffect(() => {
    if (!deploymentId) return;
    fetch(`/api/deployments/${deploymentId}/disclosures`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setDisclosures(Array.isArray(d) ? d.map(normalize) : []))
      .catch(() => {});
  }, [deploymentId]);

  const all = [
    ...disclosures,
    ...liveDisclosures.map(normalize).filter(l => !disclosures.find(d => d.id === l.id)),
  ];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-gray-700">Disclosure Ledger</h3>
        <p className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          Privacy audit trail — raw source code is never included. Only redacted 7-field signatures are transmitted.
        </p>
      </div>

      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Destination</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Payload Preview</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Full Payload</th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-gray-400">
                  <Shield className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                  No cloud disclosures — local LLM handled all diagnoses
                </td>
              </tr>
            ) : (
              all.map((entry, i) => <DisclosureRow key={i} entry={entry} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
