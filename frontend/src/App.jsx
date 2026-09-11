import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UploadCloud, Settings, Cpu, Activity,
  GitBranch, ChevronRight, Circle, CheckCircle, XCircle, Loader2, MessageSquare,
  Zap, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import AWSSetup from './pages/AWSSetup.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ControlCenter from './pages/ControlCenter.jsx';
import CopilotPage from './pages/CopilotPage.jsx';
import AwsCopilotPage from './pages/AwsCopilotPage.jsx';

// ============================================================================
// CloudForge Logo Mark
// ============================================================================
function CFLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z"
        fill="rgba(94,106,210,0.12)"
        stroke="#5E6AD2"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 6L16.5 8.5V13.5L12 16L7.5 13.5V8.5L12 6Z"
        fill="rgba(94,106,210,0.35)"
      />
      <circle cx="12" cy="11" r="2" fill="#5E6AD2" />
    </svg>
  );
}

// ============================================================================
// Sidebar
// ============================================================================
function Sidebar() {
  const navLinks = [
    { to: '/',           icon: LayoutDashboard, label: 'Mission Control', exact: true },
    { to: '/upload',     icon: UploadCloud,     label: 'New Project' },
    { to: '/copilot',    icon: MessageSquare,   label: 'Niggex AI' },
    { to: '/aws-copilot',icon: MessageSquare,   label: 'AWS Copilot' },
    { to: '/aws-setup',  icon: Cpu,             label: 'AWS Setup' },
    { to: '/control',    icon: Activity,        label: 'Control Center' },
    { to: '/settings',   icon: Settings,        label: 'Settings' },
  ];

  return (
    <div
      className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-50"
      style={{
        background: '#050506',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Logo */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <CFLogo />
          <div>
            <span
              className="block font-mono font-bold text-[14px] tracking-tight"
              style={{ color: '#EDEDEF', letterSpacing: '-0.01em' }}
            >
              CloudForge
            </span>
            <span
              className="block text-[10px] font-medium tracking-[0.06em] uppercase"
              style={{ color: '#8A8F98' }}
            >
              Autonomous Deploy
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navLinks.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-3 py-2 rounded text-[12.5px] font-medium transition-all duration-150',
                'relative group',
                isActive
                  ? 'text-[#EDEDEF]'
                  : 'text-[#8A8F98] hover:text-[#EDEDEF]',
              ].join(' ')
            }
            style={({ isActive }) => ({
              background: isActive ? 'rgba(94,106,210,0.12)' : 'transparent',
              border: isActive ? '1px solid rgba(94,106,210,0.2)' : '1px solid transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2 : 1.75}
                  style={{ color: isActive ? '#5E6AD2' : 'inherit' }}
                />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                    style={{ background: '#5E6AD2' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* System Status */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full live-pulse"
            style={{ background: '#22c55e' }}
          />
          <span
            className="text-[10px] font-medium tracking-[0.06em] uppercase"
            style={{ color: '#8A8F98' }}
          >
            Core System Online
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Top Header
// ============================================================================
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
    <div
      className="fixed top-0 left-[220px] right-0 h-10 flex items-center px-5 z-40"
      style={{
        background: 'rgba(5,5,6,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-5" style={{ color: '#8A8F98', fontSize: '11px', fontWeight: 500 }}>
        {/* AWS Status */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>AWS</span>
          {isAwsOk ? (
            <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: '#22c55e', boxShadow: '0 0 4px rgba(34,197,94,0.6)' }}
              />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1" style={{ color: '#f59e0b' }}>
              <span className="w-1 h-1 rounded-full" style={{ background: '#f59e0b' }} />
              Not Configured
            </span>
          )}
        </div>

        <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* EC2 */}
        <div className="flex items-center gap-1">
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>EC2</span>
          <span style={{ color: '#EDEDEF', fontFamily: 'var(--font-mono)' }}>
            {ec2Count}/1
          </span>
        </div>

        <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Projects */}
        <div className="flex items-center gap-1">
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>Projects</span>
          <span style={{ color: '#EDEDEF', fontFamily: 'var(--font-mono)' }}>
            {projectCount}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Atmospheric Background
// ============================================================================
function AtmosphericBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Base gradient — radial depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(94,106,210,0.06) 0%, transparent 70%)',
        }}
      />
      {/* Subtle ambient blob — top left */}
      <motion.div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: '45vw',
          height: '45vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(94,106,210,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 30, -10, 0],
          y: [0, -20, 15, 0],
          scale: [1, 1.05, 0.97, 1],
        }}
        transition={{
          duration: 12,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'loop',
        }}
      />
      {/* Subtle ambient blob — bottom right */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-5%',
          width: '40vw',
          height: '40vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.025) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{
          x: [0, -20, 15, 0],
          y: [0, 20, -10, 0],
          scale: [1, 0.95, 1.03, 1],
        }}
        transition={{
          duration: 15,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'loop',
          delay: 3,
        }}
      />
      {/* Ultra-subtle grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />
    </div>
  );
}

// ============================================================================
// Root App
// ============================================================================
export default function App() {
  return (
    <BrowserRouter>
      <div
        className="min-h-screen antialiased"
        style={{
          background: '#050506',
          color: '#EDEDEF',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <AtmosphericBackground />
        <Sidebar />
        <TopHeader />

        <main
          className="relative z-10 transition-all duration-300"
          style={{ marginLeft: '220px', paddingTop: '40px' }}
        >
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/upload"       element={<Upload />} />
            <Route path="/aws-setup"    element={<AWSSetup />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/settings"     element={<SettingsPage />} />
            <Route path="/control"      element={<ControlCenter />} />
            <Route path="/copilot"      element={<CopilotPage />} />
            <Route path="/aws-copilot"  element={<AwsCopilotPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
