import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UploadCloud, Settings, Cpu, Activity,
  GitBranch, ChevronRight, Circle, CheckCircle, XCircle, Loader2, MessageSquare,
  Zap, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';

import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import AWSSetup from './pages/AWSSetup.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ControlCenter from './pages/ControlCenter.jsx';
import CopilotPage from './pages/CopilotPage.jsx';
import AwsCopilotPage from './pages/AwsCopilotPage.jsx';

gsap.registerPlugin(ScrollTrigger);

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
    { to: '/copilot',    icon: MessageSquare,   label: 'Nebula AI' },
    { to: '/aws-copilot',icon: MessageSquare,   label: 'AWS Copilot' },
    { to: '/aws-setup',  icon: Cpu,             label: 'AWS Setup' },
    { to: '/control',    icon: Activity,        label: 'Control Center' },
    { to: '/settings',   icon: Settings,        label: 'Settings' },
  ];

  return (
    <div
      className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-50"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(48px)',
        WebkitBackdropFilter: 'blur(48px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.03), inset 1px 1px 0 rgba(255,255,255,0.1), 8px 0 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Logo */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/cf-logo.png" alt="CloudForge Logo" className="w-8 h-8 rounded-lg object-contain shadow-[0_0_10px_rgba(94,106,210,0.3)]" />
          <div>
            <span
              className="block font-sans font-bold text-[14px] tracking-tight"
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
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto relative">
        {navLinks.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200',
                'relative group z-10',
                isActive
                  ? 'text-[#EDEDEF]'
                  : 'text-[#8A8F98] hover:text-[#EDEDEF]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-[12px] z-[-1]"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                    style={{ background: '#5E6AD2' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2 : 1.75}
                  style={{ color: isActive ? '#818cf8' : 'inherit' }}
                />
                {label}
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
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(48px)',
        WebkitBackdropFilter: 'blur(48px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 24px rgba(0,0,0,0.4)',
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true" style={{ background: '#050506' }}>
      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 40%, transparent 100%)',
        }}
      />
      {/* Spotlight tracking cursor */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(94,106,210,0.08) 0%, rgba(167,139,250,0.03) 40%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
        animate={{
          x: mousePos.x - 300,
          y: mousePos.y - 300,
        }}
        transition={{
          type: 'tween',
          ease: 'easeOut',
          duration: 0.15,
        }}
      />
    </div>
  );
}

// ============================================================================
// ============================================================================
// Root App
// ============================================================================
export default function App() {
  const containerRef = useRef(null);

  useGSAP(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, { scope: containerRef });

  return (
    <BrowserRouter>
      <div
        ref={containerRef}
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
