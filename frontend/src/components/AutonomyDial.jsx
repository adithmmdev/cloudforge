import React from 'react';

const MODES = [
  { key: 'full_auto',    label: 'Full Auto',    desc: 'Fixes auto-promote without human approval' },
  { key: 'approve_each', label: 'Approve Each', desc: 'Each fix requires manual approval' },
  { key: 'suggest_only', label: 'Suggest Only', desc: 'Diagnoses only — never promotes' },
];

export default function AutonomyDial({ projectId, currentMode, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] mr-1" style={{ color: '#8A8F98' }}>Autonomy:</span>
      <div className="flex border rounded overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)' }}>
        {MODES.map(mode => (
          <button
            key={mode.key}
            onClick={() => onChange(mode.key)}
            title={mode.desc}
            className="px-2.5 py-1 text-[11px] font-medium transition-all"
            style={{
              borderRight: '1px solid rgba(255,255,255,0.08)',
              background: currentMode === mode.key ? 'rgba(94,106,210,0.85)' : 'transparent',
              color: currentMode === mode.key ? '#fff' : '#8A8F98'
            }}
            onMouseEnter={e => { if(currentMode !== mode.key) e.currentTarget.style.color = '#EDEDEF' }}
            onMouseLeave={e => { if(currentMode !== mode.key) e.currentTarget.style.color = '#8A8F98' }}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
