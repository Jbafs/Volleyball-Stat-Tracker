import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        court: {
          surface: '#4a7c59',
          line: '#ffffff',
          net: '#1a1a2e',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
