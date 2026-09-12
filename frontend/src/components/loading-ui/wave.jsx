import React from 'react';
import { motion } from 'framer-motion';

export function Wave({ className }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className || ''}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-full rounded-full"
          style={{ background: 'linear-gradient(180deg, #818cf8 0%, #a78bfa 100%)' }}
          animate={{ scaleY: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
