import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Particle Generator ---
function useParticles(count) {
  return useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      // Random starting angles and radius
      const angle = Math.random() * 360;
      const radius = 90 + Math.random() * 140; // distance from center
      const size = 1 + Math.random() * 2.5;
      const duration = 5 + Math.random() * 8;
      const delay = Math.random() * 3;
      
      // Calculate start and end coordinates based on an expanding spiral
      const rad = angle * (Math.PI / 180);
      const startX = Math.cos(rad) * (radius * 0.5);
      const startY = Math.sin(rad) * (radius * 0.5);
      const endX = Math.cos(rad + Math.PI/4) * radius;
      const endY = Math.sin(rad + Math.PI/4) * radius;

      return { startX, startY, endX, endY, size, duration, delay, id: i };
    });
  }, [count]);
}

export default function NebulaIntro({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);
  
  // 40 particles for a dense cosmic dust field
  const particles = useParticles(40);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete();
      return;
    }
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 900); // Wait for exit animation
    }, 4200);
    return () => clearTimeout(timerRef.current);
  }, [onComplete]);

  const skip = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(onComplete, 800);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nebula-intro-pro-max"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: 'blur(20px)' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#020204',
            overflow: 'hidden',
          }}
        >
          {/* Ambient Cosmic Mist */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: [1, 1.05, 1], rotate: [0, 5, 0] }}
            transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
            style={{
              position: 'absolute', width: '90vw', height: '90vw',
              maxWidth: 900, maxHeight: 900,
              background: 'radial-gradient(ellipse at center, rgba(94,106,210,0.12) 0%, rgba(167,139,250,0.06) 40%, transparent 70%)',
              filter: 'blur(100px)',
              pointerEvents: 'none',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />

          {/* Organic Particle Field */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 5, pointerEvents: 'none' }}>
            {particles.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: p.startX, y: p.startY, scale: 0 }}
                animate={{ 
                  opacity: [0, Math.random() * 0.6 + 0.4, 0], 
                  x: [p.startX, p.endX], 
                  y: [p.startY, p.endY], 
                  scale: [0, 1, 0] 
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "easeInOut"
                }}
                style={{
                  position: 'absolute',
                  width: p.size, height: p.size,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 0 8px 1px rgba(167,139,250,0.8)',
                }}
              />
            ))}
          </div>

          {/* Central Glassmorphic Fluid Orb */}
          <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            
            {/* The Fluid Mask */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                width: 130, height: 130,
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'rgba(10,10,15,0.4)',
                boxShadow: '0 0 40px rgba(94,106,210,0.3)',
              }}
            >
              {/* Fluid Core 1: Deep Blue */}
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
                style={{
                  position: 'absolute', width: '120%', height: '120%',
                  top: '-10%', left: '-10%',
                  background: 'radial-gradient(circle, #5E6AD2 0%, transparent 60%)',
                  mixBlendMode: 'screen',
                  filter: 'blur(15px)',
                  transformOrigin: '40% 40%'
                }}
              />
              
              {/* Fluid Core 2: Vivid Purple */}
              <motion.div
                animate={{ rotate: -360, scale: [1.1, 0.9, 1.1] }}
                transition={{ rotate: { duration: 10, repeat: Infinity, ease: 'linear' }, scale: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
                style={{
                  position: 'absolute', width: '140%', height: '140%',
                  top: '-20%', left: '-20%',
                  background: 'radial-gradient(circle, #a78bfa 0%, transparent 60%)',
                  mixBlendMode: 'screen',
                  filter: 'blur(20px)',
                  transformOrigin: '60% 60%'
                }}
              />

              {/* Fluid Core 3: Intense Indigo Core */}
              <motion.div
                animate={{ rotate: 180, scale: [0.8, 1.1, 0.8] }}
                transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
                style={{
                  position: 'absolute', width: '100%', height: '100%',
                  top: '0%', left: '0%',
                  background: 'radial-gradient(circle, rgba(129,140,248,0.9) 0%, transparent 50%)',
                  mixBlendMode: 'overlay',
                  filter: 'blur(10px)',
                  transformOrigin: '50% 50%'
                }}
              />
            </motion.div>

            {/* Specular Highlight & Glass Border (Overlay) */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                width: 130, height: 130,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)',
                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.15), inset 0 0 4px rgba(255,255,255,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
                zIndex: 15,
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Text Reveal Block */}
          <div style={{ marginTop: 48, textAlign: 'center', position: 'relative', zIndex: 20 }}>
            <motion.div
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1,
                fontFamily: 'Inter, -apple-system, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
              }}
            >
              <span style={{ color: '#fff' }}>Nebula</span>
              <span style={{
                background: 'linear-gradient(200deg, #c084fc 0%, #818cf8 40%, #c084fc 80%, #818cf8 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'nebulaShine 4s linear infinite'
              }}>
                AI
              </span>
            </motion.div>
            
            <style>{`
              @keyframes nebulaShine {
                0% { background-position: 200% center; }
                100% { background-position: 0% center; }
              }
            `}</style>

            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.2, ease: "easeOut" }}
              style={{
                marginTop: 14, fontSize: 13, fontWeight: 500,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, -apple-system, sans-serif'
              }}
            >
              Autonomous Infrastructure Intelligence
            </motion.p>
          </div>

          {/* Laser Progress Line */}
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 280 }}
            transition={{ 
              opacity: { duration: 0.6, delay: 1.8 },
              width: { duration: 1.5, delay: 1.8, ease: [0.16, 1, 0.3, 1] } 
            }}
            style={{
              marginTop: 48,
              height: 1.5,
              background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.8), transparent)',
              boxShadow: '0 0 12px rgba(167,139,250,0.6)',
              position: 'relative',
              zIndex: 20
            }}
          >
            {/* Glowing lead tip moving across the line */}
            <motion.div
              initial={{ left: '0%', opacity: 0 }}
              animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.5, delay: 1.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                top: -1.5,
                width: 6, height: 4.5,
                background: '#fff',
                borderRadius: '50%',
                boxShadow: '0 0 12px 3px #fff',
                transform: 'translateX(-50%)'
              }}
            />
          </motion.div>

          {/* Skip Button (Ghost Style) */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.5, duration: 0.6 }}
            onClick={skip}
            style={{
              position: 'absolute', bottom: 40,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '10px 24px', borderRadius: 99, cursor: 'pointer',
              fontFamily: 'Inter, -apple-system, sans-serif',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.3s ease',
              zIndex: 30
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(167,139,250,0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Skip Sequence
          </motion.button>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
