import React from 'react';
import { Network, Search, AlertTriangle, CheckCircle, Activity, Bot, Cpu } from 'lucide-react';

export default function AgentReasoningTab({ diagnosis, remediationAction, autonomyMode, isLocalActive, deploymentId }) {
  if (!diagnosis) {
    return (
      <div className="p-6 h-64 flex flex-col items-center justify-center text-gray-500 bg-gray-900 rounded-b-md">
        <Activity className="w-8 h-8 mb-3 text-gray-700 animate-pulse" />
        <p className="text-[13px] font-mono">Awaiting diagnostic telemetry...</p>
      </div>
    );
  }

  const isCloud = diagnosis.model_tier === 'cloud';
  
  return (
    <div className="bg-[#0A0A0A] min-h-full text-green-500 font-mono text-[12px] p-6 rounded-b-md shadow-inner overflow-hidden relative pb-12">
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="flex items-center justify-between border-b border-green-900/50 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-green-400" />
            <h2 className="text-[14px] font-bold text-green-400 tracking-widest uppercase">Agentic Reasoning Stream</h2>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5"/> NODE: {isCloud ? diagnosis.cloud_provider?.toUpperCase() : 'OLLAMA LOCAL'}</span>
            <span className="flex items-center gap-1.5"><Network className="w-3.5 h-3.5"/> CONFIDENCE: {(diagnosis.confidence * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[10px] text-green-700 mb-2 font-bold tracking-wider">] COGNITIVE TRACE</div>
          <div className="bg-[#111] border border-green-900/30 rounded p-4 text-green-300 leading-relaxed break-words shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
            {diagnosis.reasoning?.split('\n').map((line, i) => (
              <div key={i} className="mb-1">{line || '\u00A0'}</div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[10px] text-green-700 mb-2 font-bold tracking-wider">] ACTION VECTOR</div>
          <div className="flex gap-4">
            <div className="bg-[#111] border border-green-900/30 rounded p-4 flex-1">
              <div className="text-gray-500 text-[10px] mb-1">PROPOSED OP</div>
              <div className="text-green-400 font-bold text-[13px]">{diagnosis.action_type}</div>
            </div>
            <div className="bg-[#111] border border-green-900/30 rounded p-4 flex-[2]">
              <div className="text-gray-500 text-[10px] mb-1">PARAMETERS</div>
              <div className="text-green-500 whitespace-pre-wrap">
                {Object.keys(diagnosis.params || {}).length > 0 
                  ? JSON.stringify(diagnosis.params, null, 2)
                  : '{ "NO_PARAMS": true }'}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-green-900/50 rounded p-4 bg-green-950/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {autonomyMode === 'suggest_only' ? <Search className="w-5 h-5 text-blue-500" /> : 
             autonomyMode === 'approve_each' ? <AlertTriangle className="w-5 h-5 text-amber-500" /> :
             <CheckCircle className="w-5 h-5 text-green-500" />}
            <div>
              <div className="text-[10px] text-gray-500">AUTONOMY PROTOCOL</div>
              <div className="font-bold text-[13px] uppercase text-gray-300">{autonomyMode.replace('_', ' ')}</div>
            </div>
          </div>
          
          {remediationAction?.status === 'awaiting_approval' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  try {
                    await fetch(`/api/remediation/${remediationAction.id}/approve`, { method: 'POST' });
                  } catch (e) {}
                }}
                className="px-3 py-1.5 bg-green-900/50 hover:bg-green-800 text-green-300 text-[11px] font-bold rounded border border-green-700 transition-colors"
              >
                APPROVE ACTION
              </button>
              <button 
                onClick={async () => {
                  try {
                    await fetch(`/api/remediation/${remediationAction.id}/reject`, { method: 'POST' });
                  } catch (e) {}
                }}
                className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-[11px] font-bold rounded border border-red-900/50 transition-colors"
              >
                REJECT
              </button>
            </div>
          )}

          <div className="text-right">
            <div className="text-[10px] text-gray-500">EXECUTION STATUS</div>
            <div className={`font-bold text-[13px] uppercase ${remediationAction?.status === 'discarded' ? 'text-red-400' : 'text-green-400'}`}>
              {remediationAction ? (remediationAction.status === 'discarded' ? 'HALTED (NO FIX PROPOSED)' : remediationAction.status) : (autonomyMode === 'suggest_only' ? 'HALTED' : 'PENDING')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
