/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)', card: 'rgb(var(--card) / <alpha-value>)', line: 'rgb(var(--line) / <alpha-value>)', ink: 'rgb(var(--ink) / <alpha-value>)', mute: 'rgb(var(--mute) / <alpha-value>)',
        edge: 'rgb(var(--edge) / <alpha-value>)', win: 'rgb(var(--win) / <alpha-value>)', loss: 'rgb(var(--loss) / <alpha-value>)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
};
