import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Database, Cpu, Bot, Shield, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Dark InfoCard ─────────────────────────────────────────────
function InfoCard({ icon: Icon, title, value, mono = false, status }) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: '#8A8F98' }} />
        <span
          className="text-xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: '#8A8F98' }}
        >
          {title}
        </span>
        {status === 'ok'    && <CheckCircle className="w-3 h-3 ml-auto" style={{ color: '#22c55e' }} />}
        {status === 'error' && <XCircle     className="w-3 h-3 ml-auto" style={{ color: '#f43f5e' }} />}
      </div>
      <p
        className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}
        style={{ color: '#EDEDEF' }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Stagger animation ─────────────────────────────────────────
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  // ── Data fetching (completely unchanged) ──────────────────
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(setHealth)
      .catch(() => {});
  }, []);

  // ─────────────────────────────────────────────────────────
  return (
    <motion.div
      className="p-6"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <div className="max-w-3xl">

        {/* ── Header ── */}
        <motion.div className="mb-8" variants={fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-[0.09em] mb-2" style={{ color: '#8A8F98' }}>
            CloudForge / Configuration
          </p>
          <h1
            className="text-2xl font-bold tracking-tight mb-2"
            style={{ color: '#EDEDEF', letterSpacing: '-0.02em' }}
          >
            Settings
          </h1>
          <p className="text-sm" style={{ color: '#8A8F98', lineHeight: '1.6' }}>
            Platform configuration and environment overview
          </p>
        </motion.div>

        {/* ── Platform Status ── */}
        <motion.div
          className="rounded-lg p-5 mb-8"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
          variants={fadeUp}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: '#8A8F98' }}
          >
            Platform Info
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <InfoCard icon={Database} title="Database" value="PostgreSQL 16"     status={health ? 'ok' : 'error'} />
            <InfoCard icon={Cpu}      title="Backend"  value="FastAPI + Uvicorn" status={health ? 'ok' : 'error'} />
            <InfoCard icon={Bot}      title="Cloud LLM" value="Moonshot AI (Kimi)" />
          </div>
        </motion.div>

        {/* ── LLM Config ── */}
        <motion.div className="mb-8" variants={fadeUp}>
          <h2
            className="text-xs font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: '#8A8F98' }}
          >
            AI / LLM Configuration
          </h2>
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.07em]" style={{ color: '#8A8F98' }}>Variable</th>
                  <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.07em]" style={{ color: '#8A8F98' }}>Value</th>
                  <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.07em]" style={{ color: '#8A8F98' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['OLLAMA_HOST',               'http://localhost:11434',       'Local Ollama inference server'],
                  ['OLLAMA_MODEL',              'qwen2.5-coder:7b-instruct',   'Primary local model'],
                  ['LOCAL_CONFIDENCE_THRESHOLD','0.75',                         'Min confidence before cloud escalation'],
                  ['CLOUD_LLM_PROVIDER',        'anthropic | glm | nvidia_nim', 'Active cloud LLM provider'],
                ].map(([key, val, desc]) => (
                  <tr
                    key={key}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <td
                      className="px-4 py-3 font-mono font-medium"
                      style={{ color: '#EDEDEF' }}
                    >
                      {key}
                    </td>
                    <td
                      className="px-4 py-3 font-mono"
                      style={{ color: '#5E6AD2' }}
                    >
                      {val}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: '#8A8F98' }}
                    >
                      {desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs" style={{ color: '#8A8F98' }}>
            Configure these values in your <span className="font-mono" style={{ color: '#EDEDEF' }}>.env</span> file and restart the backend.
          </p>
        </motion.div>

        {/* ── AWS ── */}
        <motion.div className="mb-8" variants={fadeUp}>
          <h2
            className="text-xs font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: '#8A8F98' }}
          >
            AWS Infrastructure
          </h2>
          <div
            className="p-4 rounded-lg flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: '#EDEDEF' }}>AWS Setup Wizard</p>
              <p className="text-xs mt-0.5" style={{ color: '#8A8F98' }}>
                Auto-configure Security Groups, Key Pairs, AMI detection
              </p>
            </div>
            <Link
              to="/aws-setup"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-md border transition-all duration-150"
              style={{
                background: '#5E6AD2',
                borderColor: 'rgba(94,106,210,0.4)',
                boxShadow: '0 0 12px rgba(94,106,210,0.2)',
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Wizard
            </Link>
          </div>
        </motion.div>

        {/* ── Security ── */}
        <motion.div className="mb-8" variants={fadeUp}>
          <h2
            className="text-xs font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: '#8A8F98' }}
          >
            Security Controls
          </h2>
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
              <div key={i} className="flex items-start gap-2.5 text-xs" style={{ color: '#8A8F98' }}>
                <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Version ── */}
        <motion.div
          className="pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          variants={fadeUp}
        >
          <p className="text-xs font-mono" style={{ color: '#8A8F98' }}>
            CloudForge v4.0 · Capstone · FastAPI 0.115.0 · React 18.2.0 · PostgreSQL 16
          </p>
        </motion.div>

      </div>
    </motion.div>
  );
}
