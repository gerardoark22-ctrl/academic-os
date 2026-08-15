/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        base: ['1.05rem', { lineHeight: '1.55' }],
        lg: ['1.2rem', { lineHeight: '1.5' }],
        xl: ['1.35rem', { lineHeight: '1.4' }],
      },
      colors: {
        bronze: {
          DEFAULT: '#8B4513',
          light: '#CD853F',
          dark: '#5C3310',
        },
        rust: '#A0522D',
        oxide: '#6B3A12',
        blood: {
          dried: '#5C1010',
          glow: '#8B2020',
          fresh: '#A03030',
        },
        parchment: {
          DEFAULT: '#E8D5B7',
          dim: '#C4A882',
        },
        ink: {
          DEFAULT: '#1A0F08',
          soft: '#3D2817',
        },
        marble: { base: '#E8D5B7', warm: '#C4A882', crack: '#8B4513' },
        gold: { stained: '#CD853F', dim: '#8B4513' },
        stone: { dark: '#1A0F08', medium: '#3D2817', light: '#8B4513' },
        danger: '#5C1010',
        warning: '#A0522D',
        success: '#5A6B4A',
      },
      fontFamily: {
        epic: ['Cinzel', 'serif'],
        stat: ['Oswald', 'sans-serif'],
        body: ['Philosopher', 'Georgia', 'serif'],
      },
      boxShadow: {
        ruin: '0 6px 0 #1A0F08, 0 10px 24px rgba(0,0,0,0.45)',
        epic: '0 8px 0 #1A0F08, 0 16px 40px rgba(0,0,0,0.5)',
        deep: '0 10px 30px rgba(0,0,0,0.55)',
        blood: '0 0 20px rgba(92,16,16,0.4)',
      },
      animation: {
        'pulse-blood': 'pulse-blood 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-blood': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(92,16,16,0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(92,16,16,0.6)' },
        },
      },
    },
  },
  plugins: [],
};
