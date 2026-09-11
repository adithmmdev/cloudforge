import React, { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';

// ── Dark destination styles ────────────────────────────────────
const DEST_STYLES = {
  anthropic_api:  { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.2)',   label: 'Anthropic' },
  anthropic:      { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.2)',   label: 'Anthropic' },
  openai:         { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.2)',   label: 'OpenAI' },
  glm_api:        { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.2)',   label: 'GLM / Z.ai' },
  nvidia_nim_api: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.2)',   label: 'NVIDIA NIM' },
  nvidia_nim:     { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.2)',   label: 'NVIDIA NIM' },
  kimi_api:       { color: '#c4b5fd', bg: 'rgba(196,181,253,0.1)',  border: 'rgba(196,181,253,0.2)',  label: 'Moonshot (Kimi)' },
  kimi:           { color: '#c4b5fd', bg: 'rgba(196,181,253,0.1)',  border: 'rgba(196,181,253,0.2)',  label: 'Moonshot (Kimi)' },
  moonshotai:     { color: '#c4b5fd', bg: 'rgba(196,181,253,0.1)',  border: 'rgba(196,181,253,0.2)',  label: 'Moonshot (Kimi)' },
  ollama:         { color: '#818cf8', bg: 'rgba(129,140,248,0.1)',  border: 'rgba(129,140,248,0.2)',  label: 'Local (Ollama)' },
};

// ── Disclosure row ─────────────────────────────────────────────
function DisclosureRow({ entry }) {
  // ── Unchanged expand state logic ──────────────────────────
  const [expanded, setExpanded] = useState(false);
  const d = DEST_STYLES[entry.destination] || DEST_STYLES.anthropic;
  let parsed;
  try { parsed = JSON.parse(entry.content_sent); } catch { parsed = null; }

  return (
    <>
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#8A8F98' }}>
          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
        </td>
        <td className="px-4 py-2.5">
          <span
            className="inline-flex px-2 py-0.5 rounded text-xs font-semibold border"
            style={{ background: d.bg, borderColor: d.border, color: d.color }}
          >
            {d.label}
          </span>
        </td>
        <td className="px-4 py-2.5 font-mono text-xs max-w-xs truncate" style={{ color: '#8A8F98' }}>
          {typeof entry.content_sent === 'string' ? entry.content_sent.slice(0, 80) + '...' : '—'}
        </td>
        <td className="px-4 py-2.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs transition-colors duration-150"
            style={{ color: '#5E6AD2' }}
            onMouseEnter={e => e.currentTarget.style.color = '#6872D9'}
            onMouseLeave={e => e.currentTarget.style.color = '#5E6AD2'}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div
              className="rounded p-3 font-mono text-xs overflow-auto max-h-48"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(237,237,239,0.8)',
              }}
            >
              {parsed ? JSON.stringify(parsed, null, 2) : entry.content_sent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
export default function DisclosureLedgerTab({ deploymentId, liveDisclosures }) {
  // ── Unchanged data fetching logic ─────────────────────────
  const [disclosures, setDisclosures] = useState([]);

  const normalize = (d) => ({
    ...d,
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

  // ─────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#EDEDEF' }}>Disclosure Ledger</h3>
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#8A8F98' }}>
          <Shield className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
          Privacy audit trail — raw source code is never included. Only redacted 7-field signatures are transmitted.
        </p>
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Timestamp', 'Destination', 'Payload Preview', 'Full Payload'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.07em]"
                  style={{ color: '#8A8F98', fontSize: '10px' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm" style={{ color: '#8A8F98' }}>
                  <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: '#22c55e' }} />
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
