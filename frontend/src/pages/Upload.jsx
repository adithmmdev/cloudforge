import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Link2, File, X, AlertCircle, CheckCircle, Loader2, Github } from 'lucide-react';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const FRAMEWORK_INFO = {
  react:   { label: 'React',      color: 'text-blue-600 bg-blue-50 border-blue-200' },
  express: { label: 'Express',    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  flask:   { label: 'Flask',      color: 'text-orange-600 bg-orange-50 border-orange-200' },
  fastapi: { label: 'FastAPI',    color: 'text-teal-600 bg-teal-50 border-teal-200' },
  mern:    { label: 'MERN Stack', color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // mode: 'zip' | 'url'
  const [mode, setMode] = useState('zip');

  // ZIP state
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // URL state
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');

  // Shared state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [detectedFramework, setDetectedFramework] = useState(null);

  // ── ZIP drag-and-drop ──────────────────────────────────────────────────────
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

  // ── Submit ─────────────────────────────────────────────────────────────────
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
        const res = await fetch('/api/projects/upload', { method: 'POST', body: formData });
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
        const res = await fetch('/api/projects/from-url', {
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

      // Auto-trigger deploy
      const depRes = await fetch(`/api/projects/${projectData.project_id}/deploy`, { method: 'POST' });
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

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold text-gray-900">Deploy New Project</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Upload a .zip file or connect a public GitHub/GitLab repository. CloudForge auto-detects your framework.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex border border-gray-200 rounded overflow-hidden mb-5 w-fit">
          <button
            onClick={() => { setMode('zip'); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-[12px] font-medium transition-all ${
              mode === 'zip' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Upload ZIP
          </button>
          <button
            onClick={() => { setMode('url'); setError(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-[12px] font-medium border-l border-gray-200 transition-all ${
              mode === 'url' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Github className="w-3.5 h-3.5" /> GitHub / GitLab URL
          </button>
        </div>

        {/* ZIP mode */}
        {mode === 'zip' && (
          <div
            className={`border-2 border-dashed rounded transition-all cursor-pointer ${
              isDragging ? 'border-indigo-400 bg-indigo-50' :
              file ? 'border-emerald-300 bg-emerald-50' :
              'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
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
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">{file.name}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5 font-mono">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); setFile(null); setDetectedFramework(null); }}
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-[14px] font-medium text-gray-700">
                      Drop your .zip here, or <span className="text-indigo-600">browse</span>
                    </p>
                    <p className="text-[12px] text-gray-400 mt-1">.zip files only · Max 100MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GitHub URL mode */}
        {mode === 'url' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Github className="w-4 h-4 text-gray-500" />
                <label className="text-[12px] font-medium text-gray-700">Repository URL</label>
              </div>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setError(null); }}
                placeholder="https://github.com/username/repo"
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white mt-1"
              />
              <p className="text-[10px] text-gray-400 mt-1.5">Public repositories only. No authentication required.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-4 flex-1">
                Falls back to the default branch if the specified branch doesn't exist.
              </p>
            </div>

            {/* Quick examples */}
            <div className="text-[11px] text-gray-400">
              <span className="font-medium text-gray-500">Examples: </span>
              {[
                'https://github.com/tiangolo/full-stack-fastapi-template',
                'https://github.com/bradtraversy/mern-tutorial',
              ].map(url => (
                <button key={url} onClick={() => setRepoUrl(url)}
                  className="ml-2 text-indigo-500 hover:underline font-mono">
                  {url.split('/').slice(-1)[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Framework detection result */}
        {fw && (
          <div className={`mt-3 px-4 py-3 rounded border text-[13px] ${fw.color}`}>
            <span className="font-medium">Detected Framework:</span> {fw.label}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="mt-4">
          <button
            onClick={handleSubmit}
            disabled={loading || (mode === 'zip' && !file) || (mode === 'url' && !repoUrl.trim())}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

        {/* Info */}
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded text-[12px] text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">Deployment pipeline:</p>
          <p>1. Framework auto-detection (React / Express / Flask / FastAPI / MERN)</p>
          <p>2. Offline dependency materialization (no network during Docker build)</p>
          <p>3. Docker image build with <span className="font-mono">--network=none</span> security boundary</p>
          <p>4. EC2 provisioning (reuses existing instance if available)</p>
          <p>5. SSH image transfer &amp; container launch</p>
          <p>6. Health check → Live → Deployment report generated</p>
        </div>
      </div>
    </div>
  );
}
