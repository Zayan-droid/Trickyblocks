/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bungee"', '"Fredoka"', 'system-ui', 'sans-serif'],
        body: ['"Fredoka"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#0E0E10',
        surface: '#17171a',
        'surface-2': '#22222a',
        accent: '#FFD60A',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.1)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,214,10,0.6)' },
          '50%': { boxShadow: '0 0 24px 8px rgba(255,214,10,0.6)' },
        },
        rise: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translateY(120vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        floaty: 'floaty 3s ease-in-out infinite',
        wiggle: 'wiggle 1.4s ease-in-out infinite',
        pop: 'pop 320ms cubic-bezier(0.2,1.4,0.4,1) both',
        shimmer: 'shimmer 2.4s linear infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
        rise: 'rise 420ms cubic-bezier(0.2,1,0.2,1) both',
      },
    },
  },
  plugins: [],
};
