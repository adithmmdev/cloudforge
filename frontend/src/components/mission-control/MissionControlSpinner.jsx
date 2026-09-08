import React from 'react';

export default function MissionControlSpinner({ label = 'Loading Mission Control', compact = false }) {
  return (
    <span className={`mc-spinner-wrap${compact ? ' mc-spinner-wrap--compact' : ''}`} role="status" aria-label={label}>
      <span className="mc-spinner" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
      </span>
      {!compact && <span className="mc-spinner-label">{label}</span>}
    </span>
  );
}
