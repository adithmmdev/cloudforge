import React from 'react';

const MODES = [
  { key: 'full_auto',    label: 'Full Auto',    desc: 'Fixes auto-promote without human approval' },
  { key: 'approve_each', label: 'Approve Each', desc: 'Each fix requires manual approval' },
  { key: 'suggest_only', label: 'Suggest Only', desc: 'Diagnoses only — never promotes' },
];

export default function AutonomyDial({ projectId, currentMode, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-gray-400 mr-1">Autonomy:</span>
      <div className="flex border border-gray-200 rounded overflow-hidden">
        {MODES.map(mode => (
          <button
            key={mode.key}
            onClick={() => onChange(mode.key)}
            title={mode.desc}
            className={`px-2.5 py-1 text-[11px] font-medium transition-all border-r last:border-r-0 border-gray-200 ${
              currentMode === mode.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
