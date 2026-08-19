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
        // Duolingo color palette
        duo: {
          green: '#58CC02',
          'green-dark': '#46A302',
          'green-light': '#6FE302',
          blue: '#1CB0F6',
          'blue-dark': '#1598D9',
          yellow: '#FFC800',
          'yellow-dark': '#E6B300',
          red: '#FF4B4B',
          'red-dark': '#E03E3E',
          purple: '#CE82FF',
          'purple-dark': '#B86FE6',
        },
        eel: '#4B4B4B',
        swan: '#FFFFFF',
        dark: {
          bg: '#131F24',
          card: '#1A242B',
          border: '#2D3748',
          text: '#F0F4F8',
          muted: '#9CA3AF',
        },
      },
      fontFamily: {
        heading: ['Baloo 2', 'cursive'],
        ui: ['Nunito', 'sans-serif'],
        body: ['Georgia', 'serif'],
        sans: ['Nunito', 'sans-serif'],
      },
      boxShadow: {
        '3d': '0 4px 0 0 #46A302',
        '3d-blue': '0 4px 0 0 #1598D9',
        '3d-red': '0 4px 0 0 #E03E3E',
        '3d-yellow': '0 4px 0 0 #E6B300',
        '3d-purple': '0 4px 0 0 #B86FE6',
      },
      borderRadius: {
        'duo': '16px',
        'duo-lg': '24px',
      },
      animation: {
        'bounce-in': 'bounceIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'confetti': 'confetti 0.6s ease-out',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        confetti: {
          '0%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(1.3) rotate(180deg)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
