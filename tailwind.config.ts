import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,jsx,ts,tsx,mdx}',
    './components/**/*.{js,jsx,ts,tsx,mdx}',
    './lib/**/*.{js,jsx,ts,tsx,mdx}',
    './store/**/*.{js,jsx,ts,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F6F4EF',
        surface: '#FFFFFF',
        ink: '#141414',
        'ink-soft': '#4A4A45',
        mute: '#8A867C',
        line: '#E4E0D6',
        accent: '#9A3B26',
        'accent-deep': '#7C2E1D',
        success: '#1F7A4D',
        warning: '#B45309',
        danger: '#B3261E',
        info: '#1D4ED8'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif']
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'drawer-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        }
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'fade-up': 'fade-up .7s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .3s ease both',
        'drawer-in': 'drawer-in .45s cubic-bezier(.22,1,.36,1) both',
        'toast-in': 'toast-in .35s cubic-bezier(.22,1,.36,1) both'
      }
    }
  },
  plugins: []
};

export default config;
