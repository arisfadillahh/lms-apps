import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        brand: {
          deep: '#0f172a',
          slate: '#1e293b',
          mutedGreen: '#52796f',
          accentGreen: '#84a98c',
          surface: '#f8fafc',
          midnight: '#0a1428',
          sophisticatedBlue: '#6bb3ff',
        },
        primary: {
          DEFAULT: '#22367b', // Clevio Navy Blue (brand)
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#9dc83b', // Clevio Lime Green (brand)
          foreground: '#22367b',
        },
        accent: {
          DEFAULT: '#00b0d7', // Clevio Cyan (brand secondary)
          foreground: 'hsl(var(--accent-foreground))',
        },
        sky: '#00b0d7',
        coral: '#ff9400',
        sunshine: '#ffe60d',
        'clevio-navy': '#22367b',
        'clevio-green': '#9dc83b',
        'clevio-cyan': '#00b0d7',
        'clevio-orange': '#ff9400',
        'clevio-yellow': '#ffe60d',
        'clevio-purple': '#632a7b',
        'pastel-pink': '#FFF3E0',
        'pastel-yellow': '#FFFDE6',
        'pastel-blue': '#E0EEF8',
        'pastel-green': '#EEF6E2',
        'pastel-cyan': '#E0F5FA',
        'background-light': '#F7F9FE',
        'background-dark': '#1A1A2E',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'pj-default': '1.5rem',
        'pj-lg': '2rem',
        'pj-xl': '2.5rem',
        card: '12px',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
