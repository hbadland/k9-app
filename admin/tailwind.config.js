/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#C9A84C',
        dark: '#0E0D0B',
        dark2: '#1A1916',
        dark3: '#252420',
        cream: '#F5EED8',
        muted: '#6B6660',
      },
    },
  },
};
