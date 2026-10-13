/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
      colors: { cf: '#22d3ee', lc: '#f59e0b', cc: '#10b981', brand: '#6366f1' },
    },
  },
  plugins: [],
};
