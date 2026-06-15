/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        background: '#F8FAFC',
        foreground: '#0F172A',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        primary: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
          foreground: '#FFFFFF',
        },
        success: '#16A34A',
        danger: '#DC2626',
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F8FAFC',
          foreground: '#64748B',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        ring: '#7C3AED',
        input: '#E2E8F0',
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
        accent: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
