import React from 'react';
import { CheckCircle, Loader2, Circle, AlertCircle } from 'lucide-react';

const STAGE_ORDER = [
  'provisioning', 'detecting', 'building', 'deploying',
  'health_check', 'healing', 'live', 'generating_report',
];

const STAGE_LABELS = {
  provisioning:          'Provisioning EC2 Instance',
  detecting:             'Detecting Framework',
  building:              'Building Image (--network=none)',
  deploying:             'Deploying to EC2 via SSH',
  health_check:          'Running Health Check',
  healing:               'Healing / Rollback',
  live:                  'Deployment Live ✓',
  generating_report:     'Generating Deployment Report',
  failed:                'Deployment Failed',
  rolled_back:           'Rolled Back to Previous',
  cancelled:             'Deployment Cancelled',
  diagnosis:             'LLM Diagnosis Running',
  remediation_proposed:  'Remediation Proposed',
  shadow_testing:        'Shadow Verification Running',
  awaiting_approval:     'Awaiting Human Approval',
};

function getTimestamp(event) {
  // REST endpoint returns created_at; WS sends timestamp
  return event?.timestamp || event?.created_at || null;
}

export default function TimelineTab({ events, currentStage, deployment }) {
  // Normalize events — accept both `timestamp` and `created_at`
  const normalized = (events || []).map(e => ({
    ...e,
    timestamp: getTimestamp(e),
  }));

  const seenStages = new Set(normalized.map(e => e.stage).filter(s => s !== 'log'));
  const isTerminal = ['live', 'failed', 'rolled_back', 'cancelled'].includes(currentStage);

  const stageStatus = (stage) => {
    if (currentStage === stage) return 'active';
    if (['failed', 'rolled_back', 'cancelled'].includes(currentStage)) {
      return seenStages.has(stage) ? 'done' : 'pending';
    }
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const stageIdx   = STAGE_ORDER.indexOf(stage);
    if (currentIdx >= 0 && stageIdx < currentIdx) return 'done';
    return 'pending';
  };

  const getEvents = (stage) => normalized.filter(e => e.stage === stage);

  const extraStages = [...seenStages].filter(s => !STAGE_ORDER.includes(s));
  const allDisplayStages = [
    ...STAGE_ORDER.filter(s => seenStages.has(s) || s === currentStage),
    ...extraStages,
  ].filter((s, i, arr) => arr.indexOf(s) === i);

  const startedAt  = deployment?.started_at;
  const finishedAt = deployment?.finished_at;
  const elapsedMs  = startedAt
    ? (finishedAt ? new Date(finishedAt) : new Date()) - new Date(startedAt)
    : null;
  const formatElapsed = (ms) => {
    if (ms === null) return null;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold" style={{ color: '#EDEDEF' }}>Deployment Timeline</h3>
          {elapsedMs !== null && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{
                color: '#8A8F98',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              ⏱ {formatElapsed(elapsedMs)} elapsed
            </span>
          )}
        </div>

        {!deployment && (
          <div className="text-sm italic" style={{ color: '#8A8F98' }}>
            No deployment started yet. Click Deploy to begin.
          </div>
        )}

        {deployment && (
          <div className="relative">
            {/* Vertical connector line */}
            <div
              className="absolute left-5 top-0 bottom-0 w-px"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />

            {allDisplayStages.map((stage) => {
              if (stage === 'log') return null;
              const s = stageStatus(stage);
              if (s === 'pending' && !seenStages.has(stage) && stage !== currentStage) return null;

              const stageEvents = getEvents(stage);
              const lastEvent   = stageEvents[stageEvents.length - 1];
              const ts          = lastEvent?.timestamp ? new Date(lastEvent.timestamp) : null;

              return (
                <div key={stage} className="relative flex gap-4 pb-5">
                  <div className="flex-shrink-0 w-10 flex justify-center">
                    <div className="z-10 rounded-full p-0.5" style={{ background: '#0a0a0c' }}>
                      {s === 'done'    && <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />}
                      {s === 'active'  && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#5E6AD2' }} />}
                      {s === 'pending' && <Circle className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.18)' }} />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm"
                        style={{
                          color: s === 'done' ? '#EDEDEF' : s === 'active' ? '#5E6AD2' : 'rgba(255,255,255,0.3)',
                          fontWeight: s === 'active' ? 600 : 500,
                        }}
                      >
                        {STAGE_LABELS[stage] || stage}
                      </span>
                      {ts && (
                        <span className="text-xs font-mono" style={{ color: '#8A8F98' }}>
                          {ts.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {stage === 'diagnosis' && lastEvent?.detail ? (
                      (() => {
                        try {
                          const diag = JSON.parse(lastEvent.detail);
                          return (
                            <div
                              className="mt-1.5 rounded p-3 font-mono text-xs"
                              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <span className="font-bold uppercase tracking-wider" style={{ color: '#5E6AD2' }}>DIAGNOSIS YIELD</span>
                                <span style={{ color: diag.model_tier === 'cloud' ? '#818cf8' : '#8A8F98', fontWeight: 600 }}>
                                  {diag.model_tier === 'cloud' ? `CLOUD ESCALATION • ${diag.cloud_provider || 'NVIDIA NIM'}` : 'LOCAL • OLLAMA'}
                                </span>
                              </div>
                              <div className="mb-2">
                                <span className="mr-2" style={{ color: '#8A8F98' }}>ROOT CAUSE:</span>
                                <span style={{ color: '#EDEDEF' }}>{diag.reasoning?.split('\n')[0]?.replace('Root Cause: ', '') || diag.reasoning}</span>
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <span className="mr-2" style={{ color: '#8A8F98' }}>ACTION:</span>
                                  <span style={{ color: diag.action_type === 'NONE' ? '#f43f5e' : '#22c55e', fontWeight: 600 }}>{diag.action_type}</span>
                                </div>
                                <div>
                                  <span className="mr-2" style={{ color: '#8A8F98' }}>CONFIDENCE:</span>
                                  <span style={{ color: '#60a5fa' }}>{(diag.confidence * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        } catch(e) {
                          return <p className="text-xs mt-0.5 font-mono truncate max-w-lg" style={{ color: '#8A8F98' }}>{lastEvent.detail}</p>;
                        }
                      })()
                    ) : lastEvent?.detail && s !== 'pending' && (
                      <p className="text-xs mt-0.5 font-mono truncate max-w-lg" style={{ color: '#8A8F98' }}>
                        {lastEvent.detail}
                      </p>
                    )}
                    {stageEvents.length > 1 && stage !== 'diagnosis' && (
                      <div
                        className="mt-1.5 rounded p-2 font-mono text-xs max-h-20 overflow-y-auto"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', color: '#8A8F98' }}
                      >
                        {stageEvents.map((e, i) => (
                          <div key={i}>
                            <span className="mr-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}
                            </span>
                            {e.detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Terminal failure row */}
            {isTerminal && ['failed', 'rolled_back', 'cancelled'].includes(currentStage) && (
              <div className="relative flex gap-4 pb-5">
                <div className="flex-shrink-0 w-10 flex justify-center">
                  <div className="z-10 rounded-full p-0.5" style={{ background: '#0a0a0c' }}>
                    <AlertCircle className="w-4 h-4" style={{ color: '#f43f5e' }} />
                  </div>
                </div>
                <div className="flex-1 pt-0.5">
                  <span className="text-sm font-medium" style={{ color: '#fb7185' }}>
                    {currentStage === 'rolled_back' ? 'Rolled Back to Previous Version'
                      : currentStage === 'cancelled' ? 'Deployment Cancelled'
                      : 'Deployment Failed — Remediation Initiated'}
                  </span>
                  {normalized.filter(e => ['failed', 'rolled_back', 'cancelled'].includes(e.stage)).slice(-1).map((e, i) => (
                    <p key={i} className="text-xs mt-0.5 font-mono" style={{ color: '#f43f5e' }}>{e.detail}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
