import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const STEPS = [
  { key: 'validating_iam',  label: 'Validate IAM Permissions',  detail: 'sts:GetCallerIdentity + ec2:DescribeInstances' },
  { key: 'detecting_vpc',   label: 'Detect VPC & Subnet',       detail: 'Find default VPC and public subnet' },
  { key: 'creating_sg',     label: 'Create Security Group',     detail: 'cloudforge-sg-<timestamp> with SSH+HTTP rules' },
  { key: 'creating_keypair',label: 'Generate Key Pair',         detail: 'cloudforge-key-<timestamp>.pem → keys/' },
  { key: 'detecting_ami',   label: 'Detect Ubuntu AMI',         detail: 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-*' },
  { key: 'complete',        label: 'Persist Configuration',     detail: 'Write to aws_setup_state table' },
];

function StepRow({ step, status, logs }) {
  const [expanded, setExpanded] = useState(status === 'active' || status === 'done' || status === 'failed');

  useEffect(() => {
    if (status === 'active') setExpanded(true);
  }, [status]);

  return (
    <div className={`border rounded mb-2 transition-all ${
      status === 'active' ? 'border-indigo-300 bg-indigo-50' :
      status === 'done'   ? 'border-emerald-200 bg-emerald-50' :
      status === 'failed' ? 'border-red-200 bg-red-50' :
      'border-gray-200 bg-white'
    }`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          {status === 'done'   ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
           status === 'active' ? <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /> :
           status === 'failed' ? <XCircle className="w-4 h-4 text-red-500" /> :
           <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
        </div>
        <span className={`text-[13px] font-medium flex-1 ${
          status === 'done' ? 'text-emerald-700' :
          status === 'active' ? 'text-indigo-700' :
          status === 'failed' ? 'text-red-700' : 'text-gray-500'
        }`}>
          {step.label}
        </span>
        <span className="text-[11px] text-gray-400">{step.detail}</span>
        {logs?.length > 0 && (
          expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
      {expanded && logs?.length > 0 && (
        <div className="mx-4 mb-3 bg-gray-900 rounded p-3 font-mono text-[11px] text-gray-300 max-h-32 overflow-y-auto">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

export default function AWSSetup() {
  const [setupStatus, setSetupStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [stepLogs, setStepLogs] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);
  const [failedStep, setFailedStep] = useState(null);
  const [finalConfig, setFinalConfig] = useState(null);
  const wsRef = useRef(null);
  const [form, setForm] = useState({
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    allowed_ssh_cidr: '0.0.0.0/0',
  });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetch('/api/aws/setup/status', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { 
        setSetupStatus(d); 
        if (d && d.status === 'complete') {
          setFinalConfig(d);
          setCompletedSteps(STEPS.map(s => s.key));
        }
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, []);

  const connectWS = () => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/api/aws/ws`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      const { step, detail } = data;

      if (step === 'complete') {
        setCurrentStep(null);
        setCompletedSteps(prev => [...STEPS.map(s => s.key)]);
        fetch('/api/aws/setup/status', { cache: 'no-store' }).then(r => r.json()).then(d => { setFinalConfig(d); setSetupStatus(d); });
      } else if (step === 'failed') {
        setFailedStep(detail);
        setRunning(false);
      } else {
        setCurrentStep(step);
        setStepLogs(prev => ({ ...prev, [step]: [...(prev[step] || []), detail] }));
        const idx = STEPS.findIndex(s => s.key === step);
        if (idx > 0) {
          setCompletedSteps(prev => {
            const done = STEPS.slice(0, idx).map(s => s.key);
            return done.filter(k => !prev.includes(k)).concat(prev);
          });
        }
      }
    };

    ws.onclose = () => {};
  };

  const handleRun = async (e) => {
    e.preventDefault();
    if (!form.aws_access_key_id || !form.aws_secret_access_key) {
      setFormError('AWS Access Key ID and Secret are required');
      return;
    }
    setFormError(null);
    setRunning(true);
    setStepLogs({});
    setCompletedSteps([]);
    setFailedStep(null);
    setCurrentStep('validating_iam');

    try {
      await fetch('/api/aws/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      connectWS();
    } catch (err) {
      setFormError(err.message);
      setRunning(false);
    }
  };

  const getStepStatus = (stepKey) => {
    if (completedSteps.includes(stepKey)) return 'done';
    if (currentStep === stepKey) return 'active';
    if (failedStep && currentStep === stepKey) return 'failed';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const isComplete = setupStatus?.status === 'complete' && !running;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold text-gray-900">AWS Setup Wizard</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Automate AWS Day-0 prerequisites — Security Group, Key Pair, AMI detection, IAM validation.
          </p>
        </div>

        {/* Already configured banner */}
        {isComplete && !running && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-emerald-800">AWS Infrastructure Configured</p>
                <p className="text-[12px] text-emerald-600 mt-0.5">
                  SG: <span className="font-mono">{setupStatus?.sg_id || 'N/A'}</span> ·
                  Key: <span className="font-mono">{setupStatus?.key_pair_name || 'N/A'}</span> ·
                  Region: <span className="font-mono">{setupStatus?.region || 'us-east-1'}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={async () => {
                if(!confirm('Are you sure you want to remove AWS credentials? This will drop the setup state entirely.')) return;
                try {
                  const r = await fetch('/api/aws/credentials', { method: 'DELETE' });
                  if(r.ok) {
                    setSetupStatus(null);
                    setFinalConfig(null);
                    setCompletedSteps([]);
                  }
                } catch(e) {}
              }}
              className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 font-medium text-[12px] rounded transition-colors"
            >
              Remove Credentials
            </button>
          </div>
        )}

        <div className="flex gap-6">
          {/* Left: Stepper */}
          <div className="w-64 flex-shrink-0">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Setup Steps</p>
              </div>
              <div className="p-3">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step.key);
                  return (
                    <div key={step.key} className="flex items-center gap-2.5 py-2">
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                        {status === 'done'   ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                         status === 'active' ? <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /> :
                         status === 'failed' ? <XCircle className="w-4 h-4 text-red-500" /> :
                         <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center">
                           <span className="text-[9px] text-gray-400 font-mono">{idx + 1}</span>
                         </div>}
                      </div>
                      <span className={`text-[12px] ${
                        status === 'done' ? 'text-emerald-700 font-medium' :
                        status === 'active' ? 'text-indigo-700 font-medium' :
                        status === 'failed' ? 'text-red-700' : 'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Form / Progress */}
          <div className="flex-1">
            {!running && !isComplete ? (
              <form onSubmit={handleRun} className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded text-[12px] text-amber-700 flex gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    Credentials are used only for initial setup and stored in your .env file.
                    They are never logged or transmitted to any LLM provider.
                  </div>
                </div>

                {[
                  { key: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'password', placeholder: 'AKIA...' },
                  { key: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••••••••••' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">AWS Region</label>
                    <select
                      value={form.aws_region}
                      onChange={e => setForm(prev => ({ ...prev, aws_region: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-central-1','ap-southeast-1','ap-south-1'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Allowed SSH CIDR</label>
                    <input
                      value={form.allowed_ssh_cidr}
                      onChange={e => setForm(prev => ({ ...prev, allowed_ssh_cidr: e.target.value }))}
                      placeholder="0.0.0.0/0"
                      className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {form.allowed_ssh_cidr === '0.0.0.0/0' && (
                      <p className="text-[10px] text-amber-600 mt-1">⚠ 0.0.0.0/0 allows SSH from any IP</p>
                    )}
                  </div>
                </div>

                {formError && (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 text-[13px] font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-all"
                >
                  Run Full Setup
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                {STEPS.map(step => (
                  <StepRow
                    key={step.key}
                    step={step}
                    status={getStepStatus(step.key)}
                    logs={stepLogs[step.key]}
                  />
                ))}

                {failedStep && (
                  <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-[13px] font-medium text-red-800">Setup Failed</p>
                    <p className="text-[12px] text-red-600 mt-1 font-mono">{failedStep}</p>
                    <button
                      onClick={() => { setRunning(false); setFailedStep(null); }}
                      className="mt-3 px-3 py-1.5 text-[12px] font-medium text-white bg-red-600 rounded hover:bg-red-700"
                    >
                      Retry Setup
                    </button>
                  </div>
                )}

                {finalConfig && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded">
                    <p className="text-[13px] font-semibold text-emerald-800 mb-3">✓ Setup Complete</p>
                    <table className="w-full text-[12px]">
                      <tbody className="space-y-1">
                        {[
                          ['Security Group', finalConfig.sg_id],
                          ['Key Pair', finalConfig.key_pair_name],
                          ['AMI ID', finalConfig.ami_id],
                          ['Region', finalConfig.region],
                          ['Instance Type', finalConfig.instance_type || 't3.small'],
                        ].map(([k, v]) => v && (
                          <tr key={k} className="border-b border-emerald-100">
                            <td className="py-1.5 text-emerald-700 font-medium pr-4">{k}</td>
                            <td className="py-1.5 font-mono text-emerald-800">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Link to="/" className="mt-3 inline-block px-3 py-1.5 text-[12px] font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700">
                      Return to Dashboard
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
