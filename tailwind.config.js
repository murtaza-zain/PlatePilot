/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — deep scientific slate-blue
        primary: {
          50: '#eef2f7',
          100: '#d8e0ec',
          200: '#b3c2d8',
          300: '#7f98ba',
          400: '#4d6a9a',
          500: '#2f4d7d',
          600: '#233d65',
          700: '#1c3151',
          800: '#162740',
          900: '#101d33',
          950: '#0a1424',
        },
        // Secondary — warm neutral for surfaces
        neutral2: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dde1e9',
          300: '#c2c8d4',
          400: '#9ba3b4',
          500: '#737c91',
          600: '#5a6378',
          700: '#485061',
          800: '#3a414f',
          900: '#2e343f',
        },
        // Accent — emerald (environmental/impact)
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        success: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        error: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d',
        },
        ink: '#0a1424',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(10,20,36,0.04), 0 1px 3px 0 rgba(10,20,36,0.06)',
        card: '0 1px 2px 0 rgba(10,20,36,0.05), 0 4px 16px -4px rgba(10,20,36,0.08)',
        lift: '0 10px 30px -10px rgba(10,20,36,0.18)',
        glow: '0 0 0 1px rgba(47,77,125,0.12), 0 8px 30px -8px rgba(47,77,125,0.25)',
      },
      backgroundImage: {
        'grid-faint':
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
