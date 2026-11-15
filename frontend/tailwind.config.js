/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Playful learning palette. Text-bearing tones are the darker ones so
        // white labels stay above 4.5:1. Bright tones are decorative only.
        duo: {
          green: '#3A8602',
          'green-dark': '#276002',
          'green-light': '#46A302',
          lime: '#58CC02',
          blue: '#0B6E9E',
          'blue-dark': '#084A66',
          sky: '#1CB0F6',
          yellow: '#FFC800',
          'yellow-dark': '#C79E00',
          red: '#C42B2B',
          'red-dark': '#8F1D1D',
          purple: '#8B3FAF',
          'purple-dark': '#6B2E8F',
        },
        eel: '#1B2A32',
        swan: '#FFFFFF',
        dark: {
          bg: '#131F24',
          card: '#1A242B',
          border: '#37464F',
          text: '#F1F7FB',
          muted: '#A9BEC9',
        },
      },
      fontFamily: {
        heading: ['Baloo 2', 'Nunito', 'system-ui', 'sans-serif'],
        ui: ['Nunito', 'system-ui', 'sans-serif'],
        body: ['Lora', 'Georgia', 'serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        '3d': '0 4px 0 0 #276002',
        '3d-blue': '0 4px 0 0 #084A66',
        '3d-red': '0 4px 0 0 #8F1D1D',
        '3d-yellow': '0 4px 0 0 #C79E00',
        '3d-purple': '0 4px 0 0 #6B2E8F',
      },
      borderRadius: {
        'duo': '16px',
        'duo-lg': '24px',
      },
      animation: {
        'bounce-in': 'bounceIn 0.32s cubic-bezier(0.34, 1.4, 0.64, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.94)', opacity: '0' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
