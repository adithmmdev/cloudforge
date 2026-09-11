import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

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

  const styleMap = {
    active: { border: 'rgba(94,106,210,0.4)',   bg: 'rgba(94,106,210,0.05)',   text: '#818cf8', icon: <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} /> },
    done:   { border: 'rgba(34,197,94,0.3)',    bg: 'rgba(34,197,94,0.05)',    text: '#4ade80', icon: <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} /> },
    failed: { border: 'rgba(244,63,94,0.4)',    bg: 'rgba(244,63,94,0.05)',    text: '#fb7185', icon: <XCircle className="w-4 h-4" style={{ color: '#f43f5e' }} /> },
    pending:{ border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)',  text: '#8A8F98', icon: <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }} /> }
  };
  const s = styleMap[status] || styleMap.pending;

  return (
    <div className="rounded mb-2 transition-all duration-300" style={{ border: `1px solid ${s.border}`, background: s.bg }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">{s.icon}</div>
        <span className="text-[13px] font-medium flex-1 transition-colors" style={{ color: s.text }}>
          {step.label}
        </span>
        <span className="text-[11px] font-mono" style={{ color: '#8A8F98' }}>{step.detail}</span>
        {logs?.length > 0 && (
          expanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#8A8F98' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#8A8F98' }} />
        )}
      </button>
      {expanded && logs?.length > 0 && (
        <div className="mx-4 mb-3 rounded p-3 font-mono text-[11px] max-h-32 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(237,237,239,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
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
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5E6AD2' }} />
      </div>
    );
  }

  const isComplete = setupStatus?.status === 'complete' && !running;

  return (
    <motion.div 
      className="p-8"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#EDEDEF]">AWS Infrastructure Setup</h1>
          <p className="text-sm mt-1" style={{ color: '#8A8F98' }}>
            Automate AWS Day-0 prerequisites — Security Group, Key Pair, AMI detection, IAM validation.
          </p>
        </div>

        {isComplete && !running && (
          <div className="mb-6 px-4 py-3 rounded flex items-center justify-between gap-3 shadow-sm"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#4ade80' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>AWS Infrastructure Configured</p>
                <p className="text-[12px] mt-0.5" style={{ color: '#22c55e' }}>
                  SG: <span className="font-mono bg-black/20 px-1 rounded">{setupStatus?.sg_id || 'N/A'}</span> ·{' '}
                  Key: <span className="font-mono bg-black/20 px-1 rounded">{setupStatus?.key_pair_name || 'N/A'}</span> ·{' '}
                  Region: <span className="font-mono bg-black/20 px-1 rounded">{setupStatus?.region || 'us-east-1'}</span>
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
              className="px-3 py-1.5 font-medium text-[12px] rounded transition-all shadow-sm"
              style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.15)'}
            >
              Remove Credentials
            </button>
          </div>
        )}

        <div className="flex gap-8">
          <div className="w-64 flex-shrink-0">
            <div className="rounded-xl overflow-hidden shadow-sm cf-card">
              <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A8F98' }}>Setup Pipeline</p>
              </div>
              <div className="p-3">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step.key);
                  const styleMap = {
                    done:   { color: '#4ade80', icon: <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} /> },
                    active: { color: '#818cf8', icon: <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} /> },
                    failed: { color: '#fb7185', icon: <XCircle className="w-4 h-4" style={{ color: '#f43f5e' }} /> },
                    pending:{ color: '#8A8F98', icon: <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.1)' }}><span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{idx + 1}</span></div> }
                  };
                  const s = styleMap[status];

                  return (
                    <div key={step.key} className="flex items-center gap-2.5 py-2">
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{s.icon}</div>
                      <span className="text-[12px] font-medium transition-colors" style={{ color: s.color }}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {!running && !isComplete ? (
              <form onSubmit={handleRun} className="space-y-5 p-6 rounded-xl shadow-sm cf-card">
                <div className="p-4 rounded text-[12px] flex gap-2" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    Credentials are used only for initial setup and stored securely in your .env file.
                    They are never logged or transmitted to any LLM provider.
                  </div>
                </div>

                {[
                  { key: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'password', placeholder: 'AKIA...' },
                  { key: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password', placeholder: '••••••••••••••••••••••••••••••••••••••••' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8A8F98' }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 border rounded font-mono text-sm transition-all focus:outline-none"
                      style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                      onFocus={e => e.target.style.borderColor = '#5E6AD2'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      required
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8A8F98' }}>AWS Region</label>
                    <select
                      value={form.aws_region}
                      onChange={e => setForm(prev => ({ ...prev, aws_region: e.target.value }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
                      style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                      onFocus={e => e.target.style.borderColor = '#5E6AD2'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    >
                      {['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-central-1','ap-southeast-1','ap-south-1'].map(r => (
                        <option key={r} value={r} style={{ background: '#0a0a0c', color: '#EDEDEF' }}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8A8F98' }}>Allowed SSH CIDR</label>
                    <input
                      value={form.allowed_ssh_cidr}
                      onChange={e => setForm(prev => ({ ...prev, allowed_ssh_cidr: e.target.value }))}
                      placeholder="0.0.0.0/0"
                      className="w-full px-3 py-2 border rounded font-mono text-sm focus:outline-none"
                      style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                      onFocus={e => e.target.style.borderColor = '#5E6AD2'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                    {form.allowed_ssh_cidr === '0.0.0.0/0' && (
                      <p className="text-[10px] mt-1.5 font-medium" style={{ color: '#fbbf24' }}>⚠ 0.0.0.0/0 allows SSH from any IP</p>
                    )}
                  </div>
                </div>

                {formError && (
                  <div className="px-3 py-2 rounded text-[12px] font-medium" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}>
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 text-sm font-semibold rounded transition-all shadow-sm flex items-center justify-center gap-2"
                  style={{ background: '#5E6AD2', color: '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#6872D9'}
                  onMouseLeave={e => e.currentTarget.style.background = '#5E6AD2'}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Run Full Setup Pipeline
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                {STEPS.map(step => (
                  <StepRow
                    key={step.key}
                    step={step}
                    status={getStepStatus(step.key)}
                    logs={stepLogs[step.key]}
                  />
                ))}

                {failedStep && (
                  <div className="mt-4 px-4 py-3 rounded" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    <p className="text-[13px] font-semibold" style={{ color: '#f43f5e' }}>Setup Failed</p>
                    <p className="text-[12px] mt-1 font-mono" style={{ color: '#fb7185' }}>{failedStep}</p>
                    <button
                      onClick={() => { setRunning(false); setFailedStep(null); }}
                      className="mt-3 px-3 py-1.5 text-[12px] font-bold rounded hover:opacity-90"
                      style={{ background: '#f43f5e', color: '#fff' }}
                    >
                      Retry Setup
                    </button>
                  </div>
                )}

                {finalConfig && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 p-6 rounded-xl border shadow-lg"
                    style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.02) 100%)', borderColor: 'rgba(34,197,94,0.2)' }}
                  >
                    <p className="text-[15px] font-bold mb-4 flex items-center gap-2" style={{ color: '#4ade80' }}>
                      <CheckCircle className="w-5 h-5" /> Setup Verified & Complete
                    </p>
                    <table className="w-full text-[13px]">
                      <tbody className="space-y-1">
                        {[
                          ['Security Group', finalConfig.sg_id],
                          ['Key Pair', finalConfig.key_pair_name],
                          ['AMI ID', finalConfig.ami_id],
                          ['Region', finalConfig.region],
                          ['Instance Type', finalConfig.instance_type || 't3.small'],
                        ].map(([k, v]) => v && (
                          <tr key={k} style={{ borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
                            <td className="py-2.5 font-medium pr-4" style={{ color: '#8A8F98' }}>{k}</td>
                            <td className="py-2.5 font-mono text-right font-semibold" style={{ color: '#EDEDEF' }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-6 flex justify-end">
                      <Link 
                        to="/" 
                        className="px-4 py-2 text-[13px] font-bold rounded shadow-sm hover:opacity-90 transition-opacity"
                        style={{ background: '#22c55e', color: '#fff' }}
                      >
                        Launch Mission Control
                      </Link>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
