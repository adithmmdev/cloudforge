import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Database, Cpu, Bot, Shield, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

function InfoCard({ icon: Icon, title, value, mono = false, status }) {
  return (
    <div className="p-4 border border-gray-200 rounded bg-white">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        {status === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
        {status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500 ml-auto" />}
      </div>
      <p className={`text-[13px] text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export default function SettingsPage() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.ok ? r.json() : null).then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold text-gray-900">Settings</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Platform configuration and environment overview</p>
        </div>

        {/* Platform Status */}
          <div className="bg-white rounded border border-gray-200 p-5 mb-8">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Platform Info</h2>
            <div className="grid grid-cols-3 gap-3">
              <InfoCard icon={Database} title="Database" value="PostgreSQL 16" status={health ? 'ok' : 'error'} />
              <InfoCard icon={Cpu} title="Backend" value="FastAPI + Uvicorn" status={health ? 'ok' : 'error'} />
              <InfoCard icon={Bot} title="Cloud LLM" value="Moonshot AI (Kimi)" />
            </div>
          </div>

        {/* LLM Config */}
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold text-gray-700 mb-3">AI / LLM Configuration</h2>
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Variable</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['OLLAMA_HOST', 'http://localhost:11434', 'Local Ollama inference server'],
                  ['OLLAMA_MODEL', 'qwen2.5-coder:7b-instruct', 'Primary local model'],
                  ['LOCAL_CONFIDENCE_THRESHOLD', '0.75', 'Min confidence before cloud escalation'],
                  ['CLOUD_LLM_PROVIDER', 'anthropic | glm | nvidia_nim', 'Active cloud LLM provider'],
                ].map(([key, val, desc]) => (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">{key}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-indigo-600">{val}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-500">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Configure these values in your <span className="font-mono">.env</span> file and restart the backend.</p>
        </div>

        {/* AWS */}
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold text-gray-700 mb-3">AWS Infrastructure</h2>
          <div className="p-4 border border-gray-200 rounded bg-gray-50 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-gray-700">AWS Setup Wizard</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Auto-configure Security Groups, Key Pairs, AMI detection</p>
            </div>
            <Link
              to="/aws-setup"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Wizard
            </Link>
          </div>
        </div>

        {/* Security Info */}
        <div className="mb-8">
          <h2 className="text-[13px] font-semibold text-gray-700 mb-3">Security Controls</h2>
          <div className="space-y-2">
            {[
              'Docker build always uses --network=none (prevents exfiltration during build)',
              'User-supplied Dockerfiles are ignored — CloudForge generates them from templates',
              'Raw source code is never sent to cloud LLMs — only redacted 7-field signatures',
              'All cloud LLM disclosures are logged verbatim in the Disclosure Ledger',
              'EC2 provisioning is hard-capped at MAX_EC2_INSTANCES',
              'Runtime containers: --memory=256m --cpus=0.5 --pids-limit=100',
              'Remediation actions restricted to 7 safe grammar operations (no shell injection possible)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
                <Shield className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Version */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-[11px] text-gray-400 font-mono">CloudForge v4.0 · Capstone · FastAPI 0.115.0 · React 18.2.0 · PostgreSQL 16</p>
        </div>
      </div>
    </div>
  );
}
