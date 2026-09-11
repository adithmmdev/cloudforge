import React, { useState } from 'react';
import { Activity, ShieldCheck, CheckCircle, XCircle, ChevronRight, Server, Cloud } from 'lucide-react';
import './tabs.css';


export default function AgentReasoningTab({ diagnoses, diagnosis, remediationAction, autonomyMode }) {
  // ── Unchanged functional logic ────────────────────────────
  const allDiagnoses = diagnoses && diagnoses.length > 0 ? diagnoses : (diagnosis ? [diagnosis] : []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (allDiagnoses.length === 0) {
    return (
      <div className="p-6 h-64 flex flex-col items-center justify-center" style={{ color: '#8A8F98' }}>
        <Activity className="w-8 h-8 mb-3 animate-pulse" style={{ color: '#5E6AD2' }} />
        <p className="text-sm font-medium">Awaiting diagnostic telemetry...</p>
      </div>
    );
  }

  return (
    <div
      className="p-6 space-y-6 min-h-full"
      style={{ background: 'rgba(2,2,3,0.4)' }}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#EDEDEF' }}>
            <ShieldCheck className="w-4 h-4" style={{ color: '#5E6AD2' }} />
            Agent Decision Trace
          </h2>
        </div>

        {/* ── Diagnosis cards ── */}
        <div className="space-y-4">
          {allDiagnoses.map((diag, idx) => {
            const isLatest   = idx === allDiagnoses.length - 1;
            const isCloud    = diag.model_tier === 'cloud';
            const actionType = diag.action_type || 'NONE';

            // Extract summary and evidence (unchanged logic)
            let summary  = diag.reasoning || '';
            let evidence = 'Evidence gathered from build logs and environment.';
            if (diag.reasoning?.includes('Evidence:')) {
              const parts = diag.reasoning.split('Evidence:');
              summary  = parts[0].replace('Root Cause:', '').trim();
              evidence = parts[1].trim();
            }

            return (
              <div
                key={diag.id || idx}
                className="rounded-lg overflow-hidden"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.025)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                {/* Card header */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    background: isCloud ? 'rgba(94,106,210,0.06)' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div>
                    <div className="text-xs font-bold tracking-wider" style={{ color: '#EDEDEF' }}>
                      ATTEMPT {idx + 1}
                    </div>
                    <div className="text-xs flex items-center gap-1.5 mt-0.5 font-medium" style={{ color: '#8A8F98' }}>
                      {isCloud
                        ? <Cloud className="w-3 h-3" style={{ color: '#5E6AD2' }} />
                        : <Server className="w-3 h-3" style={{ color: '#8A8F98' }} />}
                      {isCloud ? `Cloud Escalation • ${diag.cloud_provider || 'NVIDIA NIM'}` : 'Local • Ollama'}
                    </div>
                  </div>

                  {isLatest && remediationAction?.status === 'discarded' ? (
                    <div
                      className="px-2 py-1 text-xs font-bold rounded"
                      style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}
                    >
                      ESCALATING / HALTED
                    </div>
                  ) : (
                    <div
                      className="px-2 py-1 text-xs font-bold rounded font-mono"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#8A8F98', border: '1px solid rgba(255,255,255,0.09)' }}
                    >
                      {(diag.confidence * 100).toFixed(1)}% CONFIDENCE
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">

                  {/* Left: Diagnosis */}
                  <div className="space-y-4">
                    <div>
                      <div
                        className="text-xs font-bold mb-1 tracking-wider"
                        style={{ color: '#8A8F98' }}
                      >
                        FAILURE SUMMARY
                      </div>
                      <div className="font-medium leading-relaxed" style={{ color: '#EDEDEF' }}>
                        {summary}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-1 tracking-wider" style={{ color: '#8A8F98' }}>
                        EVIDENCE
                      </div>
                      <div
                        className="leading-relaxed italic p-2 rounded"
                        style={{
                          color: '#8A8F98',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        {evidence}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-bold mb-1 tracking-wider" style={{ color: '#8A8F98' }}>
                        PROPOSED ACTION
                      </div>
                      <div
                        className="font-mono font-bold text-sm"
                        style={{ color: actionType === 'NONE' ? '#f43f5e' : '#5E6AD2' }}
                      >
                        {actionType}
                      </div>
                    </div>

                    {actionType !== 'NONE' && (
                      <div>
                        <div className="text-xs font-bold mb-1 tracking-wider" style={{ color: '#8A8F98' }}>
                          PARAMETERS
                        </div>
                        <div
                          className="font-mono whitespace-pre-wrap text-xs p-2 rounded"
                          style={{
                            color: '#EDEDEF',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          {Object.keys(diag.params || {}).length > 0
                            ? JSON.stringify(diag.params, null, 2)
                            : '{ "NO_PARAMS": true }'}
                        </div>
                      </div>
                    )}

                    {isLatest && remediationAction && actionType !== 'NONE' && (
                      <div className="pt-1">
                        <div className="text-xs font-bold mb-1 tracking-wider" style={{ color: '#8A8F98' }}>STATUS</div>
                        <div className="flex items-center gap-2">
                          {remediationAction.status === 'promoted'
                            ? <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                            : remediationAction.status === 'rejected'
                            ? <XCircle className="w-4 h-4" style={{ color: '#f43f5e' }} />
                            : <ChevronRight className="w-4 h-4" style={{ color: '#f59e0b' }} />}
                          <span
                            className="text-xs font-semibold uppercase tracking-wider"
                            style={{
                              color: remediationAction.status === 'promoted' ? '#22c55e'
                                   : remediationAction.status === 'rejected' ? '#f43f5e'
                                   : '#f59e0b',
                            }}
                          >
                            {remediationAction.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Controls — Awaiting Approval */}
                {isLatest && remediationAction?.status === 'awaiting_approval' && (
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.07)',
                      background: 'rgba(245,158,11,0.05)',
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: '#8A8F98' }}>
                      Autonomy: {autonomyMode.replace('_', ' ').toUpperCase()} — Requires Human Approval
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Approve — unchanged fetch calls */}
                      <button
                        disabled={isSubmitting}
                        onClick={async () => {
                          try {
                            setIsSubmitting(true);
                            await fetch(`/api/remediation-actions/${remediationAction.id}/approve`, { method: 'POST' });
                          } catch (e) {
                            setIsSubmitting(false);
                          }
                        }}
                        className="tab-btn-approve"
                        style={{ fontSize: '11px' }}
                      >
                        {isSubmitting ? 'APPROVING...' : 'APPROVE ACTION'}
                      </button>
                      {/* Reject — unchanged fetch calls */}
                      <button
                        disabled={isSubmitting}
                        onClick={async () => {
                          try {
                            setIsSubmitting(true);
                            await fetch(`/api/remediation-actions/${remediationAction.id}/reject`, { method: 'POST' });
                          } catch (e) {
                            setIsSubmitting(false);
                          }
                        }}
                        className="tab-btn-reject"
                        style={{ fontSize: '11px' }}
                      >
                        {isSubmitting ? 'REJECTING...' : 'REJECT'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
