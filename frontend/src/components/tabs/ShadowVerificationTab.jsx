import React, { useState, useEffect } from 'react';
import { Container, CheckCircle, XCircle, Loader2, AlertTriangle, ChevronDown, ChevronUp, Shield, Zap, Terminal } from 'lucide-react';

const STEP_LABELS = {
  'build_client':      'Build React Client Image',
  'build_server':      'Build Express Server Image',
  'build':             'Build Application Image',
  'run':               'Start Shadow Containers',
  'stay_running_15s':  'Health: Containers Stay Running 15s',
  'smoke_test':        'Smoke Test (HTTP /)',
  'exception':         'Internal Exception',
};

// ── Test row ──────────────────────────────────────────────────
function TestRow({ test }) {
  const [expanded, setExpanded] = useState(!test.passed);

  return (
    <>
      <tr
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: !test.passed ? 'rgba(244,63,94,0.04)' : 'transparent',
        }}
      >
        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#EDEDEF' }}>
          {STEP_LABELS[test.test_name] || test.test_name}
        </td>
        <td className="px-4 py-2.5">
          {test.passed ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
              style={{ color: '#4ade80', background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)' }}>
              <CheckCircle className="w-3 h-3" /> PASS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
              style={{ color: '#fb7185', background: 'rgba(244,63,94,0.1)', borderColor: 'rgba(244,63,94,0.2)' }}>
              <XCircle className="w-3 h-3" /> FAIL
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 font-mono text-xs max-w-xs" style={{ color: '#8A8F98' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{(test.output || '—').split('\n')[0].slice(0, 80)}</span>
            {test.output && test.output.length > 80 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 flex-shrink-0 transition-colors duration-150"
                style={{ color: '#5E6AD2', fontSize: '10px' }}
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Less' : 'Full'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && test.output && test.output.length > 80 && (
        <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
          <td colSpan={3} className="px-4 py-3">
            <div
              className="rounded-lg p-3 font-mono text-xs max-h-64 overflow-auto whitespace-pre-wrap leading-relaxed"
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(237,237,239,0.85)' }}
            >
              <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <Terminal className="w-3 h-3" style={{ color: '#8A8F98' }} />
                <span className="uppercase tracking-wider" style={{ color: '#8A8F98', fontSize: '9px' }}>
                  {STEP_LABELS[test.test_name] || test.test_name} Output
                </span>
              </div>
              {test.output}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
export default function ShadowVerificationTab({ deploymentId, shadowTests, shadowState }) {
  // ── All unchanged functional logic ────────────────────────
  const [historical, setHistorical]     = useState([]);
  const [groupedHistory, setGroupedHistory] = useState([]);
  const [runningManual, setRunningManual]   = useState(false);

  useEffect(() => {
    if (!deploymentId) return;
    fetch(`/api/deployments/${deploymentId}/shadow-tests`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (!Array.isArray(d)) return;
        setHistorical(d);
        const groups = {};
        d.forEach(t => {
          const k = t.remediation_action_id || 'unknown';
          if (!groups[k]) groups[k] = [];
          groups[k].push(t);
        });
        setGroupedHistory(Object.entries(groups).reverse());
      })
      .catch(() => {});
  }, [deploymentId, shadowTests]);

  const handleManualVerification = async () => {
    if (!deploymentId) return;
    setRunningManual(true);
    try {
      await fetch(`/api/deployments/${deploymentId}/shadow-manual`, { method: 'POST' });
    } catch (err) {
      console.error(err);
      setRunningManual(false);
    }
  };

  useEffect(() => {
    if (shadowState === 'passed' || shadowState === 'failed') {
      setRunningManual(false);
    }
  }, [shadowState]);

  const liveMerged = [
    ...historical,
    ...shadowTests.filter(t => !historical.find(h => h.id === t.id || (h.test_name === t.test_name && h.remediation_action_id === t.remediation_action_id)))
  ];

  const STEPS = [
    { key: 'template', label: 'Regenerate Dockerfiles from Templates',    done: ['building','testing','passed','failed'].includes(shadowState) },
    { key: 'deps',     label: 'Materialize npm/pip Dependencies (cached)', done: ['building','testing','passed','failed'].includes(shadowState) },
    { key: 'building', label: 'Build Isolated Image (--network=none)',     done: ['testing','passed','failed'].includes(shadowState) },
    { key: 'testing',  label: 'Run Smoke Tests (HTTP health checks)',       done: ['passed','failed'].includes(shadowState) },
  ];

  const currentStepIdx = STEPS.findIndex(s => !s.done);
  const failedTests    = liveMerged.filter(t => !t.passed);

  // ── Dark sandbox state styles ──────────────────────────────
  const sandboxStyle = {
    idle:     { border: 'rgba(255,255,255,0.09)', bg: 'rgba(255,255,255,0.02)' },
    building: { border: 'rgba(245,158,11,0.4)',   bg: 'rgba(245,158,11,0.05)' },
    testing:  { border: 'rgba(94,106,210,0.4)',   bg: 'rgba(94,106,210,0.05)' },
    passed:   { border: 'rgba(34,197,94,0.4)',    bg: 'rgba(34,197,94,0.07)' },
    failed:   { border: 'rgba(244,63,94,0.4)',    bg: 'rgba(244,63,94,0.07)' },
  }[shadowState] || { border: 'rgba(255,255,255,0.09)', bg: 'rgba(255,255,255,0.02)' };

  const statusPillStyle = {
    passed:   { color: '#4ade80', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.25)' },
    failed:   { color: '#fb7185', bg: 'rgba(244,63,94,0.15)',   border: 'rgba(244,63,94,0.25)' },
    idle:     { color: '#8A8F98', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
    building: { color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.25)' },
    testing:  { color: '#818cf8', bg: 'rgba(94,106,210,0.15)',  border: 'rgba(94,106,210,0.25)' },
  }[shadowState] || { color: '#8A8F98', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: '#EDEDEF' }}>
            Shadow Verification Gate
          </h3>
          <p className="text-xs" style={{ color: '#8A8F98' }}>
            Proposed fix is built and smoke-tested in an isolated container before promotion to EC2.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualVerification}
            disabled={runningManual || shadowState === 'building' || shadowState === 'testing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: '#5E6AD2',
              background: 'rgba(94,106,210,0.1)',
              borderColor: 'rgba(94,106,210,0.25)',
            }}
          >
            {(runningManual || shadowState === 'building' || shadowState === 'testing') ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Verifying Sandbox...</span></>
            ) : (
              <><Zap className="w-3.5 h-3.5" />Manual Verification</>
            )}
          </button>
          <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <Shield className="w-4 h-4" style={{ color: '#5E6AD2' }} />
            <span className="text-xs font-mono font-medium" style={{ color: '#818cf8' }}>--network=none</span>
          </div>
        </div>
      </div>

      {/* ── Sandbox visualization ── */}
      <div
        className="border-2 border-dashed rounded-xl p-5 transition-all duration-500"
        style={{ borderColor: sandboxStyle.border, background: sandboxStyle.bg }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: shadowState === 'idle' ? '#8A8F98' : '#f59e0b' }} />
            <span className="text-xs font-mono font-semibold" style={{ color: '#8A8F98' }}>
              ISOLATED SANDBOX · --network=none · Timeout 10min
            </span>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
            style={statusPillStyle}
          >
            {shadowState?.toUpperCase()}
          </span>
        </div>

        {/* Container icon */}
        <div className="flex justify-center mb-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all border-2"
            style={{
              background: shadowState === 'passed' ? 'rgba(34,197,94,0.12)'
                        : shadowState === 'failed' ? 'rgba(244,63,94,0.12)'
                        : 'rgba(255,255,255,0.04)',
              borderColor: shadowState === 'passed' ? 'rgba(34,197,94,0.4)'
                         : shadowState === 'failed' ? 'rgba(244,63,94,0.4)'
                         : 'rgba(255,255,255,0.1)',
              borderStyle: shadowState === 'idle' ? 'dashed' : 'solid',
            }}
          >
            {shadowState === 'passed' ? <CheckCircle className="w-10 h-10" style={{ color: '#22c55e' }} /> :
             shadowState === 'failed' ? <XCircle className="w-10 h-10" style={{ color: '#f43f5e' }} /> :
             shadowState !== 'idle'   ? <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#f59e0b' }} /> :
             <Container className="w-10 h-10" style={{ color: 'rgba(255,255,255,0.2)' }} />}
          </div>
        </div>

        {/* Step pipeline */}
        <div className="space-y-2.5">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStepIdx && shadowState !== 'idle' && shadowState !== 'passed' && shadowState !== 'failed';
            return (
              <div key={step.key} className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#f59e0b' }} />
                ) : shadowState === 'failed' && !step.done ? (
                  <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f43f5e' }} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                )}
                <span
                  className="text-xs"
                  style={{
                    color: step.done  ? '#EDEDEF' : isActive ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Failure summary banner ── */}
      {failedTests.length > 0 && (
        <div
          className="rounded-lg p-4"
          style={{ border: '1px solid rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.08)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4" style={{ color: '#f43f5e' }} />
            <span className="text-xs font-semibold" style={{ color: '#fb7185' }}>
              {failedTests.length} test(s) failed
            </span>
          </div>
          <div className="space-y-1">
            {failedTests.map((t, i) => (
              <div key={i} className="text-xs font-mono" style={{ color: '#fb7185' }}>
                • {STEP_LABELS[t.test_name] || t.test_name}:{' '}
                {(t.output || '').split('\n').find(l => l.includes('ERROR') || l.includes('error') || l.includes('failed')) || t.output?.slice(0, 120)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Live test results table ── */}
      {liveMerged.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-2.5 flex items-center gap-2" style={{ color: '#8A8F98' }}>
            <Zap className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            Test Results
          </h4>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Test', 'Result', 'Output'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-semibold uppercase tracking-[0.07em]"
                      style={{ color: '#8A8F98', fontSize: '10px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveMerged.map((test, i) => <TestRow key={i} test={test} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Historical grouped by attempt ── */}
      {groupedHistory.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold mb-2.5" style={{ color: '#8A8F98' }}>
            Previous Verification Attempts
          </h4>
          <div className="space-y-2">
            {groupedHistory.slice(1).map(([actionId, tests]) => {
              const allPassed = tests.every(t => t.passed);
              return (
                <div
                  key={actionId}
                  className="rounded-lg p-3"
                  style={{
                    border: `1px solid ${allPassed ? 'rgba(34,197,94,0.2)' : 'rgba(244,63,94,0.2)'}`,
                    background: allPassed ? 'rgba(34,197,94,0.05)' : 'rgba(244,63,94,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {allPassed
                      ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                      : <XCircle className="w-3.5 h-3.5" style={{ color: '#f43f5e' }} />}
                    <span className="font-semibold" style={{ color: '#EDEDEF' }}>Action #{actionId}</span>
                    <span
                      className="px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        fontSize: '10px',
                        color: allPassed ? '#4ade80' : '#fb7185',
                        background: allPassed ? 'rgba(34,197,94,0.12)' : 'rgba(244,63,94,0.12)',
                      }}
                    >
                      {allPassed ? 'PASSED' : 'FAILED'}
                    </span>
                    <span style={{ color: '#8A8F98' }}>{tests.length} tests</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Idle / success state ── */}
      {shadowState === 'idle' && liveMerged.length === 0 && (
        <div
          className="text-center py-10 text-sm rounded-xl border"
          style={{ background: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.15)', color: '#8A8F98' }}
        >
          <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#22c55e' }} />
          <p className="font-medium" style={{ color: '#4ade80' }}>No Shadow Verifications Required</p>
          <p className="mt-1 text-xs">
            Shadow verification runs automatically when a fix is proposed after a deployment failure.<br/>
            This deployment succeeded on the first attempt.
          </p>
        </div>
      )}
    </div>
  );
}
