import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Link2, File, X, AlertCircle, CheckCircle, Loader2, Github } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Utility (unchanged) ───────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── Framework display config ───────────────────────────────────
const FRAMEWORK_INFO = {
  react:   { label: 'React',      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  express: { label: 'Express',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  flask:   { label: 'Flask',      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  fastapi: { label: 'FastAPI',    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  mern:    { label: 'MERN Stack', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
};

// ── Shared input styles ───────────────────────────────────────
const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: '6px',
  color: '#EDEDEF',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  transition: 'border-color 160ms ease, box-shadow 160ms ease',
};

// ─────────────────────────────────────────────────────────────
export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ── All state (completely unchanged) ─────────────────────
  const [mode, setMode]                       = useState('zip');
  const [file, setFile]                       = useState(null);
  const [isDragging, setIsDragging]           = useState(false);
  const [repoUrl, setRepoUrl]                 = useState('');
  const [branch, setBranch]                   = useState('main');
  const [loading, setLoading]                 = useState(false);
  const [loadingStep, setLoadingStep]         = useState('');
  const [error, setError]                     = useState(null);
  const [detectedFramework, setDetectedFramework] = useState(null);

  // ── File handler (completely unchanged) ───────────────────
  const handleFile = useCallback((f) => {
    if (!f) return;
    if (!f.name.endsWith('.zip')) { setError('Only .zip files are supported'); return; }
    if (f.size > 100 * 1024 * 1024) { setError('File too large. Maximum size is 100MB'); return; }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // ── Submit handler (completely unchanged) ─────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setDetectedFramework(null);

    let projectData;

    try {
      setLoading(true);

      if (mode === 'zip') {
        if (!file) { setError('Please select a .zip file'); setLoading(false); return; }
        setLoadingStep('Uploading & extracting...');
        const formData = new FormData();
        formData.append('file', file);
        const res  = await fetch('/api/projects/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
        projectData = data;
      } else {
        if (!repoUrl.trim()) { setError('Please enter a repository URL'); setLoading(false); return; }
        if (!repoUrl.startsWith('https://github.com/') && !repoUrl.startsWith('https://gitlab.com/')) {
          setError('Only public GitHub or GitLab HTTPS URLs are supported');
          setLoading(false);
          return;
        }
        setLoadingStep('Cloning repository (this may take ~30 seconds)...');
        const res  = await fetch('/api/projects/from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo_url: repoUrl.trim(), branch }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
        projectData = data;
      }

      setDetectedFramework(projectData.detected_framework);
      setLoadingStep('Triggering deployment...');

      // Auto-trigger deploy (unchanged)
      const depRes  = await fetch(`/api/projects/${projectData.project_id}/deploy`, { method: 'POST' });
      const depData = await depRes.json();
      if (!depRes.ok) throw new Error(depData.detail || 'Deploy failed');

      navigate(`/projects/${projectData.project_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const fw = detectedFramework ? FRAMEWORK_INFO[detectedFramework] : null;

  // ─────────────────────────────────────────────────────────
  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] mb-2" style={{ color: '#8A8F98' }}>
            CloudForge / Projects
          </p>
          <h1
            className="text-2xl font-bold tracking-tight mb-2"
            style={{ color: '#EDEDEF', letterSpacing: '-0.02em' }}
          >
            Deploy New Project
          </h1>
          <p className="text-sm" style={{ color: '#8A8F98', lineHeight: '1.6' }}>
            Upload a .zip file or connect a public GitHub/GitLab repository. CloudForge auto-detects your framework.
          </p>
        </div>

        {/* ── Mode Toggle ── */}
        <div
          className="flex mb-6 w-fit rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)' }}
        >
          {[
            { id: 'zip', icon: UploadCloud, label: 'Upload ZIP' },
            { id: 'url', icon: Github,      label: 'GitHub / GitLab' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setError(null); }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all duration-150"
              style={{
                background:  mode === id ? '#5E6AD2' : 'transparent',
                color:       mode === id ? '#fff' : '#8A8F98',
                borderRight: id === 'zip' ? '1px solid rgba(255,255,255,0.09)' : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ── ZIP Mode ── */}
        {mode === 'zip' && (
          <div
            className="rounded-lg cursor-pointer transition-all duration-200"
            style={{
              border: isDragging
                ? '2px dashed #5E6AD2'
                : file
                ? '2px dashed rgba(34,197,94,0.5)'
                : '2px dashed rgba(255,255,255,0.12)',
              background: isDragging
                ? 'rgba(94,106,210,0.07)'
                : file
                ? 'rgba(34,197,94,0.05)'
                : 'rgba(255,255,255,0.025)',
            }}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <div className="p-10 text-center">
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle className="w-9 h-9" style={{ color: '#22c55e' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#EDEDEF' }}>{file.name}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: '#8A8F98' }}>{formatBytes(file.size)}</p>
                  </div>
                  <button
                    className="flex items-center gap-1 text-xs transition-colors duration-150"
                    style={{ color: '#8A8F98' }}
                    onClick={(e) => { e.stopPropagation(); setFile(null); setDetectedFramework(null); }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                    onMouseLeave={e => e.currentTarget.style.color = '#8A8F98'}
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <UploadCloud
                    className="w-9 h-9"
                    style={{ color: isDragging ? '#5E6AD2' : 'rgba(255,255,255,0.25)' }}
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#EDEDEF' }}>
                      Drop your .zip here, or{' '}
                      <span style={{ color: '#5E6AD2' }}>browse</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#8A8F98' }}>.zip files only · Max 100MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GitHub URL Mode ── */}
        {mode === 'url' && (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Github className="w-4 h-4" style={{ color: '#8A8F98' }} />
                <label className="text-xs font-semibold" style={{ color: '#8A8F98' }}>Repository URL</label>
              </div>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setError(null); }}
                placeholder="https://github.com/username/repo"
                style={inputStyle}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(94,106,210,0.5)';
                  e.target.style.boxShadow   = '0 0 0 3px rgba(94,106,210,0.12)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.09)';
                  e.target.style.boxShadow   = 'none';
                }}
              />
              <p className="text-xs mt-1.5" style={{ color: '#8A8F98' }}>
                Public repositories only. No authentication required.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8F98' }}>Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  style={inputStyle}
                  onFocus={e => {
                    e.target.style.borderColor = 'rgba(94,106,210,0.5)';
                    e.target.style.boxShadow   = '0 0 0 3px rgba(94,106,210,0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.09)';
                    e.target.style.boxShadow   = 'none';
                  }}
                />
              </div>
              <p className="text-xs mt-4 flex-1" style={{ color: '#8A8F98', lineHeight: '1.55' }}>
                Falls back to the default branch if the specified branch doesn't exist.
              </p>
            </div>

            {/* Quick examples */}
            <div className="text-xs" style={{ color: '#8A8F98' }}>
              <span className="font-semibold" style={{ color: '#8A8F98' }}>Examples: </span>
              {[
                'https://github.com/tiangolo/full-stack-fastapi-template',
                'https://github.com/bradtraversy/mern-tutorial',
              ].map(url => (
                <button
                  key={url}
                  onClick={() => setRepoUrl(url)}
                  className="ml-2 font-mono transition-colors duration-150"
                  style={{ color: '#5E6AD2' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#6872D9'}
                  onMouseLeave={e => e.currentTarget.style.color = '#5E6AD2'}
                >
                  {url.split('/').slice(-1)[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Framework Detection Result ── */}
        {fw && (
          <div className={`mt-4 px-4 py-3 rounded-lg border text-sm font-medium ${fw.color}`}>
            <span className="font-semibold">Detected Framework:</span> {fw.label}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div
            className="mt-4 flex items-start gap-2 px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.2)',
              color: '#fb7185',
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── Submit Button ── */}
        <div className="mt-5">
          <button
            onClick={handleSubmit}
            disabled={loading || (mode === 'zip' && !file) || (mode === 'url' && !repoUrl.trim())}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: '#5E6AD2',
              border: '1px solid rgba(94,106,210,0.5)',
              boxShadow: '0 0 16px rgba(94,106,210,0.2)',
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#6872D9'; e.currentTarget.style.boxShadow = '0 0 24px rgba(94,106,210,0.35)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#5E6AD2'; e.currentTarget.style.boxShadow = '0 0 16px rgba(94,106,210,0.2)'; }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {loadingStep || 'Processing...'}</>
            ) : mode === 'zip' ? (
              <><UploadCloud className="w-4 h-4" /> Upload & Deploy</>
            ) : (
              <><Github className="w-4 h-4" /> Clone & Deploy</>
            )}
          </button>
        </div>

        {/* ── Pipeline Info ── */}
        <div
          className="mt-5 p-4 rounded-lg text-xs space-y-1.5"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: '#8A8F98',
          }}
        >
          <p className="font-semibold" style={{ color: '#EDEDEF' }}>Deployment pipeline:</p>
          {[
            '1. Framework auto-detection (React / Express / Flask / FastAPI / MERN)',
            '2. Offline dependency materialization (no network during Docker build)',
            '3. Docker image build with --network=none security boundary',
            '4. EC2 provisioning (reuses existing instance if available)',
            '5. SSH image transfer & container launch',
            '6. Health check → Live → Deployment report generated',
          ].map((step, i) => (
            <p key={i} className="font-mono">{step}</p>
          ))}
        </div>

      </div>
    </motion.div>
  );
}
