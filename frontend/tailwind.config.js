/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0B0F14', // Primary Background
          900: '#11161D', // Secondary Background
          850: '#161C24', // Elevated Surface
          800: '#1A212C', // Card Surface
        },
        border: {
          subtle: '#273142', // Border/Subtle Divider
        },
        content: {
          primary: '#F5F7FA', // Primary Text
          secondary: '#A8B3C2', // Secondary Text
          muted: '#6B7785', // Muted Text
        },
        accent: {
          primary: '#7C5CFF', // Electric Indigo
          secondary: '#4DA3FF', // Cyan Blue
          primary_hover: '#6947FF',
          secondary_hover: '#3691FF',
        },
        state: {
          success: '#33D17A', // Emerald
          warning: '#FFB547', // Amber
          error: '#FF6B6B', // Soft Red
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.03)',
        'card-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'glow-primary': '0 0 20px rgba(124, 92, 255, 0.15)',
        'glow-secondary': '0 0 20px rgba(77, 163, 255, 0.15)',
        'dropdown': '0 10px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      keyframes: {
        count_up: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slide_in: { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        slide_up: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fade_in: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        count_up: 'count_up 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        slide_in: 'slide_in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        slide_up: 'slide_up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        fade_in: 'fade_in 0.3s ease-out',
      },
      backgroundImage: {
        'grid-dark': 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        'hero-gradient': 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124, 92, 255, 0.06) 0%, transparent 80%)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};
