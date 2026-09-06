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
      // For failed/cancelled, show stages that actually ran as done
      return seenStages.has(stage) ? 'done' : 'pending';
    }
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const stageIdx = STAGE_ORDER.indexOf(stage);
    if (currentIdx >= 0 && stageIdx < currentIdx) return 'done';
    return 'pending';
  };

  const getEvents = (stage) => normalized.filter(e => e.stage === stage);

  // Build ordered list of stages that appeared + current stage
  // Also include extra stages not in STAGE_ORDER (e.g. diagnosis, shadow_testing)
  const extraStages = [...seenStages].filter(s => !STAGE_ORDER.includes(s));
  const allDisplayStages = [
    ...STAGE_ORDER.filter(s => seenStages.has(s) || s === currentStage),
    ...extraStages,
  ].filter((s, i, arr) => arr.indexOf(s) === i);

  // Elapsed time calculation
  const startedAt = deployment?.started_at;
  const finishedAt = deployment?.finished_at;
  const elapsedMs = startedAt
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
          <h3 className="text-[13px] font-semibold text-gray-700">Deployment Timeline</h3>
          {elapsedMs !== null && (
            <span className="text-[11px] text-gray-400 font-mono bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
              ⏱ {formatElapsed(elapsedMs)} elapsed
            </span>
          )}
        </div>

        {!deployment && (
          <div className="text-[13px] text-gray-400 italic">
            No deployment started yet. Click Deploy to begin.
          </div>
        )}

        {deployment && (
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

            {allDisplayStages.map((stage) => {
              if (stage === 'log') return null;
              const s = stageStatus(stage);
              if (s === 'pending' && !seenStages.has(stage) && stage !== currentStage) return null;

              const stageEvents = getEvents(stage);
              const lastEvent = stageEvents[stageEvents.length - 1];
              const ts = lastEvent?.timestamp ? new Date(lastEvent.timestamp) : null;

              return (
                <div key={stage} className="relative flex gap-4 pb-5">
                  <div className="flex-shrink-0 w-10 flex justify-center">
                    <div className="z-10 bg-white rounded-full p-0.5">
                      {s === 'done'   && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {s === 'active' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                      {s === 'pending' && <Circle className="w-4 h-4 text-gray-300" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[13px] font-medium ${
                        s === 'done'   ? 'text-gray-700' :
                        s === 'active' ? 'text-indigo-600 font-semibold' :
                        'text-gray-400'
                      }`}>
                        {STAGE_LABELS[stage] || stage}
                      </span>
                      {ts && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {ts.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {stage === 'diagnosis' && lastEvent?.detail ? (
                      (() => {
                        try {
                          const diag = JSON.parse(lastEvent.detail);
                          return (
                            <div className="mt-1.5 bg-gray-900 rounded p-3 font-mono text-[10px] text-gray-300 shadow-sm border border-gray-800">
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-800">
                                <span className="text-indigo-400 font-bold uppercase tracking-wider">DIAGNOSIS YIELD</span>
                                <span className="text-gray-500">PROVIDER: {diag.cloud_provider || 'unknown'}</span>
                              </div>
                              <div className="mb-2">
                                <span className="text-gray-500 mr-2">ROOT CAUSE:</span>
                                <span className="text-gray-300">{diag.reasoning?.split('\n')[0]?.replace('Root Cause: ', '') || diag.reasoning}</span>
                              </div>
                              <div className="flex gap-4">
                                <div><span className="text-gray-500 mr-2">ACTION:</span><span className={diag.action_type === 'NONE' ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{diag.action_type}</span></div>
                                <div><span className="text-gray-500 mr-2">CONFIDENCE:</span><span className="text-blue-400">{(diag.confidence * 100).toFixed(1)}%</span></div>
                              </div>
                            </div>
                          );
                        } catch(e) {
                          return <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate max-w-lg">{lastEvent.detail}</p>;
                        }
                      })()
                    ) : lastEvent?.detail && s !== 'pending' && (
                      <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate max-w-lg">
                        {lastEvent.detail}
                      </p>
                    )}
                    {/* Show all detail lines if multiple events for a stage (unless diagnosis) */}
                    {stageEvents.length > 1 && stage !== 'diagnosis' && (
                      <div className="mt-1.5 bg-gray-900 rounded p-2 font-mono text-[10px] text-gray-400 max-h-20 overflow-y-auto">
                        {stageEvents.map((e, i) => (
                          <div key={i}>
                            <span className="text-gray-600 mr-2">
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
                  <div className="z-10 bg-white rounded-full p-0.5">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                </div>
                <div className="flex-1 pt-0.5">
                  <span className="text-[13px] font-medium text-red-700">
                    {currentStage === 'rolled_back' ? 'Rolled Back to Previous Version'
                      : currentStage === 'cancelled' ? 'Deployment Cancelled'
                      : 'Deployment Failed — Remediation Initiated'}
                  </span>
                  {normalized.filter(e => ['failed', 'rolled_back', 'cancelled'].includes(e.stage)).slice(-1).map((e, i) => (
                    <p key={i} className="text-[11px] text-red-500 mt-0.5 font-mono">{e.detail}</p>
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
