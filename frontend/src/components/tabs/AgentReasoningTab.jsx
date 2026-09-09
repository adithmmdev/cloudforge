import React, { useState } from 'react';
import { Activity, ShieldCheck, CheckCircle, XCircle, ChevronRight, Server, Cloud } from 'lucide-react';

export default function AgentReasoningTab({ diagnoses, diagnosis, remediationAction, autonomyMode }) {
  const allDiagnoses = diagnoses && diagnoses.length > 0 ? diagnoses : (diagnosis ? [diagnosis] : []);

  if (allDiagnoses.length === 0) {
    return (
      <div className="p-6 h-64 flex flex-col items-center justify-center text-gray-400">
        <Activity className="w-8 h-8 mb-3 text-gray-300 animate-pulse" />
        <p className="text-[13px] font-medium">Awaiting diagnostic telemetry...</p>
      </div>
    );
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 min-h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <h2 className="text-[14px] font-bold text-gray-800 tracking-wide uppercase flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            Agent Decision Trace
          </h2>
        </div>

        <div className="space-y-4">
          {allDiagnoses.map((diag, idx) => {
            const isLatest = idx === allDiagnoses.length - 1;
            const isCloud = diag.model_tier === 'cloud';
            const actionType = diag.action_type || 'NONE';
            
            // Try to extract summary and evidence from reasoning
            let summary = diag.reasoning || '';
            let evidence = 'Evidence gathered from build logs and environment.';
            if (diag.reasoning?.includes('Evidence:')) {
              const parts = diag.reasoning.split('Evidence:');
              summary = parts[0].replace('Root Cause:', '').trim();
              evidence = parts[1].trim();
            }

            return (
              <div key={diag.id || idx} className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
                <div className={`px-4 py-3 border-b flex items-center justify-between ${isCloud ? 'bg-indigo-50/50 border-indigo-100' : 'bg-gray-50 border-gray-200'}`}>
                  <div>
                    <div className="text-[12px] font-bold text-gray-800 tracking-wider">
                      ATTEMPT {idx + 1}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5 font-medium">
                      {isCloud ? <Cloud className="w-3.5 h-3.5 text-indigo-500" /> : <Server className="w-3.5 h-3.5 text-gray-500" />}
                      {isCloud ? 'Cloud Escalation • ' + (diag.cloud_provider || 'NVIDIA NIM') : 'Local • Ollama'}
                    </div>
                  </div>
                  {isLatest && remediationAction?.status === 'discarded' ? (
                     <div className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded">ESCALATING / HALTED</div>
                  ) : (
                     <div className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">{(diag.confidence * 100).toFixed(1)}% CONFIDENCE</div>
                  )}
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-[12px]">
                  
                  {/* Left Column: Diagnosis */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold mb-1 tracking-wider">FAILURE SUMMARY</div>
                      <div className="text-gray-800 font-medium leading-relaxed">{summary}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold mb-1 tracking-wider">EVIDENCE</div>
                      <div className="text-gray-600 leading-relaxed bg-gray-50 p-2 rounded border border-gray-100 italic">{evidence}</div>
                    </div>
                  </div>
                  
                  {/* Right Column: Action */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold mb-1 tracking-wider">PROPOSED ACTION</div>
                      <div className={`font-mono font-bold text-[13px] ${actionType === 'NONE' ? 'text-red-500' : 'text-indigo-600'}`}>
                        {actionType}
                      </div>
                    </div>
                    
                    {actionType !== 'NONE' && (
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold mb-1 tracking-wider">PARAMETERS</div>
                        <div className="font-mono text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-wrap">
                          {Object.keys(diag.params || {}).length > 0 
                            ? JSON.stringify(diag.params, null, 2)
                            : '{ "NO_PARAMS": true }'}
                        </div>
                      </div>
                    )}

                    {isLatest && remediationAction && actionType !== 'NONE' && (
                      <div className="pt-2">
                        <div className="text-[10px] text-gray-400 font-bold mb-1 tracking-wider">STATUS</div>
                        <div className="flex items-center gap-2">
                          {remediationAction.status === 'promoted' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                           remediationAction.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-500" /> :
                           <ChevronRight className="w-4 h-4 text-amber-500" />}
                          <span className={`font-semibold uppercase tracking-wider ${
                            remediationAction.status === 'promoted' ? 'text-emerald-600' :
                            remediationAction.status === 'rejected' ? 'text-red-600' :
                            'text-amber-600'
                          }`}>
                            {remediationAction.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Interactive Controls for Latest Attempt */}
                {isLatest && remediationAction?.status === 'awaiting_approval' && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 font-medium">Autonomy: {autonomyMode.replace('_', ' ').toUpperCase()} — Requires Human Approval</span>
                    <div className="flex items-center gap-2">
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
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded shadow-sm transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'APPROVING...' : 'APPROVE ACTION'}
                      </button>
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
                        className="px-4 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-red-600 text-[11px] font-bold rounded shadow-sm transition-colors disabled:opacity-50"
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
