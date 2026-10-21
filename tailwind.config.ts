import type { Config } from 'tailwindcss';

/**
 * Sutra design tokens. Surfaces step up in tone from paper (page) to surface (cards)
 * to raised (hover, nested, inputs on cards). Gold is an accent, never a background fill
 * for large areas. Status colours are always paired with an icon and a text label.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#10100f',
        surface: '#171715',
        raised: '#201f1c',
        inset: '#0c0c0b',
        ink: '#f1eee7',
        muted: '#9c988e',
        line: { DEFAULT: '#2b2a26', strong: '#403d36' },
        gold: { DEFAULT: '#c7a76b', light: '#ead6a6', dark: '#695333' },
        brand: { DEFAULT: '#c7a76b', dark: '#ead6a6', soft: '#c7a76b1f' },
        ok: { DEFAULT: '#86cf9f', soft: '#86cf9f1c' },
        warn: { DEFAULT: '#e6ae5c', soft: '#e6ae5c1c' },
        bad: { DEFAULT: '#ef8a84', soft: '#ef8a841c' },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { lg: '6px', card: '8px' },
      boxShadow: {
        card: '0 1px 0 0 #ffffff08 inset, 0 12px 32px -18px #000000cc',
        pop: '0 24px 60px -20px #000000f0',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        sheen: { '0%,55%,100%': { transform: 'translateX(-120%) skewX(-18deg)' }, '80%': { transform: 'translateX(220%) skewX(-18deg)' } },
      },
      animation: { rise: 'rise .28s cubic-bezier(.2,.8,.2,1) both', fade: 'fade .2s ease-out both', sheen: 'sheen 7s ease-in-out 1.2s 2' },
    },
  },
  plugins: [],
};
export default config;
