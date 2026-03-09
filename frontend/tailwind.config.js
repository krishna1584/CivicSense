/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#05070A',
          900: '#0B0F14',
          800: '#11161D',
          850: '#0E131A',
        },
        neon: {
          green: '#00FF94',
          blue: '#3B82F6',
          amber: '#F59E0B',
          red: '#EF4444',
        },
        muted: '#9CA3AF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0,255,148,0.3)',
        'glow-blue': '0 0 20px rgba(59,130,246,0.3)',
        'glow-amber': '0 0 20px rgba(245,158,11,0.3)',
        'glow-red': '0 0 20px rgba(239,68,68,0.3)',
        'card': '0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        pulse_green: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,255,148,0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(0,255,148,0.8)' },
        },
        count_up: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slide_in: { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        fade_in: { from: { opacity: 0 }, to: { opacity: 1 } },
        glow_pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
      animation: {
        pulse_green: 'pulse_green 2s ease-in-out infinite',
        count_up: 'count_up 0.5s ease-out',
        slide_in: 'slide_in 0.3s ease-out',
        fade_in: 'fade_in 0.4s ease-out',
        glow_pulse: 'glow_pulse 1.5s ease-in-out infinite',
      },
      backgroundImage: {
        'grid-dark': 'linear-gradient(rgba(0,255,148,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,148,0.03) 1px, transparent 1px)',
        'hero-glow': 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,255,148,0.08) 0%, transparent 70%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      opacity: {
        '2': '0.02',
        '3': '0.03',
        '8': '0.08',
      },
    },
  },
  plugins: [],
};
