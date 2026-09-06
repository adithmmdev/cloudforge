import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UploadCloud, Settings, Cpu, Activity,
  GitBranch, ChevronRight, Circle, CheckCircle, XCircle, Loader2, MessageSquare
} from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import AWSSetup from './pages/AWSSetup.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ControlCenter from './pages/ControlCenter.jsx';
import CopilotPage from './pages/CopilotPage.jsx';

// ============================================================================
// Layout Components
// ============================================================================

function Sidebar() {
  const navLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Mission Control', exact: true },
    { to: '/upload', icon: UploadCloud, label: 'New Project' },
    { to: '/copilot', icon: MessageSquare, label: 'Niggex AI' },
    { to: '/aws-setup', icon: Cpu, label: 'AWS Setup' },
    { to: '/control', icon: Activity, label: 'Control Center' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-[240px] bg-gray-50 shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z" fill="#4F46E5" opacity="0.15" stroke="#4F46E5" strokeWidth="1.5"/>
            <path d="M12 6L16.5 8.5V13.5L12 16L7.5 13.5V8.5L12 6Z" fill="#4F46E5" opacity="0.4"/>
            <circle cx="12" cy="11" r="2" fill="#4F46E5"/>
          </svg>
          <span className="font-mono font-bold text-[15px] text-gray-900 tracking-tight">CloudForge</span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5 ml-8">Autonomous Deploy Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navLinks.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-all ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                  : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
              }`
            }
          >
            <Icon size={16} strokeWidth={2} className="opacity-80" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          <span className="text-[11px] font-medium text-slate-600 tracking-wide uppercase">Core System Online</span>
        </div>
      </div>
    </div>
  );
}

function TopHeader() {
  const [awsStatus, setAwsStatus] = useState(null);
  const [ec2Count, setEc2Count] = useState(0);
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    fetch('/api/aws/setup/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => setAwsStatus(d))
      .catch(() => {});
      
    fetch('/api/instances')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const instances = Array.isArray(d) ? d : (d.instances || []);
        setEc2Count(instances.filter(i => i.state === 'running').length);
      })
      .catch(() => {});

    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const p = Array.isArray(d) ? d : (d.projects || d.data || []);
        setProjectCount(p.length);
      })
      .catch(() => {});
  }, []);

  const isAwsOk = awsStatus?.status === 'complete';

  return (
    <div className="fixed top-0 left-[240px] right-0 h-11 bg-white border-b border-gray-200 flex items-center px-6 z-40 shadow-sm">
      <div className="flex items-center gap-6 text-[12px] font-medium text-slate-600">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">AWS Infrastructure:</span>
          {isAwsOk ? (
            <span className="text-emerald-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Connected</span>
          ) : (
            <span className="text-amber-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Not Configured</span>
          )}
        </div>
        <div className="w-px h-3.5 bg-gray-300"></div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">EC2 Cap:</span>
          <span className="text-slate-800">{ec2Count}/1 Max Active</span>
        </div>
        <div className="w-px h-3.5 bg-gray-300"></div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Projects:</span>
          <span className="text-slate-800">{projectCount}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white font-sans text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <Sidebar />
        <TopHeader />
        
        <main className="transition-all duration-300 ml-[240px] pt-11">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/aws-setup" element={<AWSSetup />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/control" element={<ControlCenter />} />
            <Route path="/copilot" element={<CopilotPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
