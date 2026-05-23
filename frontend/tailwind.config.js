/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: 'rgb(var(--base-950) / <alpha-value>)',
          900: 'rgb(var(--base-900) / <alpha-value>)',
          850: 'rgb(var(--base-850) / <alpha-value>)',
          800: 'rgb(var(--base-800) / <alpha-value>)',
        },
        border: {
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--content-primary) / <alpha-value>)',
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
        },
        accent: {
          primary: 'rgb(var(--accent-primary) / <alpha-value>)',
          secondary: 'rgb(var(--accent-secondary) / <alpha-value>)',
          primary_hover: 'rgb(var(--accent-primary-hover) / <alpha-value>)',
          secondary_hover: 'rgb(var(--accent-secondary-hover) / <alpha-value>)',
        },
        state: {
          success: 'rgb(var(--state-success) / <alpha-value>)',
          warning: 'rgb(var(--state-warning) / <alpha-value>)',
          error: 'rgb(var(--state-error) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'glow-primary': '0 0 20px rgb(var(--accent-primary) / 0.2)',
        'glow-secondary': '0 0 20px rgb(var(--accent-secondary) / 0.2)',
        'dropdown': '0 10px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.05)',
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse 60% 50% at 50% 0%, rgb(var(--accent-primary) / 0.06) 0%, transparent 80%)',
        'hero-glow-alt': 'radial-gradient(ellipse 40% 40% at 70% 60%, rgb(var(--accent-secondary) / 0.06) 0%, transparent 70%)',
      },
      keyframes: {
        fade_in: { from: { opacity: 0 }, to: { opacity: 1 } },
        slide_up: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slide_down: { from: { opacity: 0, transform: 'translateY(-6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scale_in: { from: { opacity: 0, transform: 'scale(0.97)' }, to: { opacity: 1, transform: 'scale(1)' } },
        pulse_soft: { '0%, 100%': { opacity: 0.4 }, '50%': { opacity: 0.8 } },
      },
      animation: {
        fade_in: 'fade_in 0.25s ease-out',
        slide_up: 'slide_up 0.25s ease-out',
        slide_down: 'slide_down 0.25s ease-out',
        scale_in: 'scale_in 0.2s ease-out',
        pulse_soft: 'pulse_soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
