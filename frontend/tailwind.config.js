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
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        saffron: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        blue: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        semantic: {
          draft: { text: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
          review: { text: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
          pending: { text: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
          verified: { text: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
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
