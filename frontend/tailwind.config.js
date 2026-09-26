/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#F8FAFC',
          dark: '#0B0F17',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#131B2B',
          subtle: {
            light: '#F1F5F9',
            dark: '#1E293B',
          }
        },
        border: {
          light: '#E2E8F0',
          dark: '#26354A',
        },
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        semantic: {
          draft: { text: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
          review: { text: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
          pending: { text: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
          verified: { text: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
          approved: { text: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
          rejected: { text: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
        }
      },
      fontFamily: {
        sans: ['Geist', 'Outfit', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        elevated: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '2xs': '0 1px 1px 0 rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
