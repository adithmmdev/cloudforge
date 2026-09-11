/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
      },
      colors: {
        // CloudForge Design Tokens
        'cf-deep':    '#020203',
        'cf-base':    '#050506',
        'cf-elevated':'#0a0a0c',
        'cf-surface': 'rgba(255,255,255,0.04)',
        'cf-surface-hover': 'rgba(255,255,255,0.07)',
        'cf-fg':      '#EDEDEF',
        'cf-muted':   '#8A8F98',
        'cf-subtle':  'rgba(255,255,255,0.60)',
        'cf-accent':  '#5E6AD2',
        'cf-accent-bright': '#6872D9',
        'cf-accent-glow':   'rgba(94,106,210,0.25)',
        'cf-border':  'rgba(255,255,255,0.06)',
        'cf-border-hover': 'rgba(255,255,255,0.10)',
        'cf-border-accent':'rgba(94,106,210,0.30)',
        // Status colors
        'cf-live':    '#22c55e',
        'cf-warning': '#f59e0b',
        'cf-error':   '#f43f5e',
        'cf-pending': '#8A8F98',
        'cf-healing': '#a78bfa',
      },
      boxShadow: {
        'cf-sm':  '0 1px 3px 0 rgba(0,0,0,0.4)',
        'cf-md':  '0 4px 12px 0 rgba(0,0,0,0.4)',
        'cf-lg':  '0 8px 32px 0 rgba(0,0,0,0.5)',
        'cf-xl':  '0 16px 48px 0 rgba(0,0,0,0.6)',
        'cf-accent': '0 0 20px rgba(94,106,210,0.3)',
        'cf-live':   '0 0 8px rgba(34,197,94,0.4)',
        'cf-inner': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'cf-pulse': 'cf-pulse 2s ease-in-out infinite',
        'cf-blob': 'cf-blob 10s ease-in-out infinite',
        'cf-shimmer': 'cf-shimmer 2s linear infinite',
        'cf-slide-in': 'cf-slide-in 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        'cf-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.85)' },
        },
        'cf-blob': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-20px) scale(1.05)' },
          '66%': { transform: 'translate(-20px,15px) scale(0.95)' },
        },
        'cf-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'cf-slide-in': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'cf-noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
