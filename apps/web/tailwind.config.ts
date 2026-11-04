import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1.25rem', md: '2rem' }, screens: { '2xl': '1200px' } },
    extend: {
      colors: {
        page: v('page'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        night: v('night'),
        brand: { DEFAULT: '#705DC2', 50: '#F4F1FF', 100: '#E8E2FF', 200: '#D2C7FF', 300: '#B6A6FF', 400: '#9B87F1', 500: '#806FD6', 600: '#705DC2', 700: '#5D4BAB', 800: '#49398C', 900: '#35296B' },
        accent: { DEFAULT: '#167486', 50: '#EFFCFE', 100: '#D7F5F9', 200: '#ADEAF2', 400: '#76D8E4', 500: '#167486', 600: '#116777', 700: '#0D5867' },
        warn: '#F59E0B',
        danger: '#DC2626',
      },
      fontFamily: {
        display: ['Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px', '4xl': '40px' },
      boxShadow: {
        soft: '0 1px 2px rgb(25 17 43 / 0.04), 0 8px 24px -8px rgb(25 17 43 / 0.10)',
        lift: '0 2px 4px rgb(25 17 43 / 0.05), 0 24px 48px -16px rgb(25 17 43 / 0.22)',
        glow: '0 0 0 1px rgb(255 255 255 / 0.08), 0 30px 80px -20px rgb(112 93 194 / 0.55)',
      },
      keyframes: {
        drift: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(0,-10px,0)' } },
        pulseRing: { '0%': { transform: 'scale(.8)', opacity: '.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        tick: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pageIn: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        floatSym: { '0%': { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: '0' }, '12%': { opacity: '.55' }, '88%': { opacity: '.55' }, '100%': { transform: 'translate3d(var(--dx,20px),-120px,0) rotate(var(--rot,12deg))', opacity: '0' } },
        twinkle: { '0%,100%': { opacity: '.15' }, '50%': { opacity: '.8' } },
      },
      animation: {
        drift: 'drift 7s ease-in-out infinite',
        pulseRing: 'pulseRing 2.4s cubic-bezier(.2,.6,.3,1) infinite',
        shimmer: 'shimmer 1.6s infinite',
        tick: 'tick .5s cubic-bezier(.2,.8,.2,1) both',
        page: 'pageIn .45s cubic-bezier(.2,.8,.2,1) both',
        floatSym: 'floatSym var(--dur,14s) linear infinite',
        twinkle: 'twinkle var(--dur,4s) ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
