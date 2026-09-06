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

function TestRow({ test }) {
  const [expanded, setExpanded] = useState(!test.passed);

  return (
    <>
      <tr className={`border-b border-gray-100 ${!test.passed ? 'bg-red-50/30' : ''}`}>
        <td className="px-4 py-2.5 font-mono text-[11px] text-gray-700">
          {STEP_LABELS[test.test_name] || test.test_name}
        </td>
        <td className="px-4 py-2.5">
          {test.passed ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-[10px] font-medium">
              <CheckCircle className="w-3 h-3" /> PASS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded text-[10px] font-medium">
              <XCircle className="w-3 h-3" /> FAIL
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500 max-w-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{(test.output || '—').split('\n')[0].slice(0, 80)}</span>
            {test.output && test.output.length > 80 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 flex-shrink-0"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Less' : 'Full'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && test.output && test.output.length > 80 && (
        <tr className={!test.passed ? 'bg-red-50/50' : 'bg-gray-50'}>
          <td colSpan={3} className="px-4 py-3">
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-[10px] text-gray-300 max-h-64 overflow-auto whitespace-pre-wrap leading-relaxed">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-800">
                <Terminal className="w-3 h-3 text-gray-500" />
                <span className="text-gray-500 uppercase tracking-wider text-[9px]">
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

export default function ShadowVerificationTab({ deploymentId, shadowTests, shadowState }) {
  const [historical, setHistorical] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState([]);
  const [runningManual, setRunningManual] = useState(false);

  useEffect(() => {
    if (!deploymentId) return;
    fetch(`/api/deployments/${deploymentId}/shadow-tests`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (!Array.isArray(d)) return;
        setHistorical(d);
        // Group by remediation_action_id
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
    }
    // We don't setRunningManual(false) immediately because the websocket will update the state
    // but just in case, we can set it back after a timeout or let parent update props.
    // The main bug was setShadowState() crashing the app.
  };

  // Live shadow tests merged with historical
  const liveMerged = [
    ...historical,
    ...shadowTests.filter(t => !historical.find(h => h.id === t.id || (h.test_name === t.test_name && h.remediation_action_id === t.remediation_action_id)))
  ];

  const SANDBOX_STYLES = {
    idle:     'border-gray-300 bg-gray-50',
    building: 'border-amber-400 bg-amber-50',
    testing:  'border-indigo-300 bg-indigo-50',
    passed:   'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100',
    failed:   'border-red-400 bg-red-50 shadow-lg shadow-red-100',
  };

  const STEPS = [
    { key: 'template',  label: 'Regenerate Dockerfiles from Templates',    done: ['building','testing','passed','failed'].includes(shadowState) },
    { key: 'deps',      label: 'Materialize npm/pip Dependencies (cached)', done: ['building','testing','passed','failed'].includes(shadowState) },
    { key: 'building',  label: 'Build Isolated Image (--network=none)',     done: ['testing','passed','failed'].includes(shadowState) },
    { key: 'testing',   label: 'Run Smoke Tests (HTTP health checks)',       done: ['passed','failed'].includes(shadowState) },
  ];

  const currentStepIdx = STEPS.findIndex(s => !s.done);
  const failedTests = liveMerged.filter(t => !t.passed);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-gray-700">Shadow Verification Gate</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Proposed fix is built and smoke-tested in an isolated container before promotion to EC2.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={handleManualVerification}
            disabled={runningManual || shadowState === 'building' || shadowState === 'testing'}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[11px] font-medium transition-all ${
              (runningManual || shadowState === 'building' || shadowState === 'testing')
                ? 'bg-indigo-100 text-indigo-400 border-indigo-200 cursor-not-allowed shadow-inner'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 shadow-sm hover:shadow'
            }`}
          >
            {(runningManual || shadowState === 'building' || shadowState === 'testing') ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span className="animate-pulse text-indigo-600">Verifying Sandbox...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Manual Verification
              </>
            )}
          </button>
          <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] text-indigo-600 font-medium font-mono">--network=none</span>
          </div>
        </div>
      </div>

      {/* Sandbox visualization */}
      <div className={`border-2 border-dashed rounded-xl p-5 transition-all duration-500 ${SANDBOX_STYLES[shadowState] || SANDBOX_STYLES.idle}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${shadowState === 'idle' ? 'text-gray-400' : 'text-amber-500'}`} />
            <span className="text-[11px] font-mono font-semibold text-gray-600">
              ISOLATED SANDBOX · --network=none · Timeout 10min
            </span>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
            shadowState === 'passed' ? 'bg-emerald-100 text-emerald-700' :
            shadowState === 'failed' ? 'bg-red-100 text-red-700' :
            shadowState === 'idle'   ? 'bg-gray-100 text-gray-500' :
            'bg-amber-100 text-amber-700'
          }`}>
            {shadowState?.toUpperCase()}
          </span>
        </div>

        {/* Container icon */}
        <div className="flex justify-center mb-5">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all border-2 ${
            shadowState === 'passed' ? 'bg-emerald-100 border-emerald-300' :
            shadowState === 'failed' ? 'bg-red-100 border-red-300' :
            'bg-white border-dashed border-gray-300'
          }`}>
            {shadowState === 'passed' ? <CheckCircle className="w-10 h-10 text-emerald-500" /> :
             shadowState === 'failed' ? <XCircle className="w-10 h-10 text-red-500" /> :
             shadowState !== 'idle'   ? <Loader2 className="w-10 h-10 text-amber-500 animate-spin" /> :
             <Container className="w-10 h-10 text-gray-300" />}
          </div>
        </div>

        {/* Step pipeline */}
        <div className="space-y-2.5">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStepIdx && shadowState !== 'idle' && shadowState !== 'passed' && shadowState !== 'failed';
            return (
              <div key={step.key} className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                ) : shadowState === 'failed' && !step.done ? (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={`text-[12px] ${
                  step.done  ? 'text-gray-700' :
                  isActive   ? 'text-amber-700 font-medium' :
                  shadowState === 'idle' ? 'text-gray-400' :
                  'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Failure summary banner */}
      {failedTests.length > 0 && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-[12px] font-semibold text-red-700">{failedTests.length} test(s) failed</span>
          </div>
          <div className="space-y-1">
            {failedTests.map((t, i) => (
              <div key={i} className="text-[11px] text-red-600 font-mono">
                • {STEP_LABELS[t.test_name] || t.test_name}: {(t.output || '').split('\n').find(l => l.includes('ERROR') || l.includes('error') || l.includes('failed')) || t.output?.slice(0, 120)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live test results table */}
      {liveMerged.length > 0 && (
        <div>
          <h4 className="text-[12px] font-semibold text-gray-600 mb-2.5 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Test Results
          </h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Test</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-24">Result</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Output</th>
                </tr>
              </thead>
              <tbody>
                {liveMerged.map((test, i) => <TestRow key={i} test={test} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical grouped by attempt */}
      {groupedHistory.length > 1 && (
        <div>
          <h4 className="text-[12px] font-semibold text-gray-600 mb-2.5">Previous Verification Attempts</h4>
          <div className="space-y-2">
            {groupedHistory.slice(1).map(([actionId, tests]) => {
              const allPassed = tests.every(t => t.passed);
              return (
                <div key={actionId} className={`border rounded-lg p-3 ${allPassed ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-center gap-2 text-[11px]">
                    {allPassed
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span className="font-semibold text-gray-700">Action #{actionId}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {allPassed ? 'PASSED' : 'FAILED'}
                    </span>
                    <span className="text-gray-400">{tests.length} tests</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shadowState === 'idle' && liveMerged.length === 0 && (
        <div className="text-center py-10 text-[13px] text-gray-400 bg-emerald-50/30 rounded-xl border border-emerald-100">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <p className="text-emerald-700 font-medium">No Shadow Verifications Required</p>
          <p className="mt-1">Shadow verification runs automatically when a fix is proposed after a deployment failure.<br/>This deployment succeeded on the first attempt.</p>
        </div>
      )}
    </div>
  );
}
