import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ──────────────────────────────────────────────────
   NebulaIntro — cinematic splash animation that plays
   once each time the user opens the Nebula AI page.
   Calls onComplete() when done so the chat is revealed.
────────────────────────────────────────────────── */

// ── SVG Logo ──
function NebulaIcon({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <ellipse cx="36" cy="36" rx="32" ry="10"
        stroke="rgba(148,163,251,0.35)" strokeWidth="1" />
      <ellipse cx="36" cy="36" rx="32" ry="10"
        stroke="rgba(167,139,250,0.25)" strokeWidth="1"
        transform="rotate(60 36 36)" />
      <ellipse cx="36" cy="36" rx="32" ry="10"
        stroke="rgba(94,106,210,0.30)" strokeWidth="1"
        transform="rotate(120 36 36)" />
      <circle cx="36" cy="36" r="10" fill="url(#nebCore)" filter="url(#nebGlow)" />
      <circle cx="36" cy="36" r="4" fill="white" opacity="0.9" />
      <circle cx="68" cy="36" r="2.5" fill="rgba(148,163,251,0.85)" />
      <circle cx="4"  cy="36" r="2.5" fill="rgba(167,139,250,0.85)" />
      <circle cx="36" cy="4"  r="2"   fill="rgba(94,106,210,0.75)" />
      <circle cx="36" cy="68" r="2"   fill="rgba(94,106,210,0.75)" />
      <defs>
        <radialGradient id="nebCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#818cf8" />
          <stop offset="60%"  stopColor="#5E6AD2" />
          <stop offset="100%" stopColor="rgba(94,106,210,0)" />
        </radialGradient>
        <filter id="nebGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// ── Letter-by-letter reveal ──
function AnimatedText({ text, delay = 0, style = {} }) {
  return (
    <span style={style} aria-label={text}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 22, filter: 'blur(9px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            duration: 0.52,
            delay: delay + i * 0.048,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : 'normal' }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

// ── Single orbiting dot ──
function OrbitParticle({ angle, radius, size, delay, color, duration }) {
  const rad = (a) => (a * Math.PI) / 180;
  const x0 = Math.cos(rad(angle))         * radius;
  const y0 = Math.sin(rad(angle))         * radius * 0.35;
  const x1 = Math.cos(rad(angle + 360))   * radius;
  const y1 = Math.sin(rad(angle + 360))   * radius * 0.35;
  return (
    <motion.div
      style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: '50%',
        background: color,
        top: '50%', left: '50%',
        marginTop: -size / 2, marginLeft: -size / 2,
        boxShadow: `0 0 ${size * 2.5}px ${color}`,
        zIndex: 5,
      }}
      animate={{ x: [x0, x1], y: [y0, y1] }}
      transition={{ duration, repeat: Infinity, ease: 'linear', delay }}
    />
  );
}

// ── Main export ──
export default function NebulaIntro({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    // Respect reduced-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete();
      return;
    }
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 650);
    }, 2900);
    return () => clearTimeout(timerRef.current);
  }, [onComplete]);

  const skip = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(onComplete, 620);
  };

  const particles = [
    { angle: 0,   radius: 112, size: 5,   delay: 0,    color: 'rgba(148,163,251,0.9)', duration: 4.0 },
    { angle: 90,  radius: 112, size: 3.5, delay: 0.5,  color: 'rgba(167,139,250,0.85)', duration: 4.0 },
    { angle: 180, radius: 112, size: 4,   delay: 0,    color: 'rgba(94,106,210,0.9)',   duration: 4.0 },
    { angle: 270, radius: 112, size: 3,   delay: 1.0,  color: 'rgba(196,181,253,0.75)', duration: 4.0 },
    { angle: 40,  radius: 148, size: 3,   delay: 0.2,  color: 'rgba(129,140,248,0.6)',  duration: 5.6 },
    { angle: 130, radius: 148, size: 2.5, delay: 0.8,  color: 'rgba(167,139,250,0.5)',  duration: 5.6 },
    { angle: 220, radius: 148, size: 3,   delay: 0.4,  color: 'rgba(94,106,210,0.6)',   duration: 5.6 },
    { angle: 310, radius: 148, size: 2,   delay: 1.2,  color: 'rgba(148,163,251,0.5)',  duration: 5.6 },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nebula-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, filter: 'blur(12px)' }}
          transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(18,14,42,1) 0%, #020203 100%)',
            overflow: 'hidden',
          }}
        >
          {/* ── ambient glow blobs ── */}
          <div style={{
            position: 'absolute', width: 760, height: 760, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(94,106,210,0.11) 0%, transparent 70%)',
            filter: 'blur(90px)', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', pointerEvents: 'none',
          }} />
          <motion.div
            style={{
              position: 'absolute', width: 420, height: 420, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(167,139,250,0.09) 0%, transparent 70%)',
              filter: 'blur(65px)', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)', pointerEvents: 'none',
            }}
            animate={{ scale: [1, 1.22, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* ── subtle grid ── */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse 68% 68% at 50% 50%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 68% 68% at 50% 50%, black 40%, transparent 100%)',
          }} />

          {/* ── icon + orbit system ── */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Orbit ring 1 */}
            <motion.div
              style={{
                position: 'absolute',
                width: 235, height: 84, borderRadius: '50%',
                border: '1px solid rgba(148,163,251,0.2)',
                top: '50%', left: '50%',
                marginTop: -42, marginLeft: -117.5,
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1, rotate: [0, 360] }}
              transition={{
                opacity: { duration: 0.5, delay: 0.3 },
                scale:   { duration: 0.5, delay: 0.3 },
                rotate:  { duration: 8, repeat: Infinity, ease: 'linear' },
              }}
            />
            {/* Orbit ring 2 */}
            <motion.div
              style={{
                position: 'absolute',
                width: 304, height: 110, borderRadius: '50%',
                border: '1px solid rgba(94,106,210,0.14)',
                top: '50%', left: '50%',
                marginTop: -55, marginLeft: -152,
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1, rotate: [60, 420] }}
              transition={{
                opacity: { duration: 0.5, delay: 0.42 },
                scale:   { duration: 0.5, delay: 0.42 },
                rotate:  { duration: 12, repeat: Infinity, ease: 'linear' },
              }}
            />

            {/* Orbit particles */}
            {particles.map((p, i) => <OrbitParticle key={i} {...p} />)}

            {/* Core icon */}
            <motion.div
              initial={{ scale: 0.15, opacity: 0, filter: 'blur(28px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.95, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'relative', zIndex: 10 }}
            >
              <NebulaIcon size={74} />
            </motion.div>
          </div>

          {/* ── text block ── */}
          <div style={{ marginTop: 36, textAlign: 'center', position: 'relative', zIndex: 10 }}>
            <div style={{
              fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
              fontFamily: 'Inter, system-ui, sans-serif',
              display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'center',
            }}>
              <AnimatedText
                text="Nebula"
                delay={0.55}
                style={{ color: '#EDEDEF' }}
              />
              <AnimatedText
                text="AI"
                delay={0.94}
                style={{
                  background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 9 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.48, ease: [0.16, 1, 0.3, 1] }}
              style={{
                marginTop: 10, fontSize: 12, fontWeight: 400,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: '#8A8F98', fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Autonomous Infrastructure Intelligence
            </motion.p>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.78, duration: 0.3 }}
              style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}
            >
              <div style={{
                width: 120, height: 2,
                background: 'rgba(255,255,255,0.07)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.05, delay: 1.88, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #5E6AD2 0%, #a78bfa 100%)',
                    borderRadius: 99,
                  }}
                />
              </div>
            </motion.div>
          </div>

          {/* ── skip button ── */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15, duration: 0.4 }}
            onClick={skip}
            style={{
              position: 'absolute', bottom: 28, right: 28,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.09)',
              color: '#8A8F98', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
              e.currentTarget.style.color = '#EDEDEF';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
              e.currentTarget.style.color = '#8A8F98';
            }}
          >
            Skip
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
